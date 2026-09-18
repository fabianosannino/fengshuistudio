/** Subscription projection, entitlements and fencing on real PostgreSQL. */
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
const container = `fss-sync-${randomBytes(5).toString('hex')}`
const image = 'postgres:17-alpine@sha256:18cfe3ef5e6815560c98237d6216d1e5119702fb0f3894c8785dd58b8bbe5d73'
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['pipe','pipe','pipe'] }).trim()
const args = ['exec','-i',container,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-qAt']
const sql = input => execFileSync('docker',args,{input,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim()
const concurrent = input => new Promise((resolve,reject) => {
  const child = spawn('docker',args,{stdio:['pipe','pipe','pipe']}); let out='',err=''
  child.stdout.on('data',c=>{out+=c}); child.stderr.on('data',c=>{err+=c}); child.on('error',reject)
  child.on('close',code=>resolve({code,out:out.trim(),err})); child.stdin.end(input)
})
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const fixtureTime = Math.floor(Date.now()/1000)*1000
const instant = days => new Date(fixtureTime+days*86400000).toISOString()
const state = (over={}) => ({ customer:'cus_2',plano:'simples',ciclo:'monthly',status:'active',valor_centavos:2000,
  started_at:instant(-1),period_start:instant(-1),period_end:instant(29),trial_end:null,cancel_at_period_end:false,...over })
const claim = sub => `select reservar_sincronizacao_assinatura('${sub}')`
const release = (sub,token) => `select liberar_sincronizacao_assinatura('${sub}','${token}')`
const apply = (sub,token,data=state()) => `select aplicar_sincronizacao_assinatura('${sub}','${token}', '${JSON.stringify(data).replaceAll("'","''")}'::jsonb)`
const service = statement => `set role service_role; ${statement};`
const migration = name => readFileSync(new URL(`../../supabase/migrations/${name}.sql`,import.meta.url),'utf8')
const syncMigration = migration('20260918074144_atomic_subscription_projection')
let checks=0
const equal=(a,b,m)=>{assert.deepEqual(a,b,m);checks++}
const rejects=(input,message)=>{assert.throws(()=>sql(input),e=>e.stderr?.includes(message));checks++}
try {
  docker('run','-d','--name',container,'--network','none','-e','POSTGRES_PASSWORD=local-test-only',image)
  let ready=false
  for(let i=0;i<60;i++) {
    try {ready=docker('exec',container,'pg_isready','-U','postgres').includes('accepting')} catch { /* Startup. */ }
    if(ready)break
    await new Promise(r=>setTimeout(r,500))
  }
  assert.ok(ready)
  sql(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema app_private; create schema auth; create function auth.uid() returns uuid language sql as $$select null::uuid$$;
    create type plano_tipo as enum('freemium','starter','pro','agencia');
    create table profiles(id uuid primary key,plano plano_tipo not null default 'freemium',stripe_customer_id text);
    create table plans(id uuid primary key default gen_random_uuid(),slug text unique not null,features jsonb);
    create table subscriptions(id uuid primary key default gen_random_uuid(),user_id uuid not null references profiles(id),plan_id uuid not null references plans(id),
      billing_cycle text not null,status text not null,price_paid numeric,started_at timestamptz,current_period_start timestamptz,current_period_end timestamptz,
      next_billing_date timestamptz,cancelled_at timestamptz,cancel_at_period_end boolean,gateway_subscription_id text,
      activated_by_key uuid,gratuidade_motivo text,created_at timestamptz default now(),updated_at timestamptz);
    create unique index subscriptions_gateway_subscription_id_key on subscriptions(gateway_subscription_id) where gateway_subscription_id is not null;
    create table concessoes_de_plano(id uuid primary key default gen_random_uuid(),user_id uuid not null references profiles(id),
      plano text not null check(plano in('free','simples','profissional')),origem text not null check(origem in('assinatura','chave','cortesia','migracao')),
      referencia text,valido_de timestamptz not null default now(),valido_ate timestamptz,encerrada_em timestamptz,motivo text,criada_por uuid references profiles(id));
    create table exclusoes_de_conta(user_id uuid primary key references profiles(id));
    create table activation_keys(id uuid primary key default gen_random_uuid(),key text not null unique,plan_type text not null,
      status text not null,expires_at timestamptz,used_at timestamptz,used_by uuid references profiles(id),duration_months integer,discount_percent integer);
    create table admin_audit_log(id uuid primary key default gen_random_uuid(),action text not null,target_type text,target_id text,details jsonb,performed_by uuid);
    alter table subscriptions enable row level security; alter table concessoes_de_plano enable row level security;
    grant select,insert,update,delete on all tables in schema public to service_role;
    insert into profiles(id,stripe_customer_id) select ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'cus_'||n from generate_series(1,5) n;
    insert into plans(slug) values('simples'),('profissional'),('free');`)
  sql(migration('20260918043003_durable_billing_coordination'))
  sql(migration('20260918064534_effective_plan_from_current_grants'))
  // Prove the old two-commit failure, with the same actual grant function.
  sql(`create function app_private.reject_fixture_grant() returns trigger language plpgsql as $$begin
    if new.referencia in('sub_baseline','sub_rollback') then raise exception 'fixture_grant_failure'; end if; return new; end$$;
    create trigger fixture_grant_failure before insert on concessoes_de_plano for each row execute function app_private.reject_fixture_grant();
    insert into subscriptions(user_id,plan_id,billing_cycle,status,gateway_subscription_id)
      select '${id(3)}',id,'monthly','active','sub_baseline' from plans where slug='simples';`)
  rejects(service(`select alterar_concessao_de_plano('${id(3)}','conceder','assinatura','sub_baseline','simples','${instant(29)}')`),'fixture_grant_failure')
  equal(sql("select count(*) from subscriptions where gateway_subscription_id='sub_baseline'"),'1','Baseline: mirror survives failed grant in separate transaction')
  sql("delete from subscriptions where gateway_subscription_id='sub_baseline'")
  sql(`insert into concessoes_de_plano(user_id,plano,origem,referencia) values('${id(4)}','simples','assinatura','sub_legacy')`)
  rejects(`begin; ${syncMigration} commit;`,'concessao_de_assinatura_sem_prazo_requer_reconciliacao')
  equal(sql("select to_regclass('app_private.sincronizacoes_assinatura') is null"),'t','Unknown legacy grant rolls back the whole migration')
  sql("delete from concessoes_de_plano where referencia='sub_legacy'")
  sql(syncMigration)
  rejects(service(`select alterar_concessao_de_plano('${id(4)}','conceder','assinatura','sub_noprazo','simples')`),'concessao_assinatura_tem_prazo')
  rejects(service(`select alterar_concessao_de_plano('${id(4)}','conceder','assinatura','sub_infinite','simples','infinity')`),'concessao_assinatura_tem_prazo')
  for(const role of ['anon','authenticated']) {
    rejects(`set role ${role}; ${claim('sub_acl')}`,'permission denied')
    rejects(`set role ${role}; ${apply('sub_acl',id(1))}`,'permission denied')
    rejects(`set role ${role}; ${release('sub_acl',id(1))}`,'permission denied')
    rejects(`set role ${role}; select * from app_private.sincronizacoes_assinatura`,'permission denied')
  }
  const races=await Promise.all([1,2].map(()=>concurrent(service(`begin; ${claim('sub_race')}; select pg_sleep(0.3); commit`))))
  equal(races.every(r=>r.code===0),true,'Both claim transactions complete')
  equal(races.filter(r=>r.out).length,1,'Only one worker may read/apply the subscription at a time')
  const token=races.find(r=>r.out).out
  equal(JSON.parse(sql(service(apply('sub_race',token)))).situacao,'criada','Mirror and benefit created together')
  equal(sql("select count(*) from subscriptions where gateway_subscription_id='sub_race'"),'1','One mirror row')
  equal(sql("select count(*) from concessoes_de_plano where referencia='sub_race'"),'1','One grant')
  equal(sql(`select valido_ate='${instant(29)}'::timestamptz from concessoes_de_plano where referencia='sub_race'`),'t','Grant expires with the verified period')
  equal(sql(`select plano from profiles where id='${id(2)}'`),'starter','Projection recalculated in same transaction')
  equal(sql(`select app_private.plano_vigente('${id(2)}','${instant(29)}')`),'free','Effective right expires at period boundary even without another webhook')
  rejects(service(apply('sub_race',token)),'sincronizacao_expirada')
  const replay=sql(service(claim('sub_race')))
  equal(JSON.parse(sql(service(apply('sub_race',replay)))).situacao,'atualizada','Fresh retry updates without duplication')
  equal(sql("select count(*) from concessoes_de_plano where referencia='sub_race'"),'1','Retry still has one grant')
  const scheduled=sql(service(claim('sub_race')))
  equal(JSON.parse(sql(service(apply('sub_race',scheduled,state({cancel_at_period_end:true}))))).cancelamentoAgendado,true,'Scheduled cancellation returns persisted state')
  equal(sql(`select plano from profiles where id='${id(2)}'`),'starter','Scheduled cancellation preserves already verified period')
  const pastDue=sql(service(claim('sub_race')))
  sql(service(apply('sub_race',pastDue,state({status:'past_due',period_end:instant(60)}))))
  equal(sql(`select valido_ate='${instant(29)}'::timestamptz from concessoes_de_plano where referencia='sub_race'`),'t','Unpaid renewal does not extend prior access')
  const rollback=sql(service(claim('sub_rollback')))
  rejects(service(apply('sub_rollback',rollback,state({customer:'cus_3'}))),'fixture_grant_failure')
  equal(sql("select count(*) from subscriptions where gateway_subscription_id='sub_rollback'"),'0','Grant failure rolls back mirror')
  equal(sql(`select plano from profiles where id='${id(3)}'`),'freemium','Grant failure leaves profile unchanged')
  equal(sql(service(release('sub_rollback',rollback))),'t','Failed transaction remains retryable')
  const invalid=sql(service(claim('sub_invalid')))
  for(const over of [{period_end:null},{period_end:instant(-2)},{plano:null},{status:'unknown'},{valor_centavos:-1}]) {
    rejects(service(apply('sub_invalid',invalid,state(over))), over.status||over.valor_centavos===-1?'assinatura_invalida':over.plano===null?'plano_nao_identificado':'periodo_invalido')
  }
  equal(sql("select count(*) from subscriptions where gateway_subscription_id='sub_invalid'"),'0','Invalid state never writes partially')
  sql(service(release('sub_invalid',invalid)))
  // A paid subscription must not erase a separate courtesy.
  sql(service(`select alterar_concessao_de_plano('${id(2)}','conceder','cortesia','manual','profissional')`))
  const cancel=sql(service(claim('sub_race')))
  sql(service(apply('sub_race',cancel,state({status:'canceled',plano:null,valor_centavos:null}))))
  equal(sql("select encerrada_em is not null from concessoes_de_plano where referencia='sub_race'"),'t','Only cancelled subscription grant ends')
  equal(sql(`select plano from profiles where id='${id(2)}'`),'pro','Courtesy survives paid cancellation')
  const old=sql(service(claim('sub_race')))
  sql("update app_private.sincronizacoes_assinatura set tentativa_ate=clock_timestamp()-interval '1 second' where subscription_id='sub_race'")
  const current=sql(service(claim('sub_race')))
  rejects(service(apply('sub_race',old)),'sincronizacao_expirada')
  equal(sql(service(release('sub_race',old))),'f','Old worker cannot release newer token')
  sql(service(apply('sub_race',current,state({status:'canceled'}))))
  const trial=sql(service(claim('sub_trial')))
  sql(service(apply('sub_trial',trial,state({customer:'cus_1',status:'trialing',trial_end:instant(7)}))))
  equal(sql(`select valido_ate='${instant(7)}'::timestamptz from concessoes_de_plano where referencia='sub_trial'`),'t','Trial cannot outlive its own end')
  const foreign=sql(service(claim('sub_trial')))
  rejects(service(apply('sub_trial',foreign,state({customer:'cus_3'}))),'assinatura_de_outro_titular')
  sql(service(release('sub_trial',foreign)))
  const noOwner=sql(service(claim('sub_nobody')))
  rejects(service(apply('sub_nobody',noOwner,state({customer:'cus_missing'}))),'perfil_de_cobranca_indisponivel')
  // Validate expiration AFTER waiting on the profile, not just before waiting.
  const waitingToken=sql(service(claim('sub_wait')))
  const holder=concurrent(`begin; select 1 from profiles where id='${id(5)}' for update; select pg_sleep(1.5); commit;`)
  let sleeping=false
  for(let i=0;i<40;i++) {
    sleeping=sql("select exists(select 1 from pg_stat_activity where wait_event='PgSleep')")==='t'
    if(sleeping)break
    await new Promise(r=>setTimeout(r,25))
  }
  equal(sleeping,true,'Profile lock acquired by fixture')
  sql("update app_private.sincronizacoes_assinatura set tentativa_ate=clock_timestamp()+interval '0.2 seconds' where subscription_id='sub_wait'")
  const waited=await concurrent(service(apply('sub_wait',waitingToken,state({customer:'cus_5'}))))
  await holder
  equal(waited.code!==0&&waited.err.includes('sincronizacao_expirada'),true,'Lease expires while waiting; no stale commit')
  equal(sql("select count(*) from subscriptions where gateway_subscription_id='sub_wait'"),'0','No partial mirror after expiration')
  process.stdout.write(JSON.stringify({passed:checks,database:'PostgreSQL 17',providerCalls:0})+'\n')
} finally {try{docker('rm','-f','-v',container)}catch{/* Only the randomly named fixture container. */}}
