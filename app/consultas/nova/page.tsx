'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../src/lib/supabase'
import AppShell from '../../components/AppShell'
import Skeleton from '../../components/Skeleton'
import type { Profile, Cliente } from '../../../src/lib/types'
import type { User } from '@supabase/supabase-js'

const PROF_TYPES = ['consultor', 'arquiteto', 'feng_shui', 'decorador', 'outro_profissional']

const SETORES_BAGUA = [
  { numero: 1, nome: 'Carreira', elemento: 'Agua', cor: '#1D4ED8', posicao: 'Centro-Norte' },
  { numero: 2, nome: 'Conhecimento', elemento: 'Terra', cor: '#92400E', posicao: 'Nordeste' },
  { numero: 3, nome: 'Familia', elemento: 'Madeira', cor: '#15803D', posicao: 'Leste' },
  { numero: 4, nome: 'Prosperidade', elemento: 'Madeira', cor: '#7C3AED', posicao: 'Sudeste' },
  { numero: 5, nome: 'Centro', elemento: 'Terra', cor: '#D97706', posicao: 'Centro' },
  { numero: 6, nome: 'Pessoas Uteis', elemento: 'Metal', cor: '#6B7280', posicao: 'Noroeste' },
  { numero: 7, nome: 'Filhos', elemento: 'Metal', cor: '#B45309', posicao: 'Oeste' },
  { numero: 8, nome: 'Relacionamentos', elemento: 'Terra', cor: '#BE185D', posicao: 'Sudoeste' },
  { numero: 9, nome: 'Fama', elemento: 'Fogo', cor: '#DC2626', posicao: 'Sul' },
]

