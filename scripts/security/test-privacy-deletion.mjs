/** RLS writes and deletion guards in PostgreSQL 17. No production data. */
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
const container = `fss-privacy-${randomBytes(5).toString('hex')}`
const image = 'postgres:17-alpine@sha256:18cfe3ef5e6815560c98237d6216d1e5119702fb0f3894c8785dd58b8bbe5d73'
const docker = (...args) => execFileSync('docker',args,{encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim()
const args = ['exec','-i',container,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-qAt']
const sql = input => execFileSync('docker',args,{input,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim()
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const auth = (n,input) => `set role authenticated; set request.jwt.claim.sub='${id(n)}'; ${input};`
const object = (bucket,root,name) => `insert into storage.objects(bucket_id,name) values('${bucket}','${id(root)}/${name}')`
function session(input, open = false) {
  const child = spawn('docker',args,{stdio:['pipe','pipe','pipe']})
  let out='',err=''
  const ready = new Promise((resolve,reject) => { child.stdout.once('data',resolve); child.once('error',reject) })
  const done = new Promise((resolve,reject) => {
    child.stdout.on('data',c=>{out+=c}); child.stderr.on('data',c=>{err+=c})
    child.once('error',reject); child.once('close',code=>resolve({code,out:out.trim(),err}))
  })
  if(open)child.stdin.write(`${input}; select 'ready';\n`); else child.stdin.end(input)
  return { ready, done, commit: () => child.stdin.end('commit;\n') }
}
async function waitForLock(marker) {
  for(let n=0;n<30;n++) {
    if(sql(`select count(*) from pg_stat_activity where application_name='${marker}' and wait_event_type='Lock'`)==='1')return
    await new Promise(r=>setTimeout(r,20))
  }
  throw new Error('Expected concurrent writer/deleter to wait for the parent lock')
}
let checks=0
const equal=(a,b,m)=>{assert.deepEqual(a,b,m);checks++}
const rejects=(s,m)=>{assert.throws(()=>sql(s),e=>e.stderr?.includes(m));checks++}
try {
  docker('run','-d','--name',container,'--network','none','-e','POSTGRES_PASSWORD=local-test-only',image)
  let ready=false
  for(let n=0;n<60;n++) {
    try {ready=docker('exec',container,'pg_isready','-h','127.0.0.1','-U','postgres').includes('accepting')} catch { /* startup */ }
    if(ready)break
    await new Promise(r=>setTimeout(r,500))
  }
  assert.ok(ready)
  sql(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage; create schema app_private;
    create function auth.uid() returns uuid language sql stable as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
    create table profiles(id uuid primary key,stripe_customer_id text,stripe_account_id text);
    create table clientes(id uuid primary key,consultor_id uuid references profiles(id) on delete cascade,titular_id uuid references profiles(id) on delete cascade);
    create table produtos(id uuid primary key,vendedor_perfil_id uuid references profiles(id) on delete restrict);
    create table consultas(id uuid primary key,consultor_id uuid references profiles(id) on delete cascade);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,unique(bucket_id,name));
    alter table storage.objects enable row level security;
    create policy legacy on storage.objects for all to authenticated using(true) with check(true);
    grant usage on schema auth,storage,app_private to authenticated,service_role;
    grant select,insert,update,delete on storage.objects to authenticated,service_role;
    grant select,insert,update,delete on all tables in schema public to service_role;
    insert into profiles(id) select ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid from generate_series(1,12) n;
    insert into clientes(id,consultor_id) values('${id(11)}','${id(1)}');
    insert into consultas values('${id(21)}','${id(1)}');`)
  sql(readFileSync(new URL('../../supabase/migrations/20260918053309_storage_deletion_guards.sql',import.meta.url),'utf8'))
  rejects(`set role authenticated; select iniciar_exclusao_do_titular('${id(6)}')`,'permission denied')
  rejects('set role authenticated; select * from exclusoes_de_conta','permission denied')
  equal(sql(`set role service_role; select iniciar_exclusao_do_titular('${id(6)}')`),'pronto','admit deletion')
  rejects(`set role service_role; update profiles set stripe_customer_id='cus_fixture' where id='${id(6)}'`,'conta_em_exclusao')
  rejects(`set role service_role; update profiles set stripe_account_id='acct_fixture' where id='${id(6)}'`,'conta_em_exclusao')
  sql(`update profiles set stripe_customer_id='cus_fixture' where id='${id(7)}'; insert into produtos values('${id(71)}','${id(8)}'); insert into clientes values('${id(72)}','${id(8)}','${id(9)}')`)
  equal(sql(`set role service_role; select iniciar_exclusao_do_titular('${id(7)}')`),'cobranca','customer needs reconciliation')
  equal(sql(`set role service_role; select iniciar_exclusao_do_titular('${id(8)}')`),'produtos','preserve sold assets')
  equal(sql(`set role service_role; select iniciar_exclusao_do_titular('${id(9)}')`),'vinculos','preserve another consultant client')
  rejects(`delete from profiles where id='${id(7)}'`,'vinculo_comercial_pendente')
  rejects(`delete from profiles where id='${id(9)}'`,'dados_do_titular_pendentes')
  // Checkout binding and deletion admission serialize on the same profile row.
  const opening = session(`begin; update profiles set stripe_customer_id='cus_race' where id='${id(10)}'`,true)
  await opening.ready
  const closing = session(`set application_name='privacy_close'; set role service_role; select iniciar_exclusao_do_titular('${id(10)}');`)
  await waitForLock('privacy_close'); checks++
  opening.commit(); await opening.done
  equal((await closing.done).out,'cobranca','committed customer stops deletion')
  const closingFirst = session(`begin; select iniciar_exclusao_do_titular('${id(11)}')`,true)
  await closingFirst.ready
  const binding = session(`set application_name='privacy_bind'; update profiles set stripe_customer_id='cus_late' where id='${id(11)}';`)
  await waitForLock('privacy_bind'); checks++
  closingFirst.commit(); await closingFirst.done
  equal((await binding.done).err.includes('conta_em_exclusao'),true,'deletion prevents late customer binding')
  rejects("set role anon; select app_private.reservar_titular_do_arquivo('clientes-fotos','anything')",'permission denied')
  rejects(auth(2,object('clientes-fotos',1,'forged.png')),'row-level security')
  rejects(auth(2,object('imoveis-fotos',21,'forged.png')),'row-level security')
  rejects(auth(1,object('imoveis-fotos',99,'missing.png')),'row-level security')
  sql(auth(1,object('clientes-fotos',1,'own.png')))
  sql(auth(1,object('imoveis-fotos',21,'own.png')))
  equal(sql('select count(*) from storage.objects'),'2','own roots accepted; existing permissive policy cannot grant cross-owner')
  rejects(`set role service_role; delete from consultas where id='${id(21)}'`,'arquivos_da_consulta_pendentes')
  rejects(`set role service_role; delete from profiles where id='${id(1)}'`,'dados_do_titular_pendentes')
  sql(`delete from storage.objects; delete from consultas; delete from clientes where consultor_id='${id(1)}'; delete from profiles where id='${id(1)}'`)
  rejects(auth(1,object('clientes-fotos',1,'stale-jwt.png')),'row-level security')
  // Upload first: deletion must wait, then refuse to remove the last owner.
  const upload = session(auth(3,`begin; ${object('clientes-fotos',3,'race.png')}`),true)
  await upload.ready
  const deletion = session(`set application_name='privacy_delete'; delete from profiles where id='${id(3)}';`)
  await waitForLock('privacy_delete'); checks++
  upload.commit(); equal((await upload.done).code,0,'upload commits')
  equal((await deletion.done).err.includes('dados_do_titular_pendentes'),true,'parent retained after waiting for upload')
  equal(sql(`select count(*) from profiles where id='${id(3)}'`),'1','parent remains available for cleanup')
  // Delete first: an in-flight upload cannot recreate an orphan after commit.
  const deleting = session(`begin; delete from profiles where id='${id(4)}'`,true)
  await deleting.ready
  const writer = session(`set application_name='privacy_upload'; ${auth(4,object('clientes-fotos',4,'race.png'))}`)
  await waitForLock('privacy_upload'); checks++
  deleting.commit(); equal((await deleting.done).code,0,'deletion commits')
  equal((await writer.done).err.includes('row-level security'),true,'upload denied after parent deletion')
  equal(sql(`select count(*) from storage.objects where name like '${id(4)}/%'`),'0','no orphan after concurrent upload')
  // The same synchronization applies to consultation folders.
  sql(`insert into consultas values('${id(25)}','${id(5)}')`)
  const imageUpload = session(auth(5,`begin; ${object('imoveis-fotos',25,'race.png')}`),true)
  await imageUpload.ready
  const deleteVisit = session(`set application_name='privacy_visit'; delete from consultas where id='${id(25)}';`)
  await waitForLock('privacy_visit'); checks++
  imageUpload.commit(); await imageUpload.done
  equal((await deleteVisit.done).err.includes('arquivos_da_consulta_pendentes'),true,'consultation retained until files removed')
  // The legacy own-root writes above reproduce the decoder bypass. Close it
  // without relying on mutable metadata that an authenticated caller controls.
  sql(readFileSync(new URL('../../supabase/migrations/20260918091732_validated_storage_writes.sql',import.meta.url),'utf8'))
  sql(auth(5,object('imoveis-fotos',25,'during-rollout.png')))
  equal(sql(`select count(*) from storage.objects where name='${id(25)}/during-rollout.png'`),'1','Preparation migration remains compatible with old endpoints')
  sql(readFileSync(new URL('../../supabase/migrations/20260918092147_require_validated_image_endpoints.sql',import.meta.url),'utf8'))
  sql(`insert into profiles(id) select ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid from generate_series(101,110) n;
    insert into consultas values('${id(201)}','${id(101)}'),('${id(202)}','${id(102)}'),('${id(203)}','${id(103)}');
    grant usage on schema storage to anon; grant select,insert,update on storage.objects to anon;
    create policy future_permissive_policy on storage.objects for all to anon using(true) with check(true);`)
  for (const bucket of ['clientes-fotos','imoveis-fotos','produtos-imagens']) {
    const root=bucket==='imoveis-fotos'?201:101
    rejects(auth(101,object(bucket,root,'direct.png')),'row-level security')
    rejects(`set role anon;${object(bucket,root,'direct.png')}`,'row-level security')
    sql(`set role service_role;${object(bucket,root,'validated.png')}`)
    equal(sql(auth(101,`update storage.objects set name='${id(root)}/replacement.png' where bucket_id='${bucket}' and name='${id(root)}/validated.png' returning id`)),'','Direct update cannot replace decoded object')
    rejects(auth(101,`${object(bucket,root,'validated.png')} on conflict(bucket_id,name) do update set name=excluded.name`),'row-level security')
    equal(sql(auth(101,`select count(*) from storage.objects where bucket_id='${bucket}' and name='${id(root)}/validated.png'`)),'1','Existing read remains available')
    equal(sql(auth(101,`delete from storage.objects where bucket_id='${bucket}' and name='${id(root)}/validated.png' returning id`)),'','Direct delete cannot remove historical images')
  }
  sql(auth(101,object('unrelated',101,'draft.bin')))
  rejects(auth(101,`update storage.objects set bucket_id='clientes-fotos' where bucket_id='unrelated'`),'row-level security')
  equal(sql(auth(101,`update storage.objects set bucket_id='unrelated' where bucket_id='clientes-fotos' returning id`)),'','Moving out does not bypass update guard')
  rejects(`set role service_role;${object('clientes-fotos',999,'missing.png')}`,'raiz_de_arquivo_indisponivel')
  rejects(`set role service_role;${object('imoveis-fotos',999,'missing.png')}`,'raiz_de_arquivo_indisponivel')
  rejects(`set role service_role;insert into storage.objects(bucket_id,name) values('relatorios','bad/root.pdf')`,'raiz_de_arquivo_invalida')
  rejects(`set role service_role;${object('clientes-fotos',6,'deleted.png')}`,'conta_em_exclusao')
  sql(`set role service_role;${object('relatorios',201,'emissao.pdf')}`)
  equal(sql(`select count(*) from storage.objects where bucket_id='relatorios' and name='${id(201)}/emissao.pdf'`),'1','Report service upload keeps its valid owner')
  const serviceUpload=session(`set role service_role;begin;${object('clientes-fotos',104,'race.png')}`,true)
  await serviceUpload.ready
  const admission=session(`set role service_role;set application_name='service_deletion'; select iniciar_exclusao_do_titular('${id(104)}')`)
  await waitForLock('service_deletion');checks++
  serviceUpload.commit();equal((await serviceUpload.done).code,0,'Service upload commits before deletion admission')
  equal((await admission.done).out,'pronto','Deletion begins after committed upload is inventoryable')
  rejects(`set role service_role;${object('clientes-fotos',104,'later.png')}`,'conta_em_exclusao')
  const admitting=session(`set role service_role;begin;select iniciar_exclusao_do_titular('${id(105)}')`,true)
  await admitting.ready
  const serviceWriter=session(`set role service_role;set application_name='service_writer';${object('clientes-fotos',105,'late.png')}`)
  await waitForLock('service_writer');checks++
  admitting.commit();await admitting.done
  equal((await serviceWriter.done).err.includes('conta_em_exclusao'),true,'In-flight writer sees committed deletion intent')
  const removingParent=session(`begin;delete from consultas where id='${id(202)}'`,true)
  await removingParent.ready
  const lateReport=session(`set role service_role;set application_name='late_report';${object('relatorios',202,'late.pdf')}`)
  await waitForLock('late_report');checks++
  removingParent.commit();await removingParent.done
  equal((await lateReport.done).err.includes('raiz_de_arquivo_indisponivel'),true,'Report upload cannot recreate an orphan after consultation deletion')
  equal(sql(`select count(*) from storage.objects where name in('${id(105)}/late.png','${id(202)}/late.pdf')`),'0','No orphan metadata remains')
  process.stdout.write(JSON.stringify({passed:checks,database:'PostgreSQL 17',concurrentDeletion:true,storageApiTested:false})+'\n')
} finally { try {docker('rm','-f','-v',container)} catch { /* Only the random task-owned container. */ } }
