/** Integration regression: PostgreSQL + PostgREST + signed synthetic JWTs.
 * Docker containers have random names, isolated networking and no host DB port.
 * Production URLs/keys are neither read nor accepted by this runner.
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHmac, randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
const prefix = `fss-auth-${randomBytes(5).toString('hex')}`
const db = `${prefix}-db`
const rest = `${prefix}-rest`
// Pin the tested artifacts so CI does not silently change its database/API.
const postgresImage = 'postgres:17-alpine@sha256:18cfe3ef5e6815560c98237d6216d1e5119702fb0f3894c8785dd58b8bbe5d73'
const postgrestImage = 'public.ecr.aws/supabase/postgrest:v16.1@sha256:5922bde07147b82b1c9d8f749e48c1e5b99ebb233f3888bb7ab65f07cf4ac82d'
const secret = randomBytes(48).toString('hex')
const actor = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
const sql = statement => execFileSync('docker', ['exec','-i',db,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-qAt'], { input: statement, encoding:'utf8', stdio:['pipe','pipe','pipe'] }).trim()
const source = path => readFileSync(new URL(`../../${path}`, import.meta.url),'utf8')
const token = (n, aal='aal1', role='authenticated') => {
  const header = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')
  const payload = Buffer.from(JSON.stringify({role,sub:actor(n),aal,exp:Math.floor(Date.now()/1000)+600})).toString('base64url')
  const signed = `${header}.${payload}`
  return `${signed}.${createHmac('sha256',secret).update(signed).digest('base64url')}`
}
let base
let checks = 0
async function request(path, n, { method='GET', body, aal='aal1', role='authenticated' }={}) {
  const response = await fetch(`${base}/${path}`, {
    method, headers:{Authorization:`Bearer ${token(n,aal,role)}`, 'Content-Type':'application/json', Prefer:'return=representation'},
    body: body === undefined ? undefined : JSON.stringify(body), signal:AbortSignal.timeout(10000),
  })
  const data = await response.json().catch(()=>null)
  return {status:response.status, data}
}
function denied(result, name) { assert.ok([401,403].includes(result.status), `${name}: ${JSON.stringify(result)}`); checks++ }
function ok(value, expected, name) { assert.deepEqual(value,expected,name); checks++ }
async function eventually(check) {
  for(let attempt=0;attempt<60;attempt++) {
    try { if(await check()) return } catch { /* The disposable service is starting. */ }
    await new Promise(resolve=>setTimeout(resolve,500))
  }
  throw new Error('Disposable service did not become ready')
}
try {
  docker('network','create',prefix)
  docker('run','-d','--name',db,'--network',prefix,'-e','POSTGRES_PASSWORD=local-test-only',postgresImage)
  await eventually(()=>docker('exec',db,'pg_isready','-U','postgres').includes('accepting'))
  sql(source('supabase/tests/fixtures/authorization-baseline.sql'))
  sql(source('supabase/tests/fixtures/legacy-owner-policies.sql'))
  sql(source('supabase/migrations/20260724_restore_handle_new_user.sql'))
  sql(`insert into auth.users(id,email) select ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'fixture-'||n||'@example.invalid' from generate_series(1,6) n;
    update profiles set role='admin',capacidades_admin=array['chaves:ler','auditoria:ler','relatorios:ler'] where id='${actor(3)}';
    update profiles set role='admin' where id='${actor(4)}';
    insert into activation_keys(code) values('SYNTHETIC'); insert into admin_audit_log(action) values('fixture');
    insert into subscriptions(user_id) values('${actor(1)}'),('${actor(2)}');
    insert into invoices(user_id) values('${actor(1)}'),('${actor(2)}');
    insert into concessoes_de_plano(user_id) values('${actor(1)}'),('${actor(2)}');`)
  const ownerRelations = {
    clientes:'consultor_id', consultas:'consultor_id', consultor_checklist_chi_custom:'consultor_id',
    consultor_curas_custom:'consultor_id', pagamentos:'consultor_id', rituais:'consultor_id',
    notificacoes:'usuario_id', servicos_do_parceiro:'perfil_id', cronograma_lunar:'consulta_id',
    diagnostico_snapshots:'consulta_id', fotos_consulta:'consulta_id', prescricoes:'consulta_id',
    setores_bagua:'consulta_id', diagnostico_criterios:'setor_id', pedidos:'vendedor_perfil_id',
    pedido_eventos:'pedido_id', pedido_itens:'pedido_id', pedido_lancamentos:'pedido_id',
  }
  for(const [table,column] of Object.entries(ownerRelations)) {
    sql(`insert into ${table}(id,${column}) values('${actor(1)}','${actor(1)}'),('${actor(2)}','${actor(2)}');`)
  }
  sql(`insert into payment_notifications(id,user_id,content) values('${actor(1)}','${actor(1)}','fixture');
    insert into plans(id,slug) values('${actor(1)}','free'); insert into produtos_afiliados(id,nome) values('${actor(1)}','fixture');`)
  docker('run','-d','--name',rest,'--network',prefix,'-p','127.0.0.1::3000',
    '-e',`PGRST_DB_URI=postgres://authenticator:local-test-only@${db}:5432/postgres`,
    '-e','PGRST_DB_SCHEMAS=public','-e','PGRST_DB_ANON_ROLE=anon','-e',`PGRST_JWT_SECRET=${secret}`,
    postgrestImage)
  base = `http://${docker('port',rest,'3000/tcp')}`
  await eventually(async()=>(await request('profiles?select=id',1)).status===200)
  // Reproduce the original paths against synthetic identities only.
  ok((await request(`profiles?id=eq.${actor(6)}`,6,{method:'DELETE'})).status,200,'baseline deletion')
  ok((await request('profiles',6,{method:'POST',body:{id:actor(6),nome_completo:'fixture',role:'admin',status:'ativo',plano:'pro'}})).status,201,'baseline escalation by reinsertion')
  ok((await request('activation_keys',4)).data.length,1,'baseline admin without capability/AAL2')
  ok((await request(`profiles?id=eq.${actor(1)}`,1,{method:'PATCH',body:{loja_ativa:true}})).status,200,'baseline self-activation')
  ok((await request('clientes',4)).data.length,2,'baseline cross-tenant admin access')
  sql(`update profiles set role='cliente',plano='freemium' where id='${actor(6)}'; update profiles set loja_ativa=false where id='${actor(1)}';`)
  sql(source('supabase/migrations/20260918002358_harden_profile_and_admin_authorization.sql'))
  sql(source('supabase/migrations/20260918004708_remove_legacy_admin_rls_bypasses.sql'))
  sql("notify pgrst, 'reload schema';")
  await eventually(async()=>(await request('activation_keys',4)).data?.length===0)
  denied(await request('profiles',1,{role:'anon'}),'anonymous profile read')
  ok((await request('profiles',1)).data.map(p=>p.id),[actor(1)],'owner reads only own profile')
  ok((await request(`profiles?id=eq.${actor(2)}`,1)).data,[],'cross-owner read')
  ok((await request(`profiles?id=eq.${actor(2)}`,1,{method:'PATCH',body:{nome_completo:'forbidden'}})).data,[],'cross-owner update')
  ok((await request(`profiles?id=eq.${actor(1)}`,1,{method:'PATCH',body:{nome_completo:'Updated fixture'}})).status,200,'ordinary profile edit')
  for(const [field,value] of Object.entries({id:actor(5),role:'admin',plano:'pro',status:'suspenso',loja_ativa:true,capacidades_admin:['chaves:ler'],stripe_customer_id:'cus_fake',stripe_account_id:'acct_fake',codigo_de_afiliado:'fake',consultor_id:actor(2),trial_fim:'2099-01-01',plano_fim:'2099-01-01'})) {
    denied(await request(`profiles?id=eq.${actor(1)}`,1,{method:'PATCH',body:{[field]:value}}),`protected ${field}`)
  }
  denied(await request(`profiles?id=eq.${actor(1)}`,1,{method:'DELETE'}),'profile delete')
  denied(await request('profiles',1,{method:'POST',body:{id:actor(1),nome_completo:'fixture',role:'admin',status:'ativo',plano:'pro'}}),'profile insert')
  denied(await request(`profiles?id=eq.${actor(3)}`,3,{method:'PATCH',aal:'aal2',body:{plano:'pro'}}),'admin self-promotion through Data API')
  for(const table of ['activation_keys','admin_audit_log']) {
    for(const [n,aal] of [[1,'aal1'],[3,'aal1'],[4,'aal2']]) ok((await request(table,n,{aal})).data,[],`${table}: denied read ${n}/${aal}`)
    ok((await request(table,3,{aal:'aal2'})).data.length,1,`${table}: capability and AAL2 read`)
    const body = table === 'activation_keys' ? {code:'FORBIDDEN'} : {action:'forbidden'}
    for(const method of ['POST','PATCH','DELETE']) denied(await request(table,3,{method,aal:'aal2',body:method==='DELETE'?undefined:body}),`${table} immutable to client ${method}`)
  }
  for(const table of ['subscriptions','invoices','concessoes_de_plano']) {
    ok((await request(table,1)).data.map(r=>r.user_id),[actor(1)],`${table} owner read`)
    denied(await request(table,3,{method:'POST',aal:'aal2',body:{user_id:actor(2)}}),`${table} admin direct write`)
  }
  for(const [table,column] of Object.entries(ownerRelations)) {
    ok((await request(table,1)).data.map(r=>r.id),[actor(1)],`${table}: owner read`)
    ok((await request(table,4,{aal:'aal2'})).data,[],`${table}: admin has no cross-owner access`)
    if(!table.startsWith('pedido')) {
      denied(await request(`${table}?id=eq.${actor(1)}`,1,{method:'PATCH',body:{[column]:actor(2)}}),`${table}: cannot transfer to another owner`)
    }
  }
  for(const table of ['plans','produtos_afiliados']) {
    ok((await request(table,1,{role:'anon'})).data.length,1,`${table}: public catalog remains visible`)
    denied(await request(table,3,{method:'DELETE',aal:'aal2'}),`${table}: cannot erase catalog`)
  }
  ok((await request('payment_notifications',1,{method:'PATCH',body:{read_at:new Date().toISOString()}})).status,200,'owner marks notification as read')
  denied(await request('payment_notifications',1,{method:'PATCH',body:{content:'forged'}}),'owner cannot forge notification')
  ok((await request('payment_notifications',4,{aal:'aal2'})).data,[],'notification admin isolation')
  sql(`update profiles set status='suspenso' where id='${actor(3)}';`)
  ok((await request('activation_keys',3,{aal:'aal2'})).data,[],'suspended admin denied')
  sql(`update profiles set status='ativo' where id='${actor(3)}';`)
  ok((await request(`profiles?id=eq.${actor(1)}`,1,{role:'service_role',method:'PATCH',body:{plano:'pro'}})).status,200,'trusted billing write')
  sql(`insert into auth.users(id,email,raw_user_meta_data) values('${actor(7)}','new@example.invalid','{"role":"admin","plano":"pro"}');`)
  ok(sql(`select role||':'||plano from profiles where id='${actor(7)}'`),'cliente:freemium','signup ignores privileged metadata')
  // SQL with missing JWT must not acquire the former COALESCE(service_role) bypass.
  assert.throws(()=>sql(`set role authenticated; set request.jwt.claims = '{"sub":"${actor(1)}"}'; update profiles set plano='starter' where id='${actor(1)}';`))
  checks++
  // Restore rehearsal of this disposable schema/data, never a production backup.
  const dump = execFileSync('docker',['exec',db,'pg_dump','-U','postgres','--no-owner'],{encoding:'utf8'})
  sql('create database restore_check;')
  execFileSync('docker',['exec','-i',db,'psql','-U','postgres','-d','restore_check','-v','ON_ERROR_STOP=1','-q'],{input:dump,stdio:['pipe','pipe','pipe']})
  ok(docker('exec',db,'psql','-U','postgres','-d','restore_check','-Atc','select count(*) from profiles'),'7','restored rows')
  const restoredSql = statement => docker('exec',db,'psql','-U','postgres','-d','restore_check','-v','ON_ERROR_STOP=1','-qAtc',statement)
  ok(restoredSql("select has_table_privilege('authenticated','profiles','DELETE')"),'f','restored delete restriction')
  ok(restoredSql(`set role authenticated; set request.jwt.claims = '{"sub":"${actor(1)}","role":"authenticated","aal":"aal1"}'; select count(*) from profiles;`),'1','restored owner isolation')
  assert.throws(()=>restoredSql(`set role authenticated; set request.jwt.claims = '{"sub":"${actor(1)}","role":"authenticated"}'; update profiles set role='admin' where id='${actor(1)}';`))
  checks++
  console.log(JSON.stringify({passed:checks,baselineVulnerabilitiesReproduced:5,database:'PostgreSQL 17',api:'PostgREST 16.1',restoredDisposableDatabase:true}))
} finally {
  for(const name of [rest,db]) { try { docker('rm','-f','-v',name) } catch { /* Only task-owned names. */ } }
  try { docker('network','rm',prefix) } catch { /* Network may not have been created. */ }
}