export default function NovaConsulta() {
  const [user, setUser] = useState<User | null>(null)
  const [clientes, setClientes] = useState<Pick<Cliente, 'id' | 'nome_completo'>[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState(1)
  const [message, setMessage] = useState('')
  const [profile, setProfile] = useState<Pick<Profile, 'plano' | 'tipo_usuario' | 'role' | 'nome_completo'> | null>(null)
  const [consultasMes, setConsultasMes] = useState(0)
  const [totalConsultas, setTotalConsultas] = useState(0)

  const [form, setForm] = useState({
    cliente_id: '',
    nome_imovel: '',
    tipo_imovel: 'residencial',
    area_total_m2: '',
    endereco_imovel: '',
    porta_posicao: 'centro_frente',
  })

  const [setoresAtivos, setSetoresAtivos] = useState<number[]>([])
  const [consultaId, setConsultaId] = useState<string | null>(null)

  const isProfessional = profile?.plano === 'pro'
    || (profile?.tipo_usuario ? PROF_TYPES.includes(profile.tipo_usuario) : false)
    || profile?.role === 'consultor'

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }
      setUser(user)

      const { data: prof } = await supabase
        .from('profiles')
        .select('plano, tipo_usuario, role, nome_completo')
        .eq('id', user.id)
        .single()
      setProfile(prof)

      const userIsProfessional = prof?.plano === 'pro'
        || (prof?.tipo_usuario ? PROF_TYPES.includes(prof.tipo_usuario) : false)
        || prof?.role === 'consultor'

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

      // Count consultations this month (for free plan monthly limit - professionals)
      const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
      const { count: countMes } = await supabase
        .from('consultas')
        .select('*', { count: 'exact', head: true })
        .eq('consultor_id', user.id)
        .gte('criado_em', inicioMes)
      setConsultasMes(countMes || 0)

      // Count total consultations (for personal user 3-property limit)
      const { count: countTotal } = await supabase
        .from('consultas')
        .select('*', { count: 'exact', head: true })
        .eq('consultor_id', user.id)
      setTotalConsultas(countTotal || 0)

      setLoading(false)
    }
    load()
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
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
          nome_imovel: form.nome_imovel || 'Meu Imovel',
          tipo_imovel: form.tipo_imovel,
          area_total_m2: form.area_total_m2 ? parseFloat(form.area_total_m2) : null,
          endereco_imovel: form.endereco_imovel,
          porta_posicao: form.porta_posicao,
          status: 'em_andamento',
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage(data.error || 'Erro ao criar consulta.')
        setSaving(false)
        return
      }
      setConsultaId(data.id)
      setStep(2)
    } catch {
      setMessage('Erro de conexão ao criar consulta.')
    }
    setSaving(false)
  }

  function toggleSetor(numero: number) {
    setSetoresAtivos(prev =>
      prev.includes(numero) ? prev.filter(n => n !== numero) : [...prev, numero]
    )
  }

  async function handleStep2() {
    if (setoresAtivos.length === 0) { setMessage('Selecione ao menos um setor.'); return }
    setSaving(true)
    setMessage('')

    const inserts = setoresAtivos.map(num => {
      const setor = SETORES_BAGUA.find(s => s.numero === num)!
      return {
        consulta_id: consultaId,
        numero: setor.numero,
        nome: setor.nome,
        elemento: setor.elemento,
        cor_associada: setor.cor,
        posicao_grid: setor.posicao,
      }
    })

    const { error } = await supabase.from('setores_bagua').insert(inserts)
    if (error) {
      setMessage('Erro ao salvar setores: ' + error.message)
      setSaving(false)
      return
    }
    setSaving(false)
    window.location.href = '/consultas'
  }

  if (loading) {
    return (
      <AppShell currentPage="consultas">
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <Skeleton width="200px" height="24px" />
          <div style={{ marginTop: '24px' }}>
            <Skeleton variant="card" />
          </div>
        </div>
      </AppShell>
    )
  }

  // Personal user limit: 3 properties total
  const personalLimitReached = !isProfessional && totalConsultas >= 3
  // Professional free plan limit: 3/month
  const profFreeLimitReached = isProfessional && profile?.plano !== 'pro' && consultasMes >= 3

  return (
    <AppShell currentPage="consultas">

      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ color: '#1E3A5F', fontSize: '24px', fontWeight: 'bold', margin: '0 0 4px 0' }}>
            {isProfessional ? 'Nova Consulta Ba Gua' : 'Novo Diagnóstico do Imóvel'}
          </h1>
          <p style={{ color: '#6B7280', fontSize: '15px', margin: '0' }}>
            {isProfessional ? 'Preencha os dados para iniciar o diagnóstico' : 'Cadastre seu imóvel para receber o diagnóstico Feng Shui'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '32px', gap: '0' }}>
          {['Dados do Imóvel', 'Setores Ba Gua'].map((label, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < 1 ? 'none' : 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  background: step > i + 1 ? '#15803D' : step === i + 1 ? '#7C3AED' : '#D1D5DB',
                  color: '#ffffff', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontWeight: 'bold', fontSize: '14px'
                }}>{step > i + 1 ? '✓' : i + 1}</div>
                <span style={{ color: step === i + 1 ? '#1E3A5F' : '#9CA3AF', fontSize: '14px', fontWeight: step === i + 1 ? 'bold' : 'normal' }}>{label}</span>
              </div>
              {i < 1 && <div style={{ flex: 1, height: '2px', background: step > 1 ? '#7C3AED' : '#D1D5DB', margin: '0 16px' }} />}
            </div>
          ))}
        </div>

        {/* Personal user: 3 property limit */}
        {personalLimitReached && (
          <div style={{
            marginBottom: '20px', padding: '16px 20px', borderRadius: '12px',
            background: '#FEF3C7', border: '1px solid #FDE68A', color: '#92400E', fontSize: '14px'
          }}>
            <p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>
              Limite de 3 imoveis atingido na conta pessoal.
            </p>
            <p style={{ margin: '0 0 12px 0' }}>
              Para analisar mais imoveis, mude para uma conta profissional.
            </p>
            <a href="/planos" style={{
              display: 'inline-block', padding: '8px 20px', background: '#7C3AED',
              color: '#fff', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold',
              textDecoration: 'none'
            }}>Ver opcoes profissionais</a>
          </div>
        )}

        {/* Professional free plan: 3/month limit */}
        {profFreeLimitReached && (
          <div style={{
            marginBottom: '20px', padding: '12px 16px', borderRadius: '8px',
            background: '#FEF3C7', border: '1px solid #FDE68A', color: '#92400E', fontSize: '14px'
          }}>
            Limite de 3 consultas/mes atingido no plano Free. <a href="/planos" style={{ color: '#7C3AED', fontWeight: 'bold' }}>Faca upgrade para Pro</a> para continuar.
          </div>
        )}

        {/* Personal user counter */}
        {!isProfessional && !personalLimitReached && (
          <div style={{
            marginBottom: '20px', padding: '8px 16px', borderRadius: '8px',
            background: '#F5F0FF', border: '1px solid #E9D5FF', color: '#6B21A8', fontSize: '13px'
          }}>
            Conta pessoal: {totalConsultas}/3 imoveis cadastrados.
          </div>
        )}

        {/* Professional free plan counter */}
        {isProfessional && profile?.plano !== 'pro' && !profFreeLimitReached && (
          <div style={{
            marginBottom: '20px', padding: '8px 16px', borderRadius: '8px',
            background: '#F5F0FF', border: '1px solid #E9D5FF', color: '#6B21A8', fontSize: '13px'
          }}>
            Plano Free: {consultasMes}/3 consultas usadas este mes.
          </div>
        )}

        {message && (
          <div style={{
            marginBottom: '20px', padding: '12px 16px', borderRadius: '8px',
            background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: '14px'
          }}>{message}</div>
        )}

        {step === 1 && !personalLimitReached && !profFreeLimitReached && (
          <div style={{ background: '#ffffff', borderRadius: '12px', padding: '32px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <form onSubmit={handleStep1}>

              {/* Client selector - only for professionals */}
              {isProfessional && (
                <div style={{ marginBottom: '20px' }}>
                  <label htmlFor="select-cliente" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Cliente *</label>
                  {clientes.length === 0 ? (
                    <div style={{ padding: '12px', background: '#FEF3C7', borderRadius: '8px', color: '#92400E', fontSize: '14px' }}>
                      Nenhum cliente cadastrado. <span style={{ color: '#7C3AED', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => window.location.href = '/clientes'}>Cadastre um cliente primeiro.</span>
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
                  <label htmlFor="select-porta-posicao" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Posição da porta</label>
                  <select id="select-porta-posicao" name="porta_posicao" value={form.porta_posicao} onChange={handleChange}
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', background: '#fff' }}>
                    <option value="centro_frente">Centro da frente</option>
                    <option value="esquerda_frente">Esquerda da frente</option>
                    <option value="direita_frente">Direita da frente</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label htmlFor="input-endereco-imovel" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Endereço do imóvel</label>
                <input id="input-endereco-imovel" name="endereco_imovel" value={form.endereco_imovel} onChange={handleChange} placeholder="Rua, número, bairro, cidade"
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" onClick={() => window.location.href = isProfessional ? '/dashboard' : '/consultas'} style={{
                  padding: '12px 24px', background: '#F3F4F6', color: '#374151',
                  border: 'none', borderRadius: '8px', fontSize: '15px', cursor: 'pointer'
                }}>Cancelar</button>
                <button type="submit" disabled={saving || (isProfessional && clientes.length === 0)} style={{
                  padding: '12px 32px', background: saving ? '#9CA3AF' : '#7C3AED',
                  color: '#ffffff', border: 'none', borderRadius: '8px',
                  fontSize: '15px', fontWeight: 'bold', cursor: saving ? 'not-allowed' : 'pointer'
                }}>{saving ? 'Salvando...' : 'Próximo →'}</button>
              </div>
            </form>
          </div>
        )}

        {step === 2 && (
          <div style={{ background: '#ffffff', borderRadius: '12px', padding: '32px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <h2 style={{ color: '#1E3A5F', fontSize: '18px', fontWeight: 'bold', marginBottom: '8px', marginTop: '0' }}>Selecione os setores a avaliar</h2>
            <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '24px' }}>Clique nos setores do Ba Gua que serao diagnosticados</p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '32px' }}>
              {SETORES_BAGUA.map(setor => {
                const ativo = setoresAtivos.includes(setor.numero)
                return (
                  <div key={setor.numero} onClick={() => toggleSetor(setor.numero)} style={{
                    padding: '16px', borderRadius: '12px', cursor: 'pointer',
                    border: `2px solid ${ativo ? setor.cor : '#E5E7EB'}`,
                    background: ativo ? `${setor.cor}15` : '#F9FAFB',
                    transition: 'all 0.2s', textAlign: 'center'
                  }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '50%',
                      background: ativo ? setor.cor : '#E5E7EB',
                      margin: '0 auto 8px auto', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontWeight: 'bold', fontSize: '14px'
                    }}>{setor.numero}</div>
                    <div style={{ color: ativo ? setor.cor : '#374151', fontWeight: 'bold', fontSize: '14px', marginBottom: '2px' }}>{setor.nome}</div>
                    <div style={{ color: '#9CA3AF', fontSize: '12px' }}>{setor.elemento}</div>
                    <div style={{ color: '#9CA3AF', fontSize: '11px' }}>{setor.posicao}</div>
                  </div>
                )
              })}
            </div>

            <div style={{ marginBottom: '20px', padding: '12px 16px', background: '#F5F0FF', borderRadius: '8px' }}>
              <p style={{ color: '#7C3AED', fontSize: '14px', margin: '0' }}>
                {setoresAtivos.length === 0 ? 'Nenhum setor selecionado' : `${setoresAtivos.length} setor(es) selecionado(s): ${setoresAtivos.map(n => SETORES_BAGUA.find(s => s.numero === n)?.nome).join(', ')}`}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setStep(1)} style={{
                padding: '12px 24px', background: '#F3F4F6', color: '#374151',
                border: 'none', borderRadius: '8px', fontSize: '15px', cursor: 'pointer'
              }}>← Voltar</button>
              <button onClick={() => { setSetoresAtivos([1,2,3,4,5,6,7,8,9]) }} style={{
                padding: '12px 24px', background: '#F3F4F6', color: '#374151',
                border: 'none', borderRadius: '8px', fontSize: '15px', cursor: 'pointer'
              }}>Selecionar todos</button>
              <button onClick={handleStep2} disabled={saving || setoresAtivos.length === 0} style={{
                padding: '12px 32px', background: saving || setoresAtivos.length === 0 ? '#9CA3AF' : '#7C3AED',
                color: '#ffffff', border: 'none', borderRadius: '8px',
                fontSize: '15px', fontWeight: 'bold', cursor: saving ? 'not-allowed' : 'pointer'
              }}>{saving ? 'Salvando...' : isProfessional ? 'Criar consulta ✓' : 'Iniciar diagnostico ✓'}</button>
            </div>
          </div>
        )}
      </div>

    </AppShell>
  )
}
