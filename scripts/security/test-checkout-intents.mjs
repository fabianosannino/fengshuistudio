/** Durable checkout admission/fencing with actual PostgreSQL, no Stripe calls. */
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
const container = `fss-checkout-${randomBytes(5).toString('hex')}`
const image = 'postgres:17-alpine@sha256:18cfe3ef5e6815560c98237d6216d1e5119702fb0f3894c8785dd58b8bbe5d73'
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['pipe','pipe','pipe'] }).trim()
const args = ['exec','-i',container,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-qAt']
const sql = input => execFileSync('docker', args, { input, encoding: 'utf8', stdio: ['pipe','pipe','pipe'] }).trim()
const concurrent = input => new Promise((resolve, reject) => {
  const child = spawn('docker', args, { stdio: ['pipe','pipe','pipe'] })
  let out = '', err = ''
  child.stdout.on('data', c => { out += c }); child.stderr.on('data', c => { err += c })
  child.on('error', reject)
  child.on('close', code => code === 0 ? resolve(out.trim()) : reject(new Error(err)))
  child.stdin.end(input)
})
const owner = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const begin = (n = 1, plan = 'simples') => `select reservar_checkout_assinatura('${owner(n)}','${plan}','monthly','price_${plan}',false,'https://example.invalid')`
const bind = (id, n = 1, customer = 'cus_fixture', session = null) => `select registrar_checkout_assinatura('${owner(n)}','${id}','${customer}',${session ? `'${session}'` : 'null'})`
const end = (id, session = 'cs_fixture') => `select encerrar_checkout_assinatura('${owner(1)}','${id}','${session}')`
const authorize = (id, phase = 'session', n = 1) => `select autorizar_criacao_checkout('${owner(n)}','${id}','${phase}')`
const remove = n => `select iniciar_exclusao_do_titular('${owner(n)}')`
const service = query => `set role service_role; ${query};`
let checks = 0
const equal = (a,b,message) => { assert.deepEqual(a,b,message); checks++ }
const rejects = (query, message) => { assert.throws(() => sql(query), e => e.stderr?.includes(message)); checks++ }
try {
  docker('run','-d','--name',container,'--network','none','-e','POSTGRES_PASSWORD=local-test-only',image)
  let ready = false
  for (let i = 0; i < 60; i++) {
    try { ready = docker('exec', container, 'pg_isready', '-U', 'postgres').includes('accepting') } catch { /* Startup. */ }
    if (ready) break
    await new Promise(r => setTimeout(r,500))
  }
  assert.ok(ready)
  sql(`create role anon; create role authenticated; create role service_role bypassrls;
    create table profiles(id uuid primary key, stripe_customer_id text, stripe_account_id text);
    create table exclusoes_de_conta(user_id uuid primary key references profiles(id));
    create table produtos(vendedor_perfil_id uuid); create table clientes(titular_id uuid, consultor_id uuid);
    insert into profiles(id) select ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid from generate_series(1,5) n;
    grant select,insert,update,delete on all tables in schema public to service_role;`)
  sql(readFileSync(new URL('../../supabase/migrations/20260918071908_durable_subscription_checkout.sql', import.meta.url), 'utf8'))
  for (const role of ['anon','authenticated']) {
    rejects(`set role ${role}; ${begin()}`, 'permission denied')
    rejects(`set role ${role}; select * from checkouts_assinatura`, 'permission denied')
    rejects(`set role ${role}; ${bind(owner(1))}`, 'permission denied')
    rejects(`set role ${role}; ${end(owner(1))}`, 'permission denied')
    rejects(`set role ${role}; ${authorize(owner(1))}`, 'permission denied')
    rejects(`set role ${role}; ${remove(1)}`, 'permission denied')
  }
  const races = await Promise.all(['simples','profissional'].map(plan => concurrent(service(`begin; ${begin(1,plan)}; select pg_sleep(0.3); commit`))))
  const [first, second] = races.map(JSON.parse)
  equal(first, second, 'Concurrent choices share the first frozen intent')
  equal(sql('select count(*) from checkouts_assinatura'), '1', 'No duplicate attempt')
  equal(JSON.parse(sql(service(begin()))).id, first.id, 'Retry recovers the same nonce')
  equal(sql(service(bind(first.id, 2))), 'f', 'Another owner cannot attach a customer to this intent')
  equal(sql(service(bind(first.id))), 't', 'First customer persisted atomically')
  equal(sql(service(bind(first.id))), 't', 'Lost response safely retries same customer')
  equal(sql(service(bind(first.id, 1, 'cus_other'))), 'f', 'Cannot replace frozen customer')
  const started = sql(service(authorize(first.id)))
  equal(sql(service(authorize(first.id))), started, 'Retry never renews the provider guarantee window')
  equal(sql(service(bind(first.id, 1, 'cus_fixture', 'cs_fixture'))), 't', 'Session bound')
  equal(sql(service(bind(first.id, 1, 'cus_fixture', 'cs_other'))), 'f', 'Cannot replace frozen session')
  equal(sql(service(end(first.id,'cs_wrong'))), 'f', 'Wrong session cannot retire attempt')
  equal(sql(service(end(first.id))), 't', 'Confirmed terminal session retires attempt')
  const next = JSON.parse(sql(service(begin(1, 'profissional'))))
  equal(next.id !== first.id, true, 'New attempt gets fresh provider idempotency')
  equal(next.customer_anterior, 'cus_fixture', 'Known customer preserved across attempts')
  equal(sql(service(bind(first.id))), 'f', 'Retired worker cannot write or return a new session')
  equal(sql(service(end(first.id))), 'f', 'Late worker cannot retire new attempt')
  rejects(service(authorize(first.id)), 'checkout_indisponivel')
  const unknown = JSON.parse(sql(service(begin(2))))
  equal(sql(service(remove(2))), 'cobranca', 'Unknown provider result blocks deletion before effects')
  rejects(service(authorize(unknown.id, 'session', 2)), 'etapa_invalida')
  const creationStarted = sql(service(authorize(unknown.id, 'customer', 2)))
  equal(sql(service(authorize(unknown.id, 'customer', 2))), creationStarted, 'Customer retry window is also durable')
  sql(`update checkouts_assinatura set customer_criacao_em=clock_timestamp()-interval '23 hours' where id='${unknown.id}'`)
  rejects(service(authorize(unknown.id, 'customer', 2)), 'checkout_requer_reconciliacao')
  rejects(`delete from profiles where id='${owner(2)}'`, 'foreign key constraint')
  equal(sql(service(remove(3))), 'pronto', 'Deletion starts first')
  rejects(service(begin(3)), 'conta_em_exclusao')
  sql(`update profiles set stripe_customer_id='cus_changed' where id='${owner(2)}'`)
  rejects(service(authorize(unknown.id, 'customer', 2)), 'customer_alterado')
  equal(sql(service(bind(unknown.id, 2))), 'f', 'Concurrent external binding is not overwritten')
  rejects(service(begin(4, 'invalid')), 'checkout_invalido')
  equal(sql(`select count(*) from checkouts_assinatura where user_id='${owner(4)}'`), '0', 'Invalid input creates no intent')
  // A visit that only read an active subscription must not start a retry window.
  sql(`update checkouts_assinatura set criada_em=clock_timestamp()-interval '30 days' where id='${next.id}'`)
  equal(sql(service(bind(next.id))), 't', 'A prior known customer can be rebound')
  equal(sql(`select encerrar_checkout_assinatura('${owner(1)}','${next.id}',null)`), 't', 'Unstarted session can be safely retired after binding known customer')
  const fresh = JSON.parse(sql(service(begin())))
  sql(service(bind(fresh.id)))
  sql(service(authorize(fresh.id)))
  equal(sql(`select encerrar_checkout_assinatura('${owner(1)}','${fresh.id}',null)`), 'f', 'Once creation is authorized, cannot retire an unknown session')
  sql(`update checkouts_assinatura set session_criacao_em=clock_timestamp()-interval '23 hours' where id='${fresh.id}'`)
  rejects(service(authorize(fresh.id)), 'checkout_requer_reconciliacao')
  // Forced ordering: deletion waits behind reservation, then observes the intent.
  const reserving = concurrent(service(`begin; ${begin(5)}; select pg_sleep(1); commit`))
  let waiting = false
  for (let i = 0; i < 40; i++) {
    waiting = sql("select exists(select 1 from pg_stat_activity where wait_event='PgSleep')") === 't'
    if (waiting) break
    await new Promise(r => setTimeout(r,25))
  }
  equal(waiting, true, 'Reservation holds profile lock')
  const deletion = concurrent(service(remove(5)))
  await reserving
  equal(await deletion, 'cobranca', 'Concurrent deletion observes committed intent')
  process.stdout.write(JSON.stringify({ passed: checks, database: 'PostgreSQL 17', providerCalls: 0 })+'\n')
} finally { try { docker('rm','-f','-v',container) } catch { /* Only this random local fixture. */ } }
