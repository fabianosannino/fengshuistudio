/** Financial projection/fencing invariants on isolated PostgreSQL; no provider calls. */
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
const container = `fss-finance-${randomBytes(5).toString('hex')}`
const image = 'postgres:17-alpine@sha256:18cfe3ef5e6815560c98237d6216d1e5119702fb0f3894c8785dd58b8bbe5d73'
const docker = (...args) => execFileSync('docker', args, { encoding:'utf8',stdio:['pipe','pipe','pipe'] }).trim()
const args = ['exec','-i',container,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-qAt']
const sql = input => execFileSync('docker',args,{input,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim()
const concurrent = input => new Promise((resolve,reject) => {
  const child = spawn('docker',args,{stdio:['pipe','pipe','pipe']});let out='',err=''
  child.stdout.on('data',c=>{out+=c});child.stderr.on('data',c=>{err+=c});child.on('error',reject)
  child.on('close',code=>resolve({code,out:out.trim(),err}));child.stdin.end(input)
})
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const state = (over={}) => ({ customer:'cus_1',subscription:null,moeda:'brl',total_centavos:2000,pago_centavos:2000,status:'paid',
  vencimento:'2026-09-18',paga_em:'2026-09-18T00:00:00Z',reembolsos:[],...over })
const refund = (over={}) => ({id:'re_1',charge:'ch_1',centavos:500,status:'succeeded',criado_em:'2026-09-18T01:00:00Z',...over})
const dispute = (over={}) => ({customer:'cus_1',charge:'ch_1',moeda:'brl',centavos:2000,status:'needs_response',motivo:'general',
  aberta_em:'2026-09-18T00:00:00Z',responder_ate:'2026-09-25T00:00:00Z',event_id:'evt_1',...over})
const claim = resource => `select reservar_sincronizacao_financeira('${resource}')`
const release = (resource,token) => `select liberar_sincronizacao_financeira('${resource}','${token}')`
const apply = (resource,token,data=state()) => `select ${resource.startsWith('in_')?'aplicar_fatura_stripe':'aplicar_disputa_stripe'}('${resource}','${token}','${JSON.stringify(data).replaceAll("'","''")}'::jsonb)`
const service = statement => `set role service_role; ${statement};`
const migration = readFileSync(new URL('../../supabase/migrations/20260918080931_atomic_financial_projection.sql',import.meta.url),'utf8')
let checks=0
const equal=(a,b,m)=>{assert.deepEqual(a,b,m);checks++}
const rejects=(statement,message)=>{assert.throws(()=>sql(statement),e=>e.stderr?.includes(message));checks++}
const sync=(resource,data)=>sql(service(apply(resource,sql(service(claim(resource))),data)))
try {
  docker('run','-d','--name',container,'--network','none','-e','POSTGRES_PASSWORD=local-test-only',image)
  let ready=false
  for(let i=0;i<60;i++){try{ready=docker('exec',container,'pg_isready','-h','127.0.0.1','-U','postgres').includes('accepting')}catch{/* Startup. */}
    if(ready)break;await new Promise(r=>setTimeout(r,500))}
  assert.ok(ready)
  sql(`create role anon;create role authenticated;create role service_role bypassrls;create schema app_private;
    create table profiles(id uuid primary key,stripe_customer_id text);
    create table subscriptions(id uuid primary key,user_id uuid not null references profiles(id),gateway_subscription_id text unique);
    create table exclusoes_de_conta(user_id uuid primary key references profiles(id));
    create table invoices(id uuid primary key default gen_random_uuid(),user_id uuid not null references profiles(id),subscription_id uuid references subscriptions(id),
      amount numeric(10,2) not null,amount_paid numeric(10,2),status text not null,due_date date not null,paid_at timestamptz,
      paid_manually boolean default false,gateway_invoice_id text,description text,billing_cycle text,refund_amount numeric(10,2),refunded_at timestamptz);
    create table disputas_stripe(id text primary key,charge_id text not null,customer_id text,user_id uuid references profiles(id),valor numeric(10,2) not null,
      moeda text not null default 'brl',status text not null,motivo text,responder_ate timestamptz,aberta_em timestamptz not null,fechada_em timestamptz,desfecho text,event_id text,atualizada_em timestamptz not null default now());
    create table payment_notifications(id uuid primary key default gen_random_uuid(),user_id uuid not null references profiles(id),invoice_id uuid references invoices(id),
      type text not null,channel text not null,sent_at timestamptz,content text,referencia_evento text,unique(user_id,type,referencia_evento));
    alter table invoices enable row level security;alter table disputas_stripe enable row level security;alter table payment_notifications enable row level security;
    grant select,insert,update,delete on all tables in schema public to service_role;
    insert into profiles values('${id(1)}','cus_1'),('${id(2)}','cus_2');`)
  // Reproduce the old writer: a late paid event erases full-refund status.
  sql(`insert into invoices(user_id,amount,amount_paid,status,due_date,gateway_invoice_id,refund_amount)
    values('${id(1)}',20,20,'refunded','2026-09-18','in_baseline',20);update invoices set status='paid' where gateway_invoice_id='in_baseline';`)
  equal(sql("select status||':'||refund_amount from invoices where gateway_invoice_id='in_baseline'"),'paid:20.00','Baseline regression reproduced')
  rejects(`begin;${migration}commit;`,'reembolsos_legados_requerem_reconciliacao')
  equal(sql("select to_regclass('app_private.sincronizacoes_financeiras') is null"),'t','Unsafe legacy backfill rolls back')
  sql("delete from invoices where gateway_invoice_id='in_baseline'")
  sql(`insert into invoices(user_id,amount,amount_paid,status,due_date,gateway_invoice_id)
    select '${id(1)}',20,20,'paid','2026-09-18','in_duplicate' from generate_series(1,2)`)
  rejects(`begin;${migration}commit;`,'could not create unique index')
  equal(sql("select count(*) from invoices where gateway_invoice_id='in_duplicate'"),'2','Ambiguous legacy invoices are preserved for explicit reconciliation')
  sql("delete from invoices where gateway_invoice_id='in_duplicate'")
  sql(migration)
  for(const role of ['anon','authenticated']) {
    rejects(`set role ${role};${claim('in_acl')}`,'permission denied')
    rejects(`set role ${role};${release('in_acl',id(1))}`,'permission denied')
    rejects(`set role ${role};${apply('in_acl',id(1))}`,'permission denied')
    rejects(`set role ${role};${apply('dp_acl',id(1),dispute())}`,'permission denied')
    rejects(`set role ${role};select * from app_private.sincronizacoes_financeiras`,'permission denied')
    rejects(`set role ${role};select * from app_private.vinculos_reembolso`,'permission denied')
  }
  const races=await Promise.all([1,2].map(()=>concurrent(service(`begin;${claim('in_race')};select pg_sleep(0.3);commit`))))
  equal(races.every(r=>r.code===0),true,'Concurrent calls complete')
  const winners=races.filter(r=>r.out.split('\n').some(l=>/^[a-f0-9-]{36}$/.test(l)))
  equal(winners.length,1,'Only one fresh reader admitted')
  const token=winners[0].out.split('\n').find(l=>/^[a-f0-9-]{36}$/.test(l))
  sql(service(apply('in_race',token,state({reembolsos:[refund({centavos:2000})]}))))
  equal(sql("select status||':'||refund_amount from invoices where gateway_invoice_id='in_race'"),'refunded:20.00','Full refund reflected despite paid invoice state')
  sync('in_race',state({reembolsos:[refund({centavos:2000})]}))
  equal(sql("select count(*) from invoices where gateway_invoice_id='in_race'"),'1','Repeated paid event never duplicates invoice')
  equal(sql("select count(*) from payment_notifications where referencia_evento='re_1'"),'1','Different events never duplicate refund notice')
  const missing=sql(service(claim('in_race')))
  rejects(service(apply('in_race',missing)),'reembolso_ausente_ou_incompativel')
  rejects(service(apply('in_race',missing,state({reembolsos:[refund({centavos:1000})]}))),'reembolso_ausente_ou_incompativel')
  sql(service(release('in_race',missing)))
  sync('in_partial',state({reembolsos:[refund({id:'re_partial'})]}))
  equal(sql("select status||':'||refund_amount from invoices where gateway_invoice_id='in_partial'"),'paid:5.00','Partial refund keeps paid gross and a separate net adjustment')
  sync('in_pending',state({reembolsos:[refund({id:'re_pending',status:'pending'})]}))
  equal(sql("select refund_amount from invoices where gateway_invoice_id='in_pending'"),'0.00','Pending refund is not money returned')
  equal(sql("select count(*) from payment_notifications where referencia_evento='re_pending'"),'0','Pending refund has no success notice')
  sync('in_pending',state({reembolsos:[refund({id:'re_pending',status:'failed'})]}))
  equal(sql("select stripe_reembolsos->0->>'status' from invoices where gateway_invoice_id='in_pending'"),'failed','Failed refund retained as a distinct state')
  sync('in_pending',state({reembolsos:[refund({id:'re_pending',status:'succeeded'})]}))
  equal(sql("select refund_amount from invoices where gateway_invoice_id='in_pending'"),'5.00','Current confirmed state counts once')
  const old=sql(service(claim('in_race')))
  sql("update app_private.sincronizacoes_financeiras set tentativa_ate=clock_timestamp()-interval '1 second' where recurso='in_race'")
  const current=sql(service(claim('in_race')))
  rejects(service(apply('in_race',old)),'sincronizacao_financeira_expirada')
  equal(sql(service(release('in_race',old))),'f','Expired worker cannot release a newer claim')
  sql(service(release('in_race',current)))
  const invalid=sql(service(claim('in_invalid')))
  for(const over of [{moeda:'usd'},{pago_centavos:1.5},{pago_centavos:-1},{total_centavos:1e10},{status:'unknown'},{paga_em:null}])
    rejects(service(apply('in_invalid',invalid,state(over))),'fatura_invalida')
  rejects(service(apply('in_invalid',invalid,state({reembolsos:[refund({centavos:3000})]}))),'estorno_superior_ao_pagamento')
  rejects(service(apply('in_invalid',invalid,state({reembolsos:[refund(),refund()]}))),'reembolso_invalido')
  rejects(service(apply('in_invalid',invalid,state({reembolsos:[refund({status:'unknown'})]}))),'reembolso_invalido')
  equal(sql("select count(*) from invoices where gateway_invoice_id='in_invalid'"),'0','Invalid input has no partial writes')
  sql(service(release('in_invalid',invalid)))
  const foreign=sql(service(claim('in_partial')))
  rejects(service(apply('in_partial',foreign,state({customer:'cus_2'}))),'fatura_incompativel')
  sql(service(release('in_partial',foreign)))
  const stolenRefund=sql(service(claim('in_stolen')))
  rejects(service(apply('in_stolen',stolenRefund,state({customer:'cus_2',reembolsos:[refund()]}))),'reembolso_de_outra_fatura')
  equal(sql("select count(*) from invoices where gateway_invoice_id='in_stolen'"),'0','Refund identity cannot transfer across owners/invoices')
  sql(service(release('in_stolen',stolenRefund)))
  const unknown=sql(service(claim('in_unknown')))
  rejects(service(apply('in_unknown',unknown,state({customer:'cus_absent'}))),'query returned no rows')
  sql(service(release('in_unknown',unknown)))
  sql(`insert into exclusoes_de_conta values('${id(2)}')`)
  const deleting=sql(service(claim('in_deleting')))
  rejects(service(apply('in_deleting',deleting,state({customer:'cus_2'}))),'conta_em_exclusao')
  sql(service(release('in_deleting',deleting)))
  sql('delete from exclusoes_de_conta')
  sql("update invoices set paid_manually=true where gateway_invoice_id='in_partial'")
  const manual=sql(service(claim('in_partial')))
  rejects(service(apply('in_partial',manual)),'fatura_incompativel')
  sql(service(release('in_partial',manual)))
  // Secondary financial notice is inside the same transaction, never a false success.
  sql(`create function app_private.reject_notice() returns trigger language plpgsql as $$begin
    if new.referencia_evento='re_rollback' then raise exception 'fixture_notice_failure';end if;return new;end$$;
    create trigger fixture_notice before insert on payment_notifications for each row execute function app_private.reject_notice();`)
  const rollback=sql(service(claim('in_rollback')))
  rejects(service(apply('in_rollback',rollback,state({reembolsos:[refund({id:'re_rollback'})]}))),'fixture_notice_failure')
  equal(sql("select count(*) from invoices where gateway_invoice_id='in_rollback'"),'0','Notification failure rolls back invoice too')
  equal(sql("select count(*) from app_private.vinculos_reembolso where refund_id='re_rollback'"),'0','Identity binding also rolls back')
  sql(service(release('in_rollback',rollback)))
  sync('dp_1',dispute())
  equal(sql("select fechada_em is null from disputas_stripe where id='dp_1'"),'t','Open dispute has no invented closing time')
  for(const status of ['won','lost','warning_closed','prevented']) {
    sync('dp_1',dispute({status}))
    equal(sql("select desfecho from disputas_stripe where id='dp_1'"),status,'All terminal statuses recognized')
  }
  sync('dp_1',dispute({status:'lost'}))
  equal(sql("select count(*) from payment_notifications where referencia_evento='dp_1'"),'1','Lost-dispute notice deduplicated')
  const theft=sql(service(claim('dp_1')))
  rejects(service(apply('dp_1',theft,dispute({customer:'cus_2'}))),'disputa_de_outro_titular')
  sql(service(release('dp_1',theft)))
  sync('dp_guest',dispute({customer:null}))
  equal(sql("select user_id is null from disputas_stripe where id='dp_guest'"),'t','Known guest remains unassigned')
  // Expiry must be checked again after waiting for the owner row.
  const waiting=sql(service(claim('in_wait')))
  const holder=concurrent(`begin;select 1 from profiles where id='${id(2)}' for update;select pg_sleep(1.5);commit;`)
  let sleeping=false
  for(let i=0;i<40;i++){sleeping=sql("select exists(select 1 from pg_stat_activity where wait_event='PgSleep')")==='t';if(sleeping)break;await new Promise(r=>setTimeout(r,25))}
  equal(sleeping,true,'Fixture owns the profile lock')
  sql("update app_private.sincronizacoes_financeiras set tentativa_ate=clock_timestamp()+interval '0.2 seconds' where recurso='in_wait'")
  const waited=await concurrent(service(apply('in_wait',waiting,state({customer:'cus_2'}))))
  await holder
  equal(waited.code!==0&&waited.err.includes('sincronizacao_financeira_expirada'),true,'Lease expires during owner wait')
  equal(sql("select count(*) from invoices where gateway_invoice_id='in_wait'"),'0','Expired waiter cannot write')
  process.stdout.write(JSON.stringify({passed:checks,database:'PostgreSQL 17',providerCalls:0})+'\n')
}finally{try{docker('rm','-f','-v',container)}catch{/* Only the randomly named fixture container. */}}
