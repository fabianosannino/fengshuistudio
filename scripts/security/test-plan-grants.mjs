/** Atomic grants and key consumption against PostgreSQL 17, no real accounts. */
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
const container = `fss-grants-${randomBytes(5).toString('hex')}`
const image = 'postgres:17-alpine@sha256:18cfe3ef5e6815560c98237d6216d1e5119702fb0f3894c8785dd58b8bbe5d73'
const docker = (...args) => execFileSync('docker',args,{encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim()
const args = ['exec','-i',container,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-qAt']
const sql = input => execFileSync('docker',args,{input,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim()
const concurrent = input => new Promise(resolve => {
  const child = spawn('docker',args,{stdio:['pipe','pipe','pipe']})
  let out='',err=''
  child.stdout.on('data',c=>{out+=c}); child.stderr.on('data',c=>{err+=c})
  child.on('error',e=>resolve({code:-1,err:e.message,out}))
  child.on('close',code=>resolve({code,err,out:out.trim()})); child.stdin.end(input)
})
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const grant = (n,plan,origin,ref) => `select public.alterar_concessao_de_plano('${id(n)}','conceder','${origin}','${ref}','${plan}')`
const activate = (n,key='SYNTHETIC',plan='profissional') => `select public.ativar_chave_de_plano('${id(n)}','${key}','${plan}')`
const service = statement => `set role service_role; ${statement};`
let checks=0
const equal=(a,b,m)=>{assert.deepEqual(a,b,m);checks++}
const rejects=(s,m)=>{assert.throws(()=>sql(s),e=>e.stderr?.includes(m));checks++}
try {
  docker('run','-d','--name',container,'--network','none','-e','POSTGRES_PASSWORD=local-test-only',image)
  let ready=false
  for(let i=0;i<60;i++) {
    try {ready=docker('exec',container,'pg_isready','-h','127.0.0.1','-U','postgres').includes('accepting')} catch { /* startup */ }
    if(ready)break
    await new Promise(r=>setTimeout(r,500))
  }
  assert.ok(ready)
  sql(`create role anon; create role authenticated; create role service_role bypassrls;
    create type plano_tipo as enum('freemium','starter','pro','agencia');
    create table profiles(id uuid primary key,plano plano_tipo not null default 'freemium');
    create table activation_keys(id uuid primary key default gen_random_uuid(),key text not null unique,plan_type text not null,
      status text not null,expires_at timestamptz,used_at timestamptz,used_by uuid references profiles(id),duration_months integer,discount_percent integer);
    create table admin_audit_log(id uuid primary key default gen_random_uuid(),action text not null,target_type text,target_id text,details jsonb,performed_by uuid);
    create table concessoes_de_plano(id uuid primary key default gen_random_uuid(),user_id uuid not null references profiles(id) on delete cascade,
      plano text not null check(plano in('free','simples','profissional')),origem text not null check(origem in('assinatura','chave','cortesia','migracao')),
      referencia text,valido_de timestamptz not null default now(),valido_ate timestamptz,encerrada_em timestamptz,motivo text,criada_por uuid references profiles(id));
    alter table profiles enable row level security; alter table activation_keys enable row level security;
    alter table admin_audit_log enable row level security; alter table concessoes_de_plano enable row level security;
    grant select,insert,update,delete on all tables in schema public to service_role;
    insert into profiles(id) select ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid from generate_series(1,8) n;
    insert into activation_keys(key,plan_type,status) values('SYNTHETIC','pro','available'),('ROLLBACK','pro','available'),('LIMITED','pro','available'),('DISCOUNT','pro','available');
    update activation_keys set duration_months=1 where key='LIMITED';
    update activation_keys set discount_percent=50 where key='DISCOUNT';`)
  sql(readFileSync(new URL('../../supabase/migrations/20260918043003_durable_billing_coordination.sql',import.meta.url),'utf8'))
  for(const role of ['anon','authenticated']) {
    rejects(`set role ${role}; ${activate(1)}`,'permission denied')
    rejects(`set role ${role}; ${grant(1,'profissional','cortesia','forged')}`,'permission denied')
    rejects(`set role ${role}; select public.recalcular_plano_do_perfil('${id(1)}')`,'permission denied')
    rejects(`set role ${role}; select public.renunciar_concessoes_nao_pagas('${id(1)}')`,'permission denied')
  }
  const races=await Promise.all([1,2].map(n=>concurrent(service(`begin; ${activate(n)}; select pg_sleep(1); commit`))))
  equal(races.filter(r=>r.code===0).length,1,'one owner consumes key')
  equal(races.filter(r=>r.err.includes('chave_invalida')).length,1,'other owner denied')
  const winner=races[0].code===0?1:2
  equal(sql('select count(*) from concessoes_de_plano'),'1','one key grant created')
  equal(sql(service(activate(winner))),'profissional','same owner retry returns effective plan')
  equal(sql('select count(*) from admin_audit_log'),'1','retry does not duplicate audit')
  // Audit failure must not consume the key or confer a partial benefit.
  sql("alter table admin_audit_log add constraint fail_audit check(action<>'use_key') not valid")
  rejects(service(activate(3,'ROLLBACK')),'fail_audit')
  equal(sql("select status from activation_keys where key='ROLLBACK'"),'available','consumption rolled back')
  equal(sql(`select plano from profiles where id='${id(3)}'`),'freemium','projection rolled back')
  equal(sql(`select count(*) from concessoes_de_plano where user_id='${id(3)}'`),'0','grant rolled back')
  sql('alter table admin_audit_log drop constraint fail_audit')
  equal(sql(service(activate(3,'ROLLBACK'))),'profissional','retry after failure succeeds')
  rejects(service(activate(4,'DISCOUNT')),'chave_invalida')
  equal(sql(service(activate(4,'LIMITED'))),'profissional','limited key grants benefit')
  equal(sql(`select valido_ate>now()+interval '27 days' and valido_ate<=now()+interval '32 days' from concessoes_de_plano where user_id='${id(4)}'`),'t','duration enforced')
  const validity=sql(`select valido_ate from concessoes_de_plano where user_id='${id(4)}'`)
  sql(service(activate(4,'LIMITED')))
  equal(sql(`select valido_ate from concessoes_de_plano where user_id='${id(4)}'`),validity,'retry never extends duration')
  sql(service(grant(winner,'simples','assinatura','sub_fixture')))
  equal(sql(`select plano from profiles where id='${id(winner)}'`),'pro','lower subscription preserves key')
  sql(service(`select public.alterar_concessao_de_plano('${id(winner)}','encerrar','assinatura','sub_fixture')`))
  equal(sql(`select plano from profiles where id='${id(winner)}'`),'pro','subscription cancellation preserves key')
  rejects(service(grant(5,'profissional','assinatura','sub_fixture')),'referencia_de_outro_titular')
  equal(sql(`select plano from profiles where id='${id(5)}'`),'freemium','reference cannot change owner')
  const grants=await Promise.all(['simples','profissional'].map((plan,i)=>concurrent(service(`begin; ${grant(6,plan,i?'cortesia':'assinatura',`parallel_${i}`)}; select pg_sleep(1); commit`))))
  equal(grants.map(r=>r.code),[0,0],'parallel independent origins both commit')
  equal(sql(`select plano from profiles where id='${id(6)}'`),'pro','projection includes both committed grants')
  sql(service(`select public.renunciar_concessoes_nao_pagas('${id(6)}')`))
  equal(sql(`select plano from profiles where id='${id(6)}'`),'starter','waiver preserves paid entitlement')
  sql(service(`select public.renunciar_concessoes_nao_pagas('${id(winner)}')`))
  equal(sql(service(activate(winner))),'free','used key does not restore a waived grant')
  sql(`update concessoes_de_plano set valido_ate=now()-interval '1 second' where user_id='${id(4)}'`)
  equal(sql(service(`select public.recalcular_plano_do_perfil('${id(4)}')`)),'free','expired key no longer confers plan')
  process.stdout.write(JSON.stringify({passed:checks,database:'PostgreSQL 17',atomicKeyAndGrant:true})+'\n')
} finally { try {docker('rm','-f','-v',container)} catch { /* random task-owned container */ } }
