import { beforeEach, describe, expect, it, vi } from 'vitest'

const { guard, privilegedClient, session } = vi.hoisted(() => ({
  guard: vi.fn(), privilegedClient: vi.fn(), session: {},
}))
vi.mock('../../src/lib/supabase-route', () => ({ createRouteHandlerClient: vi.fn(async () => session) }))
vi.mock('../../src/lib/supabase-admin', () => ({ createSupabaseAdminClient: privilegedClient }))
vi.mock('../../src/lib/stripe', () => ({default:{}}))
vi.mock('../../src/lib/rate-limit', () => ({rateLimit:vi.fn(async()=>({success:true})),ipDaRequisicao:()=> 'local-test'}))
vi.mock('../../src/lib/guarda-admin', () => ({
  exigirCapacidade:guard,
  respostaDaGuarda:(failure:{status:number})=>Response.json({error:'Acesso restrito'},{status:failure.status}),
}))

const routes = [
  {load:()=>import('../../app/api/admin/auditoria/route'),cap:'auditoria:ler'},
  {load:()=>import('../../app/api/admin/chaves/route'),cap:'chaves:ler'},
  {load:()=>import('../../app/api/admin/promover/route'),cap:'usuarios:promover'},
  {load:()=>import('../../app/api/admin/relatorios/route'),cap:'relatorios:ler'},
  {load:()=>import('../../app/api/admin/subscriptions/route'),cap:'assinaturas:escrever'},
]
beforeEach(()=>vi.clearAllMocks())

function databaseResult(error: {message: string} | null = null) {
  const result = { data: [], count: 0, error }
  const query: Record<string, unknown> = {}
  for (const method of ['select','eq','in','order','range','or','limit']) {
    query[method] = () => query
  }
  query.then = (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve)
  return { from: vi.fn(() => query) }
}
describe('rotas administrativas verificam a sessão antes de obter privilégios',()=>{
  for(const [index,{load,cap}] of routes.entries()) {
    it(`rota ${index}: administrador autorizado consulta pelo cliente de serviço`, async () => {
      guard.mockResolvedValue({ok:true,user:{id:'admin-fixture'},profile:{role:'admin'}})
      const database = databaseResult()
      privilegedClient.mockReturnValue(database)
      const route = await load()
      const response = await route.GET(new Request('http://localhost/api/admin?q=fixture'))
      expect(response.status).toBe(200)
      expect(guard).toHaveBeenCalledWith(session,cap)
      expect(privilegedClient).toHaveBeenCalledOnce()
      expect(database.from).toHaveBeenCalled()
      expect(guard.mock.invocationCallOrder[0]).toBeLessThan(privilegedClient.mock.invocationCallOrder[0])
    })
    it.each([401,403])(`rota ${index}: nega %i sem cliente privilegiado`,async status=>{
      guard.mockResolvedValue({ok:false,status})
      const route=await load()
      for(const method of ['GET','POST','PATCH'] as const) {
        if(!(method in route)) continue
        const handler=(route as Record<string,(request:Request)=>Promise<Response>>)[method]
        expect((await handler(new Request('http://localhost/api/admin',{method}))).status).toBe(status)
      }
      expect(guard).toHaveBeenCalledWith(session,cap)
      expect(privilegedClient).not.toHaveBeenCalled()
    })
  }
})
