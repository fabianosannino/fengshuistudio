import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
const container=`fss-shop-refund-${randomBytes(5).toString('hex')}`
const image='postgres:17-alpine@sha256:18cfe3ef5e6815560c98237d6216d1e5119702fb0f3894c8785dd58b8bbe5d73'
const docker=(...args)=>execFileSync('docker',args,{encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim()
const args=['exec','-i',container,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-qAt']
const sql=input=>execFileSync('docker',args,{input,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim()
const concurrent=input=>new Promise((resolve,reject)=>{const p=spawn('docker',args,{stdio:['pipe','pipe','pipe']});let out='',err='';p.stdout.on('data',c=>{out+=c});p.stderr.on('data',c=>{err+=c});p.on('error',reject);p.on('close',code=>resolve({code,out:out.trim(),err}));p.stdin.end(input)})
const migration=name=>readFileSync(new URL(`../../supabase/migrations/${name}.sql`,import.meta.url),'utf8')
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const claim=n=>sql(`set role service_role; select reservar_sincronizacao_financeira('pedido:${id(n)}')`)
const release=(n,token)=>sql(`set role service_role; select liberar_sincronizacao_financeira('pedido:${id(n)}','${token}')`)
const refund=(over={})=>({id:'re_1',centavos:500,status:'succeeded',criado_em:'2026-09-18T01:00:00Z',...over})
const state=(over={})=>({account:null,payment_intent:'pi_1',charge:'ch_1',moeda:'brl',vendedor_tipo:'plataforma',vendedor_perfil_id:null,pago_centavos:2000,comissao_centavos:0,reembolsos:[refund()],estornos_comissao:[],...over})
const apply=(n,token,data=state())=>`select aplicar_reembolsos_pedido('${id(n)}','${token}','${JSON.stringify(data).replaceAll("'","''")}'::jsonb)`
const sync=(n,data=state())=>JSON.parse(sql(`set role service_role; ${apply(n,claim(n),data)}`))
const net=n=>sql(`select coalesce(sum(case when recebedor='comprador' then valor_centavos else -valor_centavos end),0) from pedido_lancamentos where pedido_id='${id(n)}' and tipo='reembolso'`)
let checks=0
const equal=(a,b,msg)=>{assert.deepEqual(a,b,msg);checks++}
const rejects=(s,msg)=>{assert.throws(()=>sql(s),e=>e.stderr?.includes(msg));checks++}
try {
  docker('run','-d','--name',container,'--network','none','-e','POSTGRES_PASSWORD=local-test-only',image)
  let ready=false
  for(let i=0;i<60;i++){try{ready=docker('exec',container,'pg_isready','-h','127.0.0.1','-U','postgres').includes('accepting')}catch{/* Startup. */}if(ready)break;await new Promise(r=>setTimeout(r,500))}
  assert.ok(ready)
  // Only financial-claim dependencies of the earlier migration are exercised here.
  sql(`create role anon;create role authenticated;create role service_role bypassrls;create schema app_private;
    create table profiles(id uuid primary key,stripe_customer_id text);
    create table invoices(id uuid primary key,gateway_invoice_id text,refund_amount numeric,status text);
    create table disputas_stripe(id text primary key);
    create table exclusoes_de_conta(user_id uuid primary key references profiles(id));
    create table pedidos(id uuid primary key,stripe_payment_intent text,stripe_account_id text,vendedor_tipo text not null,
      vendedor_perfil_id uuid references profiles(id),moeda text not null,total_centavos integer not null check(total_centavos>=0),
      taxa_plataforma_centavos integer not null check(taxa_plataforma_centavos>=0));
    create table pedido_lancamentos(id uuid primary key default gen_random_uuid(),pedido_id uuid not null references pedidos(id),
      tipo text not null,valor_centavos integer not null check(valor_centavos>0),pagador text not null,recebedor text not null check(pagador<>recebedor),
      origem text not null,referencia text,motivo text,ocorrido_em timestamptz not null default now(),criado_em timestamptz default now());
    create unique index idx_pedido_lancamentos_idempotencia on pedido_lancamentos(pedido_id,tipo,referencia) where referencia is not null;
    create table pedido_eventos(id uuid primary key default gen_random_uuid(),pedido_id uuid not null references pedidos(id),
      evento text not null constraint pedido_eventos_evento_check check(evento in('iniciado','pago','reembolsado')),origem text not null,
      referencia text,motivo text,dados jsonb,ocorrido_em timestamptz default now(),criado_em timestamptz default now());
    create unique index idx_pedido_eventos_idempotencia on pedido_eventos(pedido_id,evento,referencia) where referencia is not null;
    alter table pedidos enable row level security;alter table pedido_lancamentos enable row level security;alter table pedido_eventos enable row level security;
    grant select,insert,update,delete on all tables in schema public to service_role;
    insert into profiles values('${id(1)}','cus_1');
    insert into pedidos select ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'pi_'||n,null,'plataforma',null,'brl',2000,0 from generate_series(1,6) n;
    update pedidos set vendedor_tipo='consultor',vendedor_perfil_id='${id(1)}',stripe_account_id='acct_1',taxa_plataforma_centavos=200 where id='${id(2)}';`)
  const original=migration('20260813050000_pedidos_da_loja')
  const immutable=original.match(/create or replace function public\.pedido_eventos_somente_insere\(\)[\s\S]+?\$\$;/)?.[0]
  assert.ok(immutable)
  sql(`${immutable}
    create trigger fixture_immutable_ledger before update or delete on pedido_lancamentos for each row execute function public.pedido_eventos_somente_insere();
    create trigger fixture_immutable_events before update or delete on pedido_eventos for each row execute function public.pedido_eventos_somente_insere();`)
  sql(migration('20260918080931_atomic_financial_projection'))
  sql(migration('20260918084033_atomic_shop_refund_projection'))
  for(const role of ['anon','authenticated']) {
    rejects(`set role ${role};${apply(1,id(1))}`,'permission denied')
    rejects(`set role ${role};select * from app_private.projecoes_reembolso_pedido`,'permission denied')
    rejects(`set role ${role};select * from app_private.vinculos_reembolso_pedido`,'permission denied')
  }
  // Original cumulative writer: 500 followed by cumulative 1000 invents 500.
  sql(`insert into pedido_lancamentos(pedido_id,tipo,valor_centavos,pagador,recebedor,origem,referencia)
    values('${id(1)}','reembolso',500,'plataforma','comprador','webhook_stripe','evt_1'),('${id(1)}','reembolso',1000,'plataforma','comprador','webhook_stripe','evt_2')`)
  equal(net(1),'1500','Legacy cumulative double-count reproduced')
  const full=state({reembolsos:[refund(),refund({id:'re_2'})]})
  equal(sync(1,full).confirmado_centavos,1000,'Complete snapshot contains actual refunds')
  equal(net(1),'1000','Append-only correction removes invented money from the net')
  equal(sql(`select count(*) from pedido_lancamentos where pedido_id='${id(1)}'`),'3','Both originals and correction preserved')
  equal(sql(`select valor_centavos||':'||pagador||':'||recebedor from pedido_lancamentos where pedido_id='${id(1)}' and origem='sistema'`),'500:comprador:plataforma','Correction reverses the accounting direction only')
  equal(sync(1,full).versao,1,'Retry does not add a revision or financial effect')
  equal(sql(`select count(*) from pedido_eventos where pedido_id='${id(1)}'`),'1','One complete financial observation')
  rejects(`update pedido_lancamentos set valor_centavos=1 where referencia='evt_1'`,'append-only')
  const pending=state({payment_intent:'pi_3',charge:'ch_3',reembolsos:[refund({id:'re_3',status:'pending'})]})
  equal(sync(3,pending).pendente_centavos,500,'Pending amount is explicit')
  equal(net(3),'0','Pending does not register money returned')
  sync(3,{...pending,reembolsos:[refund({id:'re_3',status:'failed'})]})
  equal(net(3),'0','Failed refund stays zero')
  sync(3,{...pending,reembolsos:[refund({id:'re_3'})]})
  equal(net(3),'500','Success contributes once')
  sync(3,{...pending,reembolsos:[refund({id:'re_3',status:'failed'})]})
  equal(net(3),'0','Later authoritative failure is accounted for without deleting history')
  const connected=state({account:'acct_1',payment_intent:'pi_2',charge:'ch_2',vendedor_tipo:'consultor',vendedor_perfil_id:id(1),comissao_centavos:200,
    reembolsos:[refund({id:'re_connect',centavos:2000})],estornos_comissao:[{id:'fr_1',centavos:200,criado_em:'2026-09-18T01:00:00Z'}]})
  sync(2,connected)
  equal(sql(`select valor_centavos||':'||pagador||':'||recebedor from pedido_lancamentos where pedido_id='${id(2)}' and tipo='estorno_comissao'`),'200:plataforma:consultor','Fee reversal returns to the actual seller')
  equal(sync(2,connected).versao,1,'Fee refund also deduplicates')
  const busy=claim(1)
  equal(claim(1),'','Other worker cannot read concurrently')
  rejects(`set role service_role;${apply(1,busy,state())}`,'reembolso_omitido_ou_alterado')
  rejects(`set role service_role;${apply(1,busy,{...full,account:'acct_other'})}`,'pedido_financeiro_incompativel')
  release(1,busy)
  const stolen=claim(4)
  rejects(`set role service_role;${apply(4,stolen,state({payment_intent:'pi_4',charge:'ch_4'}))}`,'reembolso_de_outro_pedido')
  equal(net(4),'0','Global refund identity conflict rolls back all changes')
  release(4,stolen)
  const invalid=claim(5)
  for(const over of [{pago_centavos:2001},{pago_centavos:0.5},{comissao_centavos:100},{vendedor_tipo:'consultor'},{moeda:'usd'}])
    rejects(`set role service_role;${apply(5,invalid,state({payment_intent:'pi_5',charge:'ch_5',...over}))}`,over.pago_centavos?'valor_pago_incompativel':over.comissao_centavos?'comissao_incompativel':'pedido_financeiro_incompativel')
  rejects(`set role service_role;${apply(5,invalid,state({payment_intent:'pi_5',charge:'ch_5',reembolsos:[refund({centavos:2000}),refund({id:'re_extra'})]}))}`,'reembolso_superior_ao_pago')
  equal(net(5),'0','Invalid source does not change ledger')
  release(5,invalid)
  // Late failure of the event write must roll back the ledger and the identity binding.
  sql(`create function app_private.reject_fixture_event() returns trigger language plpgsql as $$begin if new.pedido_id='${id(6)}'::uuid then raise exception 'fixture_event_failure';end if;return new;end$$;
    create trigger fixture_reject_event before insert on pedido_eventos for each row execute function app_private.reject_fixture_event();`)
  const rollback=claim(6)
  rejects(`set role service_role;${apply(6,rollback,state({payment_intent:'pi_6',charge:'ch_6',reembolsos:[refund({id:'re_rollback'})]}))}`,'fixture_event_failure')
  equal(net(6),'0','Event failure rolls back ledger')
  equal(sql("select count(*) from app_private.vinculos_reembolso_pedido where refund_id='re_rollback'"),'0','Event failure rolls back global identity')
  release(6,rollback)
  const expired=claim(1)
  sql(`update app_private.sincronizacoes_financeiras set tentativa_ate=clock_timestamp()-interval '1 second' where recurso='pedido:${id(1)}'`)
  const fresh=claim(1)
  rejects(`set role service_role;${apply(1,expired,full)}`,'sincronizacao_financeira_expirada')
  equal(release(1,expired),'f','Old worker cannot release fresh claim')
  release(1,fresh)
  const waiting=claim(1)
  const holder=concurrent(`begin;select 1 from pedidos where id='${id(1)}' for update;select pg_sleep(1.5);commit`)
  let locked=false
  for(let i=0;i<40;i++){locked=sql("select exists(select 1 from pg_stat_activity where wait_event='PgSleep')")==='t';if(locked)break;await new Promise(r=>setTimeout(r,25))}
  equal(locked,true,'Fixture holds order lock')
  sql(`update app_private.sincronizacoes_financeiras set tentativa_ate=clock_timestamp()+interval '0.2 seconds' where recurso='pedido:${id(1)}'`)
  const waited=await concurrent(`set role service_role;${apply(1,waiting,full)}`);await holder
  equal(waited.code!==0&&waited.err.includes('sincronizacao_financeira_expirada'),true,'Expiry during order lock cannot commit')
  equal(net(1),'1000','Expired waiter preserves the financial net')
  process.stdout.write(JSON.stringify({passed:checks,database:'PostgreSQL 17',providerCalls:0})+'\n')
}finally{try{docker('rm','-f','-v',container)}catch{/* Only owned disposable fixture container. */}}
