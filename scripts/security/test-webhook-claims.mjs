/** Real PostgreSQL claims, concurrent retries and stale-token completion. */
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
const container = `fss-events-${randomBytes(5).toString('hex')}`
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
const claim = (id = 'evt_race', type = 'invoice.paid') => `select public.reivindicar_evento_stripe('${id}','${type}','/test','in_1','2026-09-18T01:00:00Z')`
const finish = (id, token, success = true) => `select public.finalizar_evento_stripe('${id}','${token}',${success})`
const service = input => `set role service_role; ${input};`
let checks = 0
const equal = (a,b,message) => { assert.deepEqual(a,b,message); checks++ }
const rejects = (input,message) => { assert.throws(() => sql(input), e => e.stderr?.includes(message)); checks++ }
try {
  docker('run','-d','--name',container,'--network','none','-e','POSTGRES_PASSWORD=local-test-only',image)
  let ready = false
  for (let i=0; i<60; i++) {
    try { ready = docker('exec',container,'pg_isready','-h','127.0.0.1','-U','postgres').includes('accepting') } catch { /* startup */ }
    if (ready) break
    await new Promise(r => setTimeout(r,500))
  }
  assert.ok(ready)
  sql('create role anon; create role authenticated; create role service_role bypassrls;')
  sql(readFileSync(new URL('../../supabase/migrations/20260812220000_eventos_stripe.sql', import.meta.url),'utf8'))
  sql(`create table payment_notifications(id uuid primary key default gen_random_uuid(),user_id uuid not null,type text not null);
    alter table payment_notifications enable row level security;
    insert into eventos_stripe(event_id,tipo,endpoint,objeto_id,criado_em_stripe,processado_em) values
      ('evt_done','invoice.paid','/test','in_1','2026-09-18T01:00:00Z',now()),
      ('evt_legacy','invoice.paid','/test','in_1','2026-09-18T01:00:00Z',null);`)
  sql(readFileSync(new URL('../../supabase/migrations/20260918050706_webhook_claims.sql', import.meta.url),'utf8'))
  sql('grant select,insert,update,delete on all tables in schema public to service_role; grant select on eventos_stripe to anon,authenticated;')
  for (const role of ['anon','authenticated']) {
    rejects(`set role ${role}; ${claim()}`, 'permission denied')
    rejects(`set role ${role}; ${finish('evt_done','00000000-0000-4000-8000-000000000001')}`, 'permission denied')
    equal(sql(`set role ${role}; select count(*) from eventos_stripe`),'0','RLS hides financial control records')
  }
  equal(JSON.parse(sql(service(claim('evt_done')))).situacao, 'repetido', 'legacy completion preserved')
  const legacy = JSON.parse(sql(service(claim('evt_legacy'))))
  equal(legacy.situacao, 'reivindicado', 'unfinished legacy row can be claimed')
  const races = await Promise.all([1,2].map(() => concurrent(service(`begin; ${claim()}; select pg_sleep(1); commit`))))
  const outcomes = races.map(JSON.parse)
  equal(outcomes.map(r => r.situacao).sort(), ['ocupado','reivindicado'], 'only one active worker')
  const first = outcomes.find(r => r.token)
  equal(sql("select tentativas from eventos_stripe where event_id='evt_race'"), '1', 'busy delivery not counted as new worker')
  equal(sql(service(finish('evt_race',first.token,false))), 't', 'failed attempt released')
  const next = JSON.parse(sql(service(claim())))
  equal(next.situacao,'retomado','failed work retryable')
  equal(next.token !== first.token,true,'retry gets a different token')
  equal(sql(service(finish('evt_race',first.token))), 'f','old worker cannot finish new attempt')
  equal(sql(service(finish('evt_race',first.token,false))), 'f','old worker cannot release new attempt')
  equal(JSON.parse(sql(service(claim()))).situacao,'ocupado','current worker still owns claim')
  sql("update eventos_stripe set tentativa_ate=clock_timestamp()-interval '1 second' where event_id='evt_race'")
  equal(sql(service(finish('evt_race',next.token))), 'f','expired worker cannot acknowledge')
  const recovered = JSON.parse(sql(service(claim())))
  equal(recovered.situacao,'retomado','crashed/expired worker recovered')
  equal(sql(service(finish('evt_race',recovered.token))), 't','current worker completes')
  equal(JSON.parse(sql(service(claim()))).situacao,'repetido','completed retry discarded')
  rejects(service(claim('evt_race','invoice.payment_failed')),'evento_incompativel')
  rejects(service("select reivindicar_evento_stripe('evt_invalid','invoice.paid','/test',null,'infinity')"),'evento_invalido')
  const notification = `insert into payment_notifications(user_id,type,referencia_evento) values('00000000-0000-4000-8000-000000000001','refund_processed','evt_race') on conflict(user_id,type,referencia_evento) do nothing`
  await Promise.all([1,2].map(() => concurrent(service(notification))))
  equal(sql('select count(*) from payment_notifications'),'1','notification retry is unique')
  process.stdout.write(JSON.stringify({ passed: checks, database: 'PostgreSQL 17', concurrentClaims: true })+'\n')
} finally { try { docker('rm','-f','-v',container) } catch { /* Only our random test container. */ } }
