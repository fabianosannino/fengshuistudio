// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
const m=vi.hoisted(()=>({ user:{id:'owner'} as {id:string}|null, error:null as unknown, list:vi.fn(),update:vi.fn(),sync:vi.fn(),writes:vi.fn(),rate:vi.fn(),eq:vi.fn() }))
vi.mock('../../src/lib/stripe',()=>({default:{subscriptions:{list:m.list,update:m.update}}}))
vi.mock('../../src/lib/sincronizar-assinatura',()=>({sincronizarAssinatura:m.sync}))
vi.mock('../../src/lib/rate-limit',()=>({rateLimit:m.rate,ipDaRequisicao:()=> 'fixture'}))
vi.mock('../../src/lib/supabase-route',()=>({createRouteHandlerClient:async()=>({
  auth:{getUser:async()=>({data:{user:m.user}})},from:()=>({select:()=>({eq:m.eq})}),
})}))
vi.mock('../../src/lib/supabase-admin',()=>({createSupabaseAdminClient:()=>({from:()=>({insert:m.writes,upsert:m.writes})})}))
import { POST } from '../../app/api/subscription/cancel/route'
const req=()=>new Request('https://example.invalid/api/subscription/cancel',{method:'POST',body:JSON.stringify({user_id:'victim',subscription_id:'sub_victim'})})
beforeEach(()=>{
  vi.clearAllMocks();m.user={id:'owner'};m.error=null
  m.rate.mockResolvedValue({success:true});m.eq.mockImplementation(()=>({single:async()=>({data:{stripe_customer_id:'cus_owner'},error:m.error})}))
  m.list.mockResolvedValue({data:[{id:'sub_owner',customer:'cus_owner',status:'active',cancel_at_period_end:false}],has_more:false})
  m.update.mockResolvedValue({id:'sub_owner',customer:'cus_owner',cancel_at_period_end:true})
  m.sync.mockResolvedValue({situacao:'atualizada',linhaId:'row_owner',cancelamentoAgendado:true})
  m.writes.mockResolvedValue({error:null})
})
describe('cancelamento com estado confirmado',()=>{
  it('deriva Customer da sessão e sincroniza pelo caminho atômico',async()=>{
    expect((await POST(req())).status).toBe(200)
    expect(m.eq).toHaveBeenCalledWith('id','owner')
    expect(m.update).toHaveBeenCalledWith('sub_owner',{cancel_at_period_end:true},expect.any(Object))
    expect(m.sync).toHaveBeenCalledWith(expect.any(Object),'sub_owner','/api/subscription/cancel','cus_owner')
  })
  it('sem autenticação ou leitura confiável não chama Stripe',async()=>{
    m.user=null;expect((await POST(req())).status).toBe(401)
    m.user={id:'owner'};m.error={};expect((await POST(req())).status).toBe(503)
    expect(m.list).not.toHaveBeenCalled()
  })
  it('mais de uma assinatura não escolhe arbitrariamente quem cancelar',async()=>{
    m.list.mockResolvedValue({data:[{status:'active'},{status:'past_due'}],has_more:false})
    expect((await POST(req())).status).toBe(409)
    expect(m.update).not.toHaveBeenCalled()
  })
  it('titular incompatível é recusado antes da mutação',async()=>{
    m.list.mockResolvedValue({data:[{id:'sub_victim',customer:'cus_victim',status:'active'}],has_more:false})
    expect((await POST(req())).status).toBe(503)
    expect(m.update).not.toHaveBeenCalled()
  })
  it('timeout no provedor não gera confirmação ou notificação',async()=>{
    m.update.mockRejectedValue(new Error('timeout'))
    expect((await POST(req())).status).toBe(503)
    expect(m.sync).not.toHaveBeenCalled();expect(m.writes).not.toHaveBeenCalled()
  })
  it.each([{situacao:'falhou'},{situacao:'atualizada',cancelamentoAgendado:false}])('sincronização não confirmada ou renovação concorrente não vira sucesso: %j',async result=>{
    m.sync.mockResolvedValue(result)
    expect((await POST(req())).status).toBe(503)
    expect(m.writes).not.toHaveBeenCalled()
  })
  it('retry de cancelamento já agendado confere estado sem repetir alteração',async()=>{
    m.list.mockResolvedValue({data:[{id:'sub_owner',customer:'cus_owner',status:'active',cancel_at_period_end:true}],has_more:false})
    expect((await POST(req())).status).toBe(200)
    expect(m.update).not.toHaveBeenCalled();expect(m.sync).toHaveBeenCalled()
  })
  it('falha secundária é declarada sem desfazer o cancelamento confirmado',async()=>{
    m.writes.mockResolvedValue({error:{message:'synthetic'}})
    const response=await POST(req())
    expect(response.status).toBe(200)
    expect((await response.json()).registro_secundario_pendente).toBe(true)
  })
})
