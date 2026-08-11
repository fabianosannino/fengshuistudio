'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabase } from '../../../src/lib/supabase'
import FlowLayout from '../../components/FlowLayout'
import Skeleton from '../../components/Skeleton'
import type { Profile, Cliente } from '../../../src/lib/types'
import type { User } from '@supabase/supabase-js'
import { planoEfetivo, limiteImoveis, podeClientes, planoLabel, isProfissional as isProfissionalFn, planoUsuario, PROF_TYPES } from '../../../src/lib/plano-utils'

function NovaConsultaContent() {
  const searchParams = useSearchParams()
  const preSelectedClientId = searchParams.get('clienteId')

  const [user, setUser] = useState<User | null>(null)
  const [clientes, setClientes] = useState<Pick<Cliente, 'id' | 'nome_completo'>[]>([])
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
    historico_imovel: '',
    observacoes_topograficas: '',
    dados_adicionais: '',
  })

  const isProfessional = isProfissionalFn(profile)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }
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
          .select('id, nome_completo')
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

  const preSelectedClient = preSelectedClientId ? clientes.find(c => c.id === preSelectedClientId) : null

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
            background: '#FEF3C7', border: '1px solid #FDE68A', color: '#92400E', fontSize: '14px'
          }}>
            <p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>
              Limite de 3 imóveis atingido no plano {planoLabel(profile?.plano)}.
            </p>
            <p style={{ margin: '0 0 12px 0' }}>
              Para cadastrar mais imóveis, faça upgrade.
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
            background: '#FEF3C7', border: '1px solid #FDE68A', color: '#92400E', fontSize: '14px'
          }}>
            <p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>
              Você já possui 1 imóvel ativo.
            </p>
            <p style={{ margin: '0 0 12px 0' }}>
              Arquive o imóvel atual para cadastrar um novo, ou faça upgrade para o plano Profissional.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <Link href="/consultas" style={{
                display: 'inline-block', padding: '8px 20px', background: '#D97706',
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
            background: '#EAF4F1', border: '1px solid #DCEFE9', color: '#6B21A8', fontSize: '13px'
          }}>
            Plano {planoLabel(profile?.plano)}: {totalConsultas}/3 imóveis cadastrados.
          </div>
        )}

        {/* Simples plan counter */}
        {plano === 'simples' && !simplesLimitReached && (
          <div style={{
            marginBottom: '20px', padding: '8px 16px', borderRadius: '8px',
            background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1E40AF', fontSize: '13px'
          }}>
            Plano Simples: {consultasAtivas}/1 imóvel ativo.
          </div>
        )}

        {message && (
          <div style={{
            marginBottom: '20px', padding: '12px 16px', borderRadius: '8px',
            background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: '14px'
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
                    <div style={{ padding: '12px', background: '#FEF3C7', borderRadius: '8px', color: '#92400E', fontSize: '14px' }}>
                      Nenhum cliente cadastrado. <span style={{ color: '#2E7D6B', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => window.location.href = '/clientes'}>Cadastre um cliente primeiro.</span>
                    </div>
                  ) : preSelectedClient ? (
                    <input
                      type="text"
                      value={preSelectedClient.nome_completo}
                      disabled
                      style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', background: '#F3F4F6', color: '#6B7280' }}
                    />
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
                  background: '#F0FDF4', border: '1px solid #BBF7D0',
                  display: 'flex', alignItems: 'center', gap: '10px'
                }}>
                  <span style={{ fontSize: '20px' }}>🏠</span>
                  <p style={{ color: '#15803D', fontSize: '13px', margin: '0' }}>
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
