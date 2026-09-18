/** Real PostgreSQL transactions; synthetic identities, isolated task-owned DB. */
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'

const container = `fss-quotas-${randomBytes(5).toString('hex')}`
const image = 'postgres:17-alpine@sha256:18cfe3ef5e6815560c98237d6216d1e5119702fb0f3894c8785dd58b8bbe5d73'
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['pipe','pipe','pipe'] }).trim()
const args = ['exec','-i',container,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-qAt']
const sql = statement => execFileSync('docker', args, { input: statement, encoding: 'utf8', stdio: ['pipe','pipe','pipe'] }).trim()
const concurrent = statement => new Promise(resolve => {
  const child = spawn('docker', args, { stdio: ['pipe','pipe','pipe'] })
  let out = '', err = ''
  child.stdout.on('data', data => { out += data })
  child.stderr.on('data', data => { err += data })
  child.on('close', code => resolve({ code, out: out.trim(), err }))
  child.on('error', error => resolve({ code: -1, out, err: error.message }))
  child.stdin.end(statement)
})
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const as = n => `set role authenticated; set request.jwt.claim.sub='${id(n)}';`
const ownClient = n => `(select id from clientes where consultor_id='${id(n)}' order by criado_em,id limit 1)`
const property = (n, status='em_andamento') => `insert into consultas(consultor_id,cliente_id,status) values('${id(n)}',${ownClient(n)},'${status}')`
// Hold a real transaction open before the grant mutation; no timing guesses.
async function admissionAfterSnapshot(n, isolation, between) {
  const child = spawn('docker',args,{stdio:['pipe','pipe','pipe']})
  let out='',err=''
  child.stdout.on('data',c=>{out+=c}); child.stderr.on('data',c=>{err+=c})
  const started = new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject)})
  const completed = new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',code=>resolve({code,out,err}))})
  child.stdin.write(`${as(n)} begin isolation level ${isolation}; select count(*) from profiles;\n`)
  await started
  try { sql(between); child.stdin.end(`${property(n)}; commit;\n`) }
  catch (error) { child.stdin.end('rollback;\n'); await completed; throw error }
  return completed
}
let checks = 0
const equal = (a,b,label) => { assert.deepEqual(a,b,label); checks++ }
const rejects = (statement, message) => {
  assert.throws(()=>sql(statement), error => error.stderr?.includes(message)); checks++
}
try {
  docker('run','-d','--name',container,'--network','none','-e','POSTGRES_PASSWORD=local-test-only',image)
  let ready = false
  for(let i=0;i<60;i++) {
    try { ready = docker('exec',container,'pg_isready','-h','127.0.0.1','-U','postgres').includes('accepting') } catch { /* starting */ }
    if(ready) break
    await new Promise(resolve=>setTimeout(resolve,500))
  }
  assert.ok(ready, 'PostgreSQL ready on TCP')
  // Real column types, FKs and owner policies inspected on production 18/09.
  sql(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key,email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated;
    create type plano_tipo as enum('freemium','starter','pro','agencia');
    create type consulta_status as enum('rascunho','em_andamento','finalizada','arquivada','deletada','sem_analise');
    create table profiles(id uuid primary key references auth.users(id) on delete cascade, plano plano_tipo not null default 'freemium', nome_completo text);
    create table plans(id uuid primary key default gen_random_uuid(),slug text unique,features jsonb,price_monthly numeric not null,price_yearly numeric not null);
    create table clientes(id uuid primary key default gen_random_uuid(),consultor_id uuid not null references profiles(id) on delete cascade,
      nome_completo text not null,email text,ativo boolean not null default true,criado_em timestamptz not null default now(),notas text);
    create table consultas(id uuid primary key default gen_random_uuid(),consultor_id uuid not null references profiles(id) on delete cascade,
      cliente_id uuid not null references clientes(id) on delete cascade,status consulta_status not null,nome_imovel text);
    alter table profiles enable row level security; alter table clientes enable row level security; alter table consultas enable row level security;
    create policy own_profile on profiles for select to authenticated using(id=(select auth.uid()));
    create policy own_clients on clientes for all to authenticated using(consultor_id=(select auth.uid())) with check(consultor_id=(select auth.uid()));
    create policy own_properties on consultas for all to authenticated using(consultor_id=(select auth.uid())) with check(consultor_id=(select auth.uid()));
    grant select on profiles to authenticated;
    grant select,insert,update,delete on clientes,consultas to authenticated,service_role;
    insert into plans(slug,features,price_monthly,price_yearly) values('free','{"clientes":false}',0,0),('simples','{"imoveis":1}',20,168),('profissional','{}',49.9,411.6);
    insert into auth.users select ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'fixture-'||n||'@example.invalid' from generate_series(1,8) n;
    insert into profiles(id,nome_completo) select id,'Fixture' from auth.users;
    update profiles set plano='starter' where id in ('${id(2)}','${id(3)}');
    update profiles set plano='pro' where id='${id(4)}';
    update profiles set plano='agencia' where id='${id(5)}';
    insert into clientes(consultor_id,nome_completo,email) select id,'Fixture',email from auth.users;
    insert into clientes(consultor_id,nome_completo,email) values('${id(1)}','Legacy duplicate','fixture-1@example.invalid');
    ${property(1)}; ${property(1)};
  `)
  const vulnerable = await Promise.all([1,2].map(()=>concurrent(`${as(1)} begin; select count(*) from consultas; select pg_sleep(1); ${property(1)}; commit;`)))
  equal(vulnerable.map(r=>r.code),[0,0],'old API count-then-insert permits both')
  equal(sql(`select count(*) from consultas where consultor_id='${id(1)}'`),'4','baseline quota bypass reproduced')
  const before = sql("select jsonb_agg(to_jsonb(c) order by id) from clientes c")
  sql(readFileSync(new URL('../../supabase/migrations/20260918041545_atomic_plan_quotas.sql',import.meta.url),'utf8'))
  equal(sql("select jsonb_agg(to_jsonb(c)-'titular_id' order by id) from clientes c"),before,'legacy contacts preserved exactly')
  equal(sql(`select count(*) from clientes where titular_id='${id(1)}'`),'1','one self registration per owner')
  equal(sql('select sum(price_monthly)=69.9 and sum(price_yearly)=579.6 from plans'),'t','prices unchanged')
  const first = sql(`${as(1)} select public.obter_cliente_titular()`)
  equal(sql(`${as(1)} select public.obter_cliente_titular()`),first,'own registration is idempotent')
  sql(`insert into auth.users(id,email) values('${id(9)}','new@example.invalid');
    insert into profiles(id,nome_completo) values('${id(9)}','New fixture');`)
  const personal = await Promise.all([1,2].map(()=>concurrent(`${as(9)} begin; select public.obter_cliente_titular(); select pg_sleep(1); commit;`)))
  equal(personal.map(r=>r.code),[0,0],'parallel personal registration requests succeed')
  equal(personal[0].out,personal[1].out,'parallel retries return the same personal client')
  equal(sql(`select count(*) from clientes where consultor_id='${id(9)}'`),'1','only one personal client created')
  rejects('set role anon; select public.obter_cliente_titular()','permission denied')
  rejects(`${as(1)} select * from app_private.cotas_serializacao`,'permission denied')
  rejects(`${as(1)} select app_private.direitos_com_cota_serializada('${id(2)}')`,'permission denied')
  rejects(`${as(1)} insert into clientes(consultor_id,nome_completo,titular_id) values('${id(1)}','Forged','${id(1)}')`,'titular_invalido')
  rejects(`${as(1)} update clientes set titular_id=null where id='${first}'`,'proprietario_imutavel')
  rejects(`${as(1)} update clientes set nome_completo='Someone else' where id='${first}'`,'contato_do_titular')
  rejects(`${as(1)} insert into clientes(consultor_id,nome_completo) values('${id(1)}','External')`,'cota_clientes_excedida')
  sql(`${as(1)} update consultas set nome_imovel='Editable legacy';`)
  equal(sql(`select count(*) from consultas where nome_imovel='Editable legacy'`),'4','over-quota legacy records editable')
  rejects(`${as(1)} ${property(1)}`,'cota_imoveis_excedida')
  rejects(`set role service_role; ${property(1)}`,'cota_imoveis_excedida')
  sql(`${as(1)} delete from consultas where id in(select id from consultas limit 2);`)
  const races = await Promise.all([1,2].map(()=>concurrent(`${as(1)} begin; ${property(1)}; select pg_sleep(1); commit;`)))
  equal(races.filter(r=>r.code===0).length,1,'one concurrent property admitted')
  equal(races.filter(r=>r.err.includes('cota_imoveis_excedida')).length,1,'other transaction sees committed quota')
  equal(sql(`select count(*) from consultas where consultor_id='${id(1)}'`),'3','quota not exceeded')
  sql(`${as(1)} ${property(1,'arquivada')}; ${property(1,'deletada')};`)
  rejects(`${as(1)} update consultas set status='em_andamento' where status='arquivada'`,'cota_imoveis_excedida')
  sql(`${as(1)} update consultas set status='arquivada' where id in(select id from consultas where status='em_andamento' limit 1);`)
  sql(`${as(1)} update consultas set status='em_andamento' where id in(select id from consultas where status='deletada' limit 1);`)
  equal(sql(`select count(*) from consultas where consultor_id='${id(1)}' and status not in('arquivada','deletada')`),'3','archive releases slot and reactivation consumes it')
  rejects(`${as(1)} insert into consultas(consultor_id,cliente_id,status) values('${id(1)}',${ownClient(2)},'arquivada')`,'cliente_indisponivel')
  rejects(`${as(1)} insert into clientes(consultor_id,nome_completo) values('${id(2)}','External')`,'row-level security')
  sql(`${as(2)} insert into clientes(consultor_id,nome_completo) select '${id(2)}','External' from generate_series(1,24);`)
  const clients = await Promise.all([1,2].map(()=>concurrent(`${as(2)} begin; insert into clientes(consultor_id,nome_completo) values('${id(2)}','Last'); select pg_sleep(1); commit;`)))
  equal(clients.filter(r=>r.code===0).length,1,'one concurrent client admitted')
  equal(sql(`select count(*) from clientes where consultor_id='${id(2)}' and titular_id is null and ativo`),'25','self client excluded from external quota')
  sql(`${as(2)} insert into clientes(consultor_id,nome_completo,ativo) values('${id(2)}','Inactive',false);`)
  rejects(`${as(2)} update clientes set ativo=true where not ativo`,'cota_clientes_excedida')
  sql(`${as(2)} update clientes set ativo=false where id in(select id from clientes where titular_id is null and ativo limit 1);
    update clientes set ativo=true where nome_completo='Inactive';`)
  checks++
  for(const n of [2,4,5]) {
    sql(`${as(n)} insert into consultas(consultor_id,cliente_id,status) select '${id(n)}',${ownClient(n)},'em_andamento' from generate_series(1,${n===2?10:12});`)
    if(n===2) rejects(`${as(n)} ${property(n)}`,'cota_imoveis_excedida')
    else equal(sql(`select count(*) from consultas where consultor_id='${id(n)}'`),'12','unlimited plan')
  }
  // A persistent updated mutex also protects a stale repeatable-read snapshot.
  sql(`${as(3)} insert into consultas(consultor_id,cliente_id,status) select '${id(3)}',${ownClient(3)},'em_andamento' from generate_series(1,9);`)
  const repeatable = await Promise.all([1,2].map(()=>concurrent(`${as(3)} begin isolation level repeatable read; select count(*) from consultas; select pg_sleep(1); ${property(3)}; select pg_sleep(1); commit;`)))
  equal(repeatable.filter(r=>r.code===0).length,1,'one repeatable-read transaction admitted')
  equal(repeatable.filter(r=>r.err.includes('could not serialize')).length,1,'stale snapshot fails serialization')
  sql("update plans set features=features-'versao' where slug='free'")
  rejects(`${as(6)} ${property(6)}`,'direitos_indisponiveis')
  sql(`delete from auth.users where id='${id(3)}'`)
  equal(sql(`select count(*) from app_private.cotas_serializacao where titular_id='${id(3)}'`),'0','privacy deletion cascades technical mutex')
  // An expired entitlement still passed admissions when the cached profile was Pro.
  sql(`update plans set features=features||'{"versao":"2026-09-18.1"}'::jsonb where slug='free';
    create table concessoes_de_plano(id uuid primary key default gen_random_uuid(),user_id uuid not null references profiles(id),
      plano text not null,origem text not null,referencia text,valido_de timestamptz not null default now(),valido_ate timestamptz,encerrada_em timestamptz,motivo text,
      unique(origem,referencia));
    create table subscriptions(id uuid primary key default gen_random_uuid(),user_id uuid not null references profiles(id),plan_id uuid references plans(id),
      status text,price_paid numeric,gateway_subscription_id text,activated_by_key uuid,gratuidade_motivo text,cancelled_at timestamptz,
      cancel_at_period_end boolean,current_period_start timestamptz,started_at timestamptz,created_at timestamptz not null default now(),current_period_end timestamptz);
    insert into concessoes_de_plano(user_id,plano,origem,valido_ate) values
      ('${id(2)}','simples','assinatura',null),('${id(4)}','profissional','chave',now()-interval '1 day');
    insert into subscriptions(user_id,plan_id,status,price_paid,gratuidade_motivo)
      values('${id(5)}',(select id from plans where slug='profissional'),'gratuidade',0,'Synthetic documented courtesy');
    update profiles set plano='pro' where id='${id(8)}';
    ${property(4)};`)
  equal(sql(`select count(*) from consultas where consultor_id='${id(4)}'`),'13','baseline: expired grant bypasses quota through stale Pro cache')
  const currentPlanMigration = readFileSync(new URL('../../supabase/migrations/20260918064534_effective_plan_from_current_grants.sql',import.meta.url),'utf8')
  rejects(currentPlanMigration,'perfil_pago_sem_origem_verificavel')
  equal(sql('select count(*) from concessoes_de_plano'), '2', 'unknown paid profile rolls back the entire migration, including courtesy backfill')
  sql(`update profiles set plano='freemium' where id='${id(8)}'`)
  const legacyData = sql('select jsonb_agg(to_jsonb(s) order by id) from subscriptions s')
  sql(currentPlanMigration)
  equal(sql('select jsonb_agg(to_jsonb(s) order by id) from subscriptions s'),legacyData,'legacy subscription unchanged')
  equal(sql(`select plano from profiles where id='${id(5)}'`),'agencia','backfill does not mass rewrite cached profiles')
  equal(sql(`${as(5)} select public.obter_meu_plano()`),'profissional','documented legacy courtesy preserved')
  equal(sql(`${as(4)} select public.obter_meu_plano()`),'free','expired grant no longer confers access despite Pro cache')
  equal(sql(`${as(2)} select public.obter_meu_plano()`),'simples','reads only the authenticated owner entitlement')
  rejects('set role anon; select public.obter_meu_plano()','permission denied')
  rejects(`set role authenticated; select app_private.plano_vigente('${id(5)}',now())`,'permission denied')
  rejects('set role authenticated; select public.obter_meu_plano()','nao_autenticado')
  rejects(`${as(4)} ${property(4)}`,'cota_imoveis_excedida')
  rejects(`${as(4)} insert into clientes(consultor_id,nome_completo) values('${id(4)}','External')`,'cota_clientes_excedida')
  sql(`${as(4)} update consultas set nome_imovel='Preserved after expiry';`)
  equal(sql(`select count(*) from consultas where consultor_id='${id(4)}' and nome_imovel='Preserved after expiry'`),'13','expired plan preserves reading/editing existing properties')
  sql(`${as(5)} ${property(5)};`)
  equal(sql(`select count(*) from consultas where consultor_id='${id(5)}'`),'13','legacy courtesy still admits properties')
  sql(`insert into concessoes_de_plano(user_id,plano,origem,valido_de) values('${id(4)}','profissional','cortesia',now()+interval '1 day');
    insert into concessoes_de_plano(user_id,plano,origem,encerrada_em) values('${id(4)}','profissional','cortesia',now());`)
  equal(sql(`${as(4)} select public.obter_meu_plano()`),'free','future and revoked grants do not revive expired rights')
  sql(`grant select,update on profiles to service_role; grant select on concessoes_de_plano to service_role;`)
  equal(sql(`set role service_role; select public.recalcular_plano_do_perfil('${id(4)}')`),'free','service projection uses the same effective rule')
  equal(sql(`select plano from profiles where id='${id(4)}'`),'freemium','stale cache recalculated')
  // New admissions still serialize after the effective-plan migration.
  sql(`${as(6)} ${property(6)}; ${property(6)};`)
  const freshRace = await Promise.all([1,2].map(()=>concurrent(`${as(6)} begin; ${property(6)}; select pg_sleep(1); commit;`)))
  equal(freshRace.filter(r=>r.code===0).length,1,'one admission after current-plan migration')
  equal(freshRace.filter(r=>r.err.includes('cota_imoveis_excedida')).length,1,'effective free limit survives concurrent admissions')
  sql(`${as(7)} ${property(7)}; ${property(7)}; ${property(7)};
    ${as(8)} ${property(8)}; ${property(8)}; ${property(8)};`)
  const confer = n => `begin; select 1 from profiles where id='${id(n)}' for update;
    insert into concessoes_de_plano(user_id,plano,origem,valido_de) values('${id(n)}','profissional','cortesia',clock_timestamp());
    select public.recalcular_plano_do_perfil('${id(n)}'); commit;`
  const freshGrant = await admissionAfterSnapshot(7,'read committed',confer(7))
  equal(freshGrant.code,0,'admission sees grant started after its transaction began')
  const staleSnapshot = await admissionAfterSnapshot(8,'repeatable read',confer(8))
  equal(staleSnapshot.err.includes('could not serialize'),true,'stale entitlement snapshot fails before admission')
  const expiredWhileOpen = await admissionAfterSnapshot(7,'read committed',`begin;
    select 1 from profiles where id='${id(7)}' for update;
    update concessoes_de_plano set valido_ate=clock_timestamp() where user_id='${id(7)}'; commit;`)
  equal(expiredWhileOpen.err.includes('cota_imoveis_excedida'),true,'admission uses actual time after lock, not transaction start time')
  process.stdout.write(JSON.stringify({passed:checks,baselineRaceReproduced:true,database:'PostgreSQL 17'})+'\n')
} finally {
  try { docker('rm','-f','-v',container) } catch { /* Only the random task-owned container. */ }
}
