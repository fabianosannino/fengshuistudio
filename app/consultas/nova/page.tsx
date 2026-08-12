'use client'

import CamposAnoDoImovel from '../../components/CamposAnoDoImovel'
import { calcularMingGua } from '../../../src/lib/ming-gua'
import { redirecionarParaLogin } from '../../../src/lib/auth-rotas'
import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabase } from '../../../src/lib/supabase'
import FlowLayout from '../../components/FlowLayout'
import Skeleton from '../../components/Skeleton'
import type { Profile, Cliente } from '../../../src/lib/types'
import type { User } from '@supabase/supabase-js'
import { planoEfetivo, limiteImoveis, podeClientes, planoLabel, isProfissional as isProfissionalFn, planoUsuario, PROF_TYPES, mensagemLimiteImoveis } from '../../../src/lib/plano-utils'

function NovaConsultaContent() {
  const searchParams = useSearchParams()
  // O card do cliente navega com `cliente_id`; esta tela lia `clienteId`. Os
  // nomes nunca bateram, então a pré-seleção jamais funcionou. Fica o nome que
  // já é enviado, e o antigo segue aceito para não quebrar link salvo.
  const preSelectedClientId = searchParams.get('cliente_id') ?? searchParams.get('clienteId')

  const [user, setUser] = useState<User | null>(null)
  const [clientes, setClientes] = useState<Pick<Cliente, 'id' | 'nome_completo' | 'cidade' | 'estado' | 'data_nascimento' | 'genero'>[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [profile, setProfile] = useState<Pick<Profile, 'plano' | 'tipo_usuario' | 'role' | 'nome_completo'> | null>(null)
  const [totalConsultas, setTotalConsultas] = useState(0)
  const [consultasAtivas, setConsultasAtivas] = useState(0)

  // `clienteId` vem da query string e já está disponível no primeiro render:
  // dá para nascer no estado inicial, em vez de um efeito que corrige logo
  // depois (o que renderizava uma vez com o campo vazio).
  const [form, setForm] = useState({
    cliente_id: preSelectedClientId ?? '',
    nome_imovel: '',
    tipo_imovel: 'residencial',
    area_total_m2: '',
    endereco_imovel: '',
    num_moradores: '',
    ano_construcao: '',
    ano_reforma_estrutural: '',
    historico_imovel: '',
    observacoes_topograficas: '',
    dados_adicionais: '',
  })

  const isProfessional = isProfissionalFn(profile)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { redirecionarParaLogin(); return }
      setUser(user)

      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      setProfile(prof)

      const userIsProfessional = isProfissionalFn(prof)

      if (userIsProfessional) {
        // Professional: load clients list
        const { data } = await supabase
          .from('clientes')
          // Cidade, nascimento e gênero entram no bloco de contexto do cliente:
          // é o que permite mostrar o Ming Gua sem uma segunda ida ao banco.
          .select('id, nome_completo, cidade, estado, data_nascimento, genero')
          .eq('consultor_id', user.id)
          .eq('ativo', true)
          .order('nome_completo')
        setClientes(data || [])
      }

      // Count total consultations
      const { count: countTotal } = await supabase
        .from('consultas')
        .select('*', { count: 'exact', head: true })
        .eq('consultor_id', user.id)
      setTotalConsultas(countTotal || 0)

      // Count active (non-archived) consultations (for Simples plan limit)
      const { count: countAtivas } = await supabase
        .from('consultas')
        .select('*', { count: 'exact', head: true })
        .eq('consultor_id', user.id)
        .neq('status', 'arquivada')
      setConsultasAtivas(countAtivas || 0)

      setLoading(false)
    }
    load()
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function handleStep1(e: React.FormEvent) {
    e.preventDefault()
    if (isProfessional && !form.cliente_id) { setMessage('Selecione um cliente.'); return }
    setSaving(true)
    setMessage('')
    try {
      let clienteId = form.cliente_id

      // Personal users: auto-create or reuse self client
      if (!isProfessional) {
        // Check if self-client already exists
        const { data: existingClients } = await supabase
          .from('clientes')
          .select('id')
          .eq('consultor_id', user!.id)
          .eq('email', user!.email!)
          .limit(1)

        if (existingClients && existingClients.length > 0) {
          clienteId = existingClients[0].id
        } else {
          // Create self as client
          const { data: newClient, error: clientError } = await supabase
            .from('clientes')
            .insert({
              consultor_id: user!.id,
              nome_completo: profile?.nome_completo || user!.email,
              email: user!.email,
              ativo: true,
            })
            .select('id')
            .single()

          if (clientError) {
            setMessage('Erro ao preparar cadastro: ' + clientError.message)
            setSaving(false)
            return
          }
          clienteId = newClient.id
        }
      }

      const res = await fetch('/api/consultas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id: clienteId,
          nome_imovel: form.nome_imovel || 'Meu Imóvel',
          tipo_imovel: form.tipo_imovel,
          area_total_m2: form.area_total_m2 ? parseFloat(form.area_total_m2) : null,
          endereco_imovel: form.endereco_imovel,
          num_moradores: form.num_moradores ? parseInt(form.num_moradores) : null,
          ano_construcao: form.ano_construcao ? parseInt(form.ano_construcao) : null,
          ano_reforma_estrutural: form.ano_reforma_estrutural ? parseInt(form.ano_reforma_estrutural) : null,
          historico_imovel: form.historico_imovel || null,
          observacoes_topograficas: form.observacoes_topograficas || null,
          dados_adicionais: form.dados_adicionais || null,
          status: 'em_andamento',
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage(data.error || 'Erro ao criar consulta.')
        setSaving(false)
        return
      }
      window.location.href = `/consultas/${data.id}`
    } catch {
      setMessage('Erro de conexão ao criar consulta.')
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <FlowLayout backLabel="Consultas" backHref="/consultas">
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <Skeleton width="200px" height="24px" />
          <div style={{ marginTop: '24px' }}>
            <Skeleton variant="card" />
          </div>
        </div>
      </FlowLayout>
    )
  }

  const plano = isProfessional ? 'profissional' as const : planoEfetivo(profile?.plano)
  const limite = limiteImoveis(plano)
  // Professional users: never limited
  // Free: max 3 total
  const freeLimitReached = !isProfessional && plano === 'free' && totalConsultas >= 3
  // Simples: max 1 active (non-archived)
  const simplesLimitReached = !isProfessional && plano === 'simples' && consultasAtivas >= 1
  const limitReached = freeLimitReached || simplesLimitReached

  /**
   * O cliente do contexto é o do **formulário**, não o da query string: depois
   * de «Trocar cliente» a query continua lá, e ler dela devolveria o bloco do
   * cliente antigo por cima do novo.
   */
  const clienteEscolhido = form.cliente_id ? clientes.find(c => c.id === form.cliente_id) ?? null : null
  const mingGuaDoCliente = calcularMingGua(clienteEscolhido?.data_nascimento, clienteEscolhido?.genero)

  /** Iniciais para o avatar — duas no máximo. */
  function iniciaisDe(nome: string): string {
    const partes = nome.trim().split(/\s+/).filter(Boolean)
    if (partes.length === 0) return '—'
    return (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase()
  }

  return (
    <FlowLayout backLabel="Consultas" backHref="/consultas">

      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ color: '#0E1B2C', fontSize: '24px', fontWeight: 'bold', margin: '0 0 4px 0' }}>
            {isProfessional ? 'Nova Consulta Ba Gua' : 'Novo Diagnóstico do Imóvel'}
          </h1>
          <p style={{ color: '#6B7280', fontSize: '15px', margin: '0' }}>
            {isProfessional ? 'Preencha os dados para iniciar o diagnóstico' : 'Cadastre seu imóvel para receber o diagnóstico Feng Shui'}
          </p>
        </div>

        {/* Free plan: 3 property limit */}
        {freeLimitReached && (
          <div style={{
            marginBottom: '20px', padding: '16px 20px', borderRadius: '12px',
            background: '#FAF3E0', border: '1px solid #EEDFB4', color: '#8A6E2F', fontSize: '14px'
          }}>
            <p style={{ margin: '0 0 12px 0' }}>
              {mensagemLimiteImoveis(planoEfetivo(profile?.plano))}
            </p>
            <a href="/planos" style={{
              display: 'inline-block', padding: '8px 20px', background: '#2E7D6B',
              color: '#fff', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold',
              textDecoration: 'none'
            }}>Ver planos</a>
          </div>
        )}

        {/* Simples plan: 1 active property limit */}
        {simplesLimitReached && (
          <div style={{
            marginBottom: '20px', padding: '16px 20px', borderRadius: '12px',
            background: '#FAF3E0', border: '1px solid #EEDFB4', color: '#8A6E2F', fontSize: '14px'
          }}>
            <p style={{ margin: '0 0 12px 0' }}>
              {mensagemLimiteImoveis(planoEfetivo(profile?.plano))}
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <Link href="/consultas" style={{
                display: 'inline-block', padding: '8px 20px', background: '#8A6E2F',
                color: '#fff', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold',
                textDecoration: 'none'
              }}>Arquivar imóvel atual</Link>
              <Link href="/planos" style={{
                display: 'inline-block', padding: '8px 20px', background: '#2E7D6B',
                color: '#fff', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold',
                textDecoration: 'none'
              }}>Ver planos</Link>
            </div>
          </div>
        )}

        {/* Property counter for limited plans */}
        {plano === 'free' && !freeLimitReached && (
          <div style={{
            marginBottom: '20px', padding: '8px 16px', borderRadius: '8px',
            background: '#EAF4F1', border: '1px solid #DCEFE9', color: '#0E1B2C', fontSize: '13px'
          }}>
            {/* O limite vem de `plano-utils`, não escrito à mão: os dois
                contadores desta tela tinham o número fixo, e o do Simples
                continuou dizendo «/1» depois de o limite virar 10. */}
            Plano {planoLabel(profile?.plano)}: {totalConsultas}/{limite ?? '∞'} imóveis cadastrados.
          </div>
        )}

        {/* Simples plan counter */}
        {plano === 'simples' && !simplesLimitReached && (
          <div style={{
            marginBottom: '20px', padding: '8px 16px', borderRadius: '8px',
            background: '#F0F6F3', border: '1px solid #DCEAE4', color: '#245F52', fontSize: '13px'
          }}>
            Plano Simples: {consultasAtivas}/{limite ?? '∞'} {limite === 1 ? 'imóvel ativo' : 'imóveis ativos'}.
          </div>
        )}

        {message && (
          <div style={{
            marginBottom: '20px', padding: '12px 16px', borderRadius: '8px',
            background: '#FAEEE9', border: '1px solid #EBD3C7', color: '#B4533A', fontSize: '14px'
          }}>{message}</div>
        )}

        {!limitReached && (
          <div style={{ background: '#ffffff', borderRadius: '12px', padding: '32px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <form onSubmit={handleStep1}>

              {/* Client selector - only for professionals */}
              {isProfessional && (
                <div style={{ marginBottom: '20px' }}>
                  <label htmlFor="select-cliente" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Cliente *</label>
                  {clientes.length === 0 ? (
                    <div style={{ padding: '12px', background: '#FAF3E0', borderRadius: '8px', color: '#8A6E2F', fontSize: '14px' }}>
                      Nenhum cliente cadastrado. <span style={{ color: '#2E7D6B', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => window.location.href = '/clientes'}>Cadastre um cliente primeiro.</span>
                    </div>
                  ) : clienteEscolhido ? (
                    // Contexto, não campo desabilitado. Um `<input disabled>` com
                    // o nome dentro parece um campo que falhou em habilitar, e não
                    // mostra nada além do nome — nem o Ming Gua, nem de onde ele veio.
                    <div style={{
                      background: 'linear-gradient(120deg,#0E1B2C,#1C3A52)', borderRadius: '12px',
                      padding: '16px 18px', color: '#fff',
                      display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap',
                    }}>
                      <span style={{
                        width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0,
                        background: 'rgba(255,255,255,0.12)', color: '#C9A227',
                        fontSize: '15px', fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }} aria-hidden="true">{iniciaisDe(clienteEscolhido.nome_completo)}</span>
                      <div style={{ flex: 1, minWidth: '160px' }}>
                        <p style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>{clienteEscolhido.nome_completo}</p>
                        <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.66)' }}>
                          {clienteEscolhido.cidade
                            ? `${clienteEscolhido.cidade}${clienteEscolhido.estado ? ` · ${clienteEscolhido.estado}` : ''}`
                            : 'Sem endereço cadastrado'}
                          {' · '}
                          {/* Ming Gua ausente aparece como lacuna: é ele que habilita
                              as direções favoráveis do morador no relatório. */}
                          {mingGuaDoCliente
                            ? `Ming Gua ${mingGuaDoCliente.kua} · grupo ${mingGuaDoCliente.grupo === 'leste' ? 'Leste' : 'Oeste'}`
                            : 'sem data de nascimento'}
                        </p>
                      </div>
                      <button type="button" onClick={() => setForm(f => ({ ...f, cliente_id: '' }))} style={{
                        border: '1px solid rgba(255,255,255,0.28)', background: 'transparent', color: '#fff',
                        fontSize: '13px', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', flexShrink: 0,
                      }}>Trocar cliente</button>
                    </div>
                  ) : (
                    <select id="select-cliente" name="cliente_id" value={form.cliente_id} onChange={handleChange} required
                      style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', background: '#fff' }}>
                      <option value="">Selecione o cliente...</option>
                      {clientes.map(c => <option key={c.id} value={c.id}>{c.nome_completo}</option>)}
                    </select>
                  )}
                </div>
              )}

              {/* Personal user info banner */}
              {!isProfessional && (
                <div style={{
                  marginBottom: '20px', padding: '12px 16px', borderRadius: '8px',
                  background: '#F0F6F3', border: '1px solid #DCEAE4',
                  display: 'flex', alignItems: 'center', gap: '10px'
                }}>
                  <span style={{ fontSize: '20px' }}>🏠</span>
                  <p style={{ color: '#2E7D6B', fontSize: '13px', margin: '0' }}>
                    Cadastre os dados do seu imóvel para receber o diagnóstico Feng Shui personalizado.
                  </p>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <label htmlFor="input-nome-imovel" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>
                    {isProfessional ? 'Nome do imóvel' : 'Nome do seu imóvel'}
                  </label>
                  <input id="input-nome-imovel" name="nome_imovel" value={form.nome_imovel} onChange={handleChange}
                    placeholder={isProfessional ? 'Ex: Apartamento Centro' : 'Ex: Minha Casa, Meu Apto'}
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label htmlFor="select-tipo-imovel" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Tipo do imóvel</label>
                  <select id="select-tipo-imovel" name="tipo_imovel" value={form.tipo_imovel} onChange={handleChange}
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', background: '#fff' }}>
                    <option value="residencial">Residencial</option>
                    <option value="comercial">Comercial</option>
                    <option value="escritorio">Escritório</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="input-area-total" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Área total (m²)</label>
                  <input id="input-area-total" name="area_total_m2" value={form.area_total_m2} onChange={handleChange} type="number" placeholder="Ex: 80"
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label htmlFor="input-num-moradores" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Número de moradores/ocupantes</label>
                  <input id="input-num-moradores" name="num_moradores" value={form.num_moradores} onChange={handleChange} type="number" placeholder="Ex: 3"
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label htmlFor="input-endereco-imovel" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Endereço do imóvel</label>
                <input id="input-endereco-imovel" name="endereco_imovel" value={form.endereco_imovel} onChange={handleChange} placeholder="Rua, número, bairro, cidade"
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
              </div>

              {/* Idade do imóvel — o período (Yun) da carta natal sai daqui. */}
              <div style={{ marginBottom: '20px' }}>
                <CamposAnoDoImovel
                  anoConstrucao={form.ano_construcao}
                  anoReformaEstrutural={form.ano_reforma_estrutural}
                  onChange={(campo, valor) => setForm(f => ({ ...f, [campo]: valor }))}
                  // Destaque: é o campo que habilita as Estrelas Voadoras, e o
                  // levantamento inteiro passa por aqui uma vez só.
                  estiloInput={{ border: '2px solid #C9A227', background: '#FFFDF6' }}
                />
              </div>

              {/* Dados Adicionais do Imóvel */}
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ color: '#0E1B2C', fontSize: '16px', fontWeight: 'bold', margin: '0 0 16px 0', paddingTop: '8px', borderTop: '1px solid #E5E7EB' }}>Dados Adicionais do Imóvel</h3>

                <div style={{ marginBottom: '16px' }}>
                  <label htmlFor="input-historico-imovel" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Histórico relevante do imóvel</label>
                  <textarea id="input-historico-imovel" name="historico_imovel" value={form.historico_imovel} onChange={handleChange}
                    placeholder="Ex: Construído em 1990, reformado em 2020..."
                    rows={3}
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label htmlFor="input-observacoes-topograficas" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Observações topográficas / entorno</label>
                  <textarea id="input-observacoes-topograficas" name="observacoes_topograficas" value={form.observacoes_topograficas} onChange={handleChange}
                    placeholder="Ex: Terreno em aclive, próximo a rio..."
                    rows={3}
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
                </div>

                <div style={{ marginBottom: '0' }}>
                  <label htmlFor="input-dados-adicionais" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Outros dados relevantes</label>
                  <textarea id="input-dados-adicionais" name="dados_adicionais" value={form.dados_adicionais} onChange={handleChange}
                    placeholder="Qualquer informação adicional sobre o imóvel..."
                    rows={3}
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" onClick={() => window.location.href = isProfessional ? '/dashboard' : '/consultas'} style={{
                  padding: '12px 24px', background: '#F3F4F6', color: '#374151',
                  border: 'none', borderRadius: '8px', fontSize: '15px', cursor: 'pointer'
                }}>Cancelar</button>
                <button type="submit" disabled={saving || (isProfessional && clientes.length === 0)} style={{
                  padding: '12px 32px', background: saving ? '#9CA3AF' : '#2E7D6B',
                  color: '#ffffff', border: 'none', borderRadius: '8px',
                  fontSize: '15px', fontWeight: 'bold', cursor: saving ? 'not-allowed' : 'pointer'
                }}>{saving ? 'Salvando...' : isProfessional ? 'Criar consulta' : 'Iniciar diagnóstico'}</button>
              </div>
            </form>
          </div>
        )}
      </div>

    </FlowLayout>
  )
}

export default function NovaConsulta() {
  return (
    <Suspense fallback={
      <FlowLayout backLabel="Consultas" backHref="/consultas">
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <Skeleton width="200px" height="24px" />
          <div style={{ marginTop: '24px' }}>
            <Skeleton variant="card" />
          </div>
        </div>
      </FlowLayout>
    }>
      <NovaConsultaContent />
    </Suspense>
  )
}
