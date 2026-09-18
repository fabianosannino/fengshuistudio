import {afterEach, describe, expect, it, vi} from 'vitest'
import {exigirCapacidade} from '../guarda-admin'

function client({role='admin',status='ativo',aal='aal2',capabilities=['chaves:gerar'],user=true,mfaError=false}={}) {
  const single=vi.fn(async()=>({data:{role,status,capacidades_admin:capabilities}}))
  return {
    auth:{getUser:vi.fn(async()=>({data:{user:user?{id:'fixture'}:null}})),
      mfa:{getAuthenticatorAssuranceLevel:vi.fn(async()=>({data:{currentLevel:aal,nextLevel:'aal2'},error:mfaError?new Error('fixture'):null}))}},
    from:()=>({select:()=>({eq:()=>({single})})}),
  } as unknown as Parameters<typeof exigirCapacidade>[0]
}
afterEach(()=>vi.unstubAllEnvs())
describe('autorização administrativa real',()=>{
  it('exige MFA em produção mesmo com o interruptor antigo desligado',async()=>{
    vi.stubEnv('NODE_ENV','production'); vi.stubEnv('ADMIN_MFA_OBRIGATORIO','false')
    expect(await exigirCapacidade(client({aal:'aal1'}),'chaves:gerar')).toMatchObject({ok:false,motivo:'mfa_pendente'})
  })
  it('falha fechada ao consultar MFA',async()=>{
    vi.stubEnv('NODE_ENV','production')
    expect(await exigirCapacidade(client({mfaError:true}),'chaves:gerar')).toMatchObject({ok:false,motivo:'mfa_indeterminado'})
  })
  it.each([
    {options:{user:false},motivo:'nao_autenticado'},
    {options:{role:'cliente'},motivo:'nao_admin'},
    {options:{status:'suspenso'},motivo:'nao_admin'},
    {options:{capabilities:[]},motivo:'sem_capacidade'},
  ])('recusa $motivo',async({options,motivo})=>{
    expect(await exigirCapacidade(client(options),'chaves:gerar')).toMatchObject({ok:false,motivo})
  })
  it('permite administrador com sessão verificada e capacidade',async()=>{
    expect(await exigirCapacidade(client(),'chaves:gerar')).toMatchObject({ok:true})
  })
})
