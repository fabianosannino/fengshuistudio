'use client'

import { redirecionarParaLogin } from '../../src/lib/auth-rotas'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../src/lib/supabase'
import AppShell from '../components/AppShell'
import Skeleton from '../components/Skeleton'
import Image from 'next/image'
import Link from 'next/link'
import type { Cliente, Profile } from '../../src/lib/types'
import type { User } from '@supabase/supabase-js'
import { planoEfetivo, podeClientes, mensagemLimiteClientes } from '../../src/lib/plano-utils'
import { Camera, Users, Search } from 'lucide-react'
import { useUrlsAssinadas } from '../components/useUrlsAssinadas'
import { BUCKET_CLIENTES } from '../../src/lib/storage-imagens'
import { logger } from '../../src/lib/logger'
import { progressoDoDiagnostico, type ProgressoDoDiagnostico } from '../../src/lib/etapa-do-diagnostico'
import { calcularMingGua } from '../../src/lib/ming-gua'
import { montanhaDoGrau } from '../../src/lib/montanhas'
import { formatarMoeda, formatarData } from '../../src/lib/formato'
import type { BaguaEntrada } from '../../src/lib/types'

const PAGE_SIZE = 10

/** Os três estados são exclusivos — ver a nota em `filtroEstado`. */
type FiltroEstado = 'ativos' | 'inativos' | 'todos'

const ROTULO_DO_FILTRO: Record<FiltroEstado, string> = {
  ativos: 'Ativos', inativos: 'Inativos', todos: 'Todos',
}

interface ConsultaDoCliente {
  id: string
  cliente_id: string
  nome_imovel: string | null
  status: string | null
  atualizado_em: string | null
  criado_em: string | null
  finalizada_em: string | null
  relatorio_gerado_em: string | null
  bagua_entrada: BaguaEntrada | null
}

interface ResumoDoCliente {
  totalConsultas: number
  consulta: ConsultaDoCliente | null
  progresso: ProgressoDoDiagnostico | null
  financeiro: { vencido: number; aberto: number }
}

/** Iniciais para o avatar — duas no máximo, sem inventar quando não há nome. */
function iniciaisDe(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '—'
  return (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase()
}

/**
 * A ação que a linha oferece depende de onde a consulta parou. Uma linha com
 * «Retomar» ao lado de um relatório já entregue mandaria o consultor para o
 * lugar errado.
 */
function acaoDaLinha(resumo: ResumoDoCliente | undefined, clienteId: string): { texto: string; href: string; primaria: boolean } {
  if (resumo?.financeiro.vencido) {
    return { texto: 'Cobrar', href: '/pagamentos', primaria: false }
  }
  const consulta = resumo?.consulta
  if (!consulta) {
    return { texto: 'Nova consulta', href: `/consultas/nova?cliente_id=${clienteId}`, primaria: true }
  }
  if (resumo?.progresso?.completo) {
    return { texto: 'Ver relatório', href: `/consultas/${consulta.id}/relatorio`, primaria: false }
  }
  if (resumo?.progresso?.atual === 'relatorio') {
    return { texto: 'Emitir PDF', href: `/consultas/${consulta.id}/relatorio`, primaria: false }
  }
  return { texto: 'Retomar', href: `/consultas/${consulta.id}`, primaria: true }
}

export default function Clientes() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Pick<Profile, 'plano'> | null>(null)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [currentPage, setCurrentPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [userId, setUserId] = useState<string | null>(null)
  const [form, setForm] = useState({
    nome_completo: '',
    data_nascimento: '',
    genero: '',
    email: '',
    telefone: '',
    cep: '',
    rua: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    pais: 'Brasil',
    notas: ''
  })
  const [cepLoading, setCepLoading] = useState(false)
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)

  // Filter & sort state
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'nome_asc'|'nome_desc'|'recente'|'antigo'|'cidade'>('recente')
  /**
   * Os três filtros passam a ser exclusivos. Antes, «Inativos» só ligava
   * `showInactive` — exatamente o que «Todos» fazia —, então os dois botões
   * mostravam a mesma lista e um deles mentia.
   */
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('ativos')

  // O que a linha de cada cliente precisa saber para responder «em que pé está?».
  const [resumos, setResumos] = useState<Record<string, ResumoDoCliente>>({})

  const loadClientes = useCallback(async (pageNum: number, uid?: string, overrideSortBy?: string, overrideFiltro?: FiltroEstado) => {
    const id = uid || userId
    if (!id) return

    setLoading(true)
    const from = pageNum * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    const activeSortBy = overrideSortBy ?? sortBy
    const activeFiltro = (overrideFiltro ?? filtroEstado) as FiltroEstado

    let orderCol = 'criado_em'
    let ascending = false
    if (activeSortBy === 'nome_asc') { orderCol = 'nome_completo'; ascending = true }
    else if (activeSortBy === 'nome_desc') { orderCol = 'nome_completo'; ascending = false }
    else if (activeSortBy === 'recente') { orderCol = 'criado_em'; ascending = false }
    else if (activeSortBy === 'antigo') { orderCol = 'criado_em'; ascending = true }
    else if (activeSortBy === 'cidade') { orderCol = 'cidade'; ascending = true }

    let query = supabase
      .from('clientes')
      .select('*', { count: 'exact' })
      .eq('consultor_id', id)

    if (activeFiltro === 'ativos') query = query.eq('ativo', true)
    else if (activeFiltro === 'inativos') query = query.eq('ativo', false)

    query = query.order(orderCol, { ascending }).range(from, to)

    const { data, count } = await query

    setClientes(data || [])
    setTotalCount(count || 0)
    setCurrentPage(pageNum)

    const clientIds = (data || []).map(c => c.id)
    if (clientIds.length === 0) {
      setResumos({})
      setLoading(false)
      return
    }

    // Uma consulta por tabela para a página inteira, não uma por linha.
    const [consultasRes, pagamentosRes, setoresRes, prescricoesRes] = await Promise.all([
      supabase
        .from('consultas')
        .select('id, cliente_id, nome_imovel, status, atualizado_em, criado_em, finalizada_em, relatorio_gerado_em, bagua_entrada')
        .in('cliente_id', clientIds)
        .neq('status', 'deletada')
        .order('atualizado_em', { ascending: false }),
      supabase
        .from('pagamentos')
        .select('cliente_id, valor, status, data_vencimento')
        .in('cliente_id', clientIds),
      supabase.from('setores_bagua').select('consulta_id, score_percentual'),
      supabase.from('prescricoes').select('consulta_id'),
    ])

    if (consultasRes.error) {
      // Falha de banco nunca vira lista sem informação: o consultor leria as
      // linhas em branco como «este cliente não tem nada».
      logger.error('Falha ao carregar o estado das consultas dos clientes', {
        route: '/clientes', error: consultasRes.error.message,
      })
    }

    const setoresPorConsulta = new Map<string, number>()
    for (const s of (setoresRes.data ?? []) as { consulta_id: string; score_percentual: number | null }[]) {
      if (s.score_percentual == null) continue
      setoresPorConsulta.set(s.consulta_id, (setoresPorConsulta.get(s.consulta_id) ?? 0) + 1)
    }
    const prescricoesPorConsulta = new Map<string, number>()
    for (const p of (prescricoesRes.data ?? []) as { consulta_id: string }[]) {
      prescricoesPorConsulta.set(p.consulta_id, (prescricoesPorConsulta.get(p.consulta_id) ?? 0) + 1)
    }

    const hoje = new Date().toISOString().slice(0, 10)
    const financeiroPorCliente = new Map<string, { vencido: number; aberto: number }>()
    for (const p of (pagamentosRes.data ?? []) as { cliente_id: string | null; valor: number | string | null; status: string | null; data_vencimento: string | null }[]) {
      if (!p.cliente_id) continue
      const st = (p.status ?? '').toLowerCase()
      if (st === 'pago' || st === 'cancelado') continue
      const valor = Number(p.valor)
      if (!Number.isFinite(valor)) continue
      const atual = financeiroPorCliente.get(p.cliente_id) ?? { vencido: 0, aberto: 0 }
      // Vencido é derivado da data, como no resto do produto.
      if (p.data_vencimento && p.data_vencimento < hoje) atual.vencido += valor
      else atual.aberto += valor
      financeiroPorCliente.set(p.cliente_id, atual)
    }

    const consultasPorCliente = new Map<string, ConsultaDoCliente[]>()
    for (const c of (consultasRes.data ?? []) as unknown as ConsultaDoCliente[]) {
      const lista = consultasPorCliente.get(c.cliente_id) ?? []
      lista.push(c)
      consultasPorCliente.set(c.cliente_id, lista)
    }

    const mapa: Record<string, ResumoDoCliente> = {}
    for (const clienteId of clientIds) {
      const consultas = consultasPorCliente.get(clienteId) ?? []
      // A «em curso» é a viva mais recente; sem nenhuma viva, a última que houve.
      const emCurso = consultas.find(c => {
        const st = (c.status ?? '').toLowerCase()
        return st !== 'arquivada' && st !== 'finalizada'
      }) ?? consultas[0] ?? null

      mapa[clienteId] = {
        totalConsultas: consultas.length,
        consulta: emCurso,
        progresso: emCurso
          ? progressoDoDiagnostico({
              orientacaoGraus: emCurso.bagua_entrada?.orientacao_graus,
              baguaFinalizadaEm: emCurso.bagua_entrada?.finalizada_em,
              setoresComScore: setoresPorConsulta.get(emCurso.id) ?? 0,
              prescricoes: prescricoesPorConsulta.get(emCurso.id) ?? 0,
              relatorioGeradoEm: emCurso.relatorio_gerado_em,
            })
          : null,
        financeiro: financeiroPorCliente.get(clienteId) ?? { vencido: 0, aberto: 0 },
      }
    }
    setResumos(mapa)

    setLoading(false)
  }, [userId, sortBy, filtroEstado])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { redirecionarParaLogin(); return }
      setUser(user)
      setUserId(user.id)
      const { data: prof } = await supabase
        .from('profiles')
        .select('plano')
        .eq('id', user.id)
        .single()
      setProfile(prof)
      await loadClientes(0, user.id)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handlePageChange(newPage: number) {
    loadClientes(newPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      const res = await fetch('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage(data.error || 'Erro ao salvar cliente.')
      } else {
        // Upload photo if selected
        if (fotoFile && data.id) {
          const fd = new FormData()
          fd.append('foto', fotoFile)
          fd.append('cliente_id', data.id)
          await fetch('/api/clientes/foto', { method: 'POST', body: fd })
        }
        setMessage('Cliente cadastrado com sucesso!')
        setForm({ nome_completo: '', data_nascimento: '', genero: '', email: '', telefone: '', cep: '', rua: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', pais: 'Brasil', notas: '' })
        setFotoFile(null)
        setFotoPreview(null)
        setShowForm(false)
        await loadClientes(0)
      }
    } catch {
      setMessage('Erro de conexão ao salvar cliente.')
    }
    setSaving(false)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = e.target
    if (name === 'cep') {
      // CEP mask: 00000-000
      const digits = value.replace(/\D/g, '').slice(0, 8)
      const masked = digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits
      setForm({ ...form, cep: masked })
      return
    }
    setForm({ ...form, [name]: value })
  }

  async function handleCepBlur() {
    const digits = form.cep.replace(/\D/g, '')
    if (digits.length !== 8) return
    setCepLoading(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      const data = await res.json()
      if (!data.erro) {
        setForm(prev => ({
          ...prev,
          rua: data.logradouro || prev.rua,
          bairro: data.bairro || prev.bairro,
          cidade: data.localidade || prev.cidade,
          estado: data.uf || prev.estado,
        }))
      }
    } catch { /* ignore network errors */ }
    setCepLoading(false)
  }

  function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setMessage('Formato inválido. Use JPG, PNG ou WEBP.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage('Arquivo muito grande. Máximo 5MB.')
      return
    }
    setFotoFile(file)
    setFotoPreview(URL.createObjectURL(file))
  }

  // Client-side search filter
  // A busca cobre o que o campo promete. Antes só o nome era comparado, então
  // procurar pela cidade ou pelo nome do imóvel devolvia lista vazia — e lista
  // vazia se lê como «não existe», não como «não procurei aí».
  const filteredClientes = clientes.filter(c => {
    const termo = search.trim().toLowerCase()
    if (!termo) return true
    const campos = [
      c.nome_completo, c.email, c.cidade, c.estado, c.telefone,
      resumos[c.id]?.consulta?.nome_imovel,
    ]
    return campos.some(campo => typeof campo === 'string' && campo.toLowerCase().includes(termo))
  })

  const comConsultaEmAndamento = filteredClientes.filter(c => {
    const p = resumos[c.id]?.progresso
    return p !== null && p !== undefined && !p.completo
  }).length

  // Um lote de assinaturas para a página inteira, não uma por card.
  const { resolver: resolverFoto } = useUrlsAssinadas(
    clientes.map(c => c.foto_url),
    BUCKET_CLIENTES
  )

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  if (loading && clientes.length === 0) {
    return (
      <AppShell currentPage="clientes">
        <div style={{ marginBottom: '24px' }}>
          <Skeleton width="200px" height="24px" />
          <div style={{ marginTop: '8px' }}><Skeleton width="260px" height="16px" /></div>
        </div>
        <Skeleton variant="list" rows={4} />
      </AppShell>
    )
  }

  return (
    <AppShell currentPage="clientes">

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <p style={{ color: '#2E7D6B', fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 8px 0' }}>Clientes</p>
          <h1 style={{ color: '#0E1B2C', fontSize: '26px', fontWeight: 500, margin: '0 0 6px 0', letterSpacing: '-0.01em', fontFamily: 'var(--font-fraunces), serif' }}>Clientes</h1>
          <p style={{ color: '#6B7280', fontSize: '13px', margin: '0' }}>
            {/* O número é do filtro corrente, e o rótulo diz qual — «12 clientes»
                sob o filtro «Inativos» seria lido como a carteira inteira. */}
            {totalCount} {totalCount === 1 ? 'cliente' : 'clientes'} · {ROTULO_DO_FILTRO[filtroEstado].toLowerCase()}
            {comConsultaEmAndamento > 0 && ` · ${comConsultaEmAndamento} com consulta em andamento`}
          </p>
        </div>
        <button type="button" onClick={() => {
          const p = planoEfetivo(profile?.plano)
          if (!podeClientes(p)) {
            setMessage(mensagemLimiteClientes(p) ?? '')
            return
          }
          setShowForm(!showForm); setMessage('')
        }} style={{
          background: '#2E7D6B', color: '#ffffff', border: 'none',
          padding: '12px 24px', borderRadius: '8px', fontSize: '15px',
          fontWeight: 'bold', cursor: 'pointer'
        }}>
          {showForm ? 'Cancelar' : '+ Novo cliente'}
        </button>
      </div>

      {/* Filter / Sort Bar */}
      <div className="panel" style={{
        padding: '16px 20px', marginBottom: '20px',
        display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center'
      }}>
        <input
          type="text"
          placeholder="Buscar por nome..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: '1 1 200px', padding: '10px 14px', border: '1px solid #D1D5DB',
            borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
            minWidth: '180px'
          }}
        />
        <select
          value={sortBy}
          onChange={e => {
            const val = e.target.value as typeof sortBy
            setSortBy(val)
            loadClientes(0, undefined, val)
          }}
          style={{
            padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px',
            fontSize: '14px', outline: 'none', background: '#fff', cursor: 'pointer'
          }}
        >
          <option value="recente">Cadastro mais recente</option>
          <option value="antigo">Cadastro mais antigo</option>
          <option value="nome_asc">Nome A-Z</option>
          <option value="nome_desc">Nome Z-A</option>
          <option value="cidade">Cidade</option>
        </select>
        {/* Um grupo de botões, exclusivos entre si. Antes «Inativos» ligava o
            mesmo estado que «Todos» e as duas listas eram idênticas. */}
        <div role="radiogroup" aria-label="Filtrar por estado" style={{ display: 'flex', border: '1px solid #E7E1D6', borderRadius: '9px', overflow: 'hidden', background: '#fff' }}>
          {(['ativos', 'inativos', 'todos'] as const).map((estado, i) => {
            const ativo = filtroEstado === estado
            return (
              <button type="button" key={estado} role="radio" aria-checked={ativo}
                onClick={() => { setFiltroEstado(estado); loadClientes(0, undefined, undefined, estado) }}
                style={{
                  padding: '10px 16px', border: 'none', cursor: 'pointer', fontSize: '13px',
                  borderLeft: i > 0 ? '1px solid #E7E1D6' : 'none',
                  fontWeight: ativo ? 700 : 400,
                  background: ativo ? '#0E1B2C' : '#fff',
                  color: ativo ? '#fff' : '#4A5A67',
                }}
              >{ROTULO_DO_FILTRO[estado]}</button>
            )
          })}
        </div>
      </div>

      {!podeClientes(planoEfetivo(profile?.plano)) && (
        <div style={{
          marginBottom: '16px', padding: '12px 16px', borderRadius: '8px',
          background: '#FAF3E0', border: '1px solid #EEDFB4', color: '#8A6E2F', fontSize: '13px'
        }}>
          {mensagemLimiteClientes(planoEfetivo(profile?.plano))}{' '}
          <a href="/planos" style={{ color: '#2E7D6B', fontWeight: 'bold' }}>Ver planos</a>
        </div>
      )}

      {message && (
        <div style={{
          marginBottom: '20px', padding: '12px 16px', borderRadius: '8px',
          background: message.includes('Erro') || message.includes('Limite') ? '#FAEEE9' : '#F0F6F3',
          border: `1px solid ${message.includes('Erro') || message.includes('Limite') ? '#EBD3C7' : '#DCEAE4'}`,
          color: message.includes('Erro') || message.includes('Limite') ? '#B4533A' : '#2E7D6B',
          fontSize: '14px'
        }}>{message}</div>
      )}

      {showForm && (
        <div className="panel" style={{
          padding: '32px', marginBottom: '32px',
          borderTop: '3px solid #2E7D6B'
        }}>
          <h2 style={{ color: '#0E1B2C', fontSize: '18px', fontWeight: 'bold', marginBottom: '24px', marginTop: '0' }}>
            Novo Cliente
          </h2>
          <form onSubmit={handleSave}>
            {/* Foto de perfil */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
              <div style={{
                width: '72px', height: '72px', borderRadius: '50%', overflow: 'hidden',
                background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '2px dashed #D1D5DB', flexShrink: 0, position: 'relative' as const,
              }}>
                {fotoPreview ? (
                  <Image src={fotoPreview} alt="Preview" fill unoptimized style={{ objectFit: 'cover' }} />
                ) : (
                  <Camera size={26} strokeWidth={1.5} color="#9CA3AF" aria-hidden="true" />
                )}
              </div>
              <div>
                <label htmlFor="input-foto" style={{ display: 'inline-block', padding: '8px 16px', background: '#F3F4F6', color: '#374151', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold' }}>
                  {fotoPreview ? 'Trocar foto' : 'Adicionar foto'}
                </label>
                <input id="input-foto" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFotoChange} style={{ display: 'none' }} />
                {fotoPreview && (
                  <button type="button" onClick={() => { setFotoFile(null); setFotoPreview(null) }} style={{
                    marginLeft: '8px', padding: '8px 12px', background: 'transparent', color: '#B4533A',
                    border: 'none', fontSize: '13px', cursor: 'pointer'
                  }}>Remover</button>
                )}
                <p style={{ color: '#9CA3AF', fontSize: '12px', margin: '4px 0 0 0' }}>JPG, PNG ou WEBP. Máx. 5MB.</p>
              </div>
            </div>

            {/* Dados pessoais */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label htmlFor="input-nome-completo" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Nome completo *</label>
                <input id="input-nome-completo" name="nome_completo" value={form.nome_completo} onChange={handleChange} required placeholder="Nome do cliente"
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label htmlFor="input-email" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>E-mail</label>
                <input id="input-email" name="email" value={form.email} onChange={handleChange} type="email" placeholder="email@exemplo.com"
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label htmlFor="input-telefone" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Telefone</label>
                <input id="input-telefone" name="telefone" value={form.telefone} onChange={handleChange} placeholder="(11) 99999-9999"
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              {/* Data de nascimento e gênero são as entradas do Ming Gua
                  (`calcularMingGua`), que o relatório usa para as direções
                  favoráveis. Sem eles a seção simplesmente não aparece, e o
                  consultor descobria isso só no fim — o campo não existia aqui,
                  só no editor do cliente. */}
              <div>
                <label htmlFor="input-data-nascimento" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Data de nascimento</label>
                <input id="input-data-nascimento" name="data_nascimento" type="date" value={form.data_nascimento} onChange={handleChange}
                  max={new Date().toISOString().slice(0, 10)}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                <p style={{ color: '#9CA3AF', fontSize: '12px', margin: '4px 0 0 0' }}>Habilita o Ming Gua e as direções favoráveis no relatório.</p>
              </div>
              <div>
                <label htmlFor="select-genero" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Gênero</label>
                <select id="select-genero" name="genero" value={form.genero} onChange={handleChange}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', background: '#fff' }}>
                  <option value="">Não informado</option>
                  <option value="feminino">Feminino</option>
                  <option value="masculino">Masculino</option>
                </select>
                {/* O cálculo clássico do Ming Gua tem só duas fórmulas. «Não
                    informado» é resposta válida: o relatório omite a seção em vez
                    de escolher uma fórmula por conta própria. */}
              </div>
            </div>

            {/* Endereço */}
            {/* Endereço deixou de ser obrigatório: o imóvel analisado tem
                endereço próprio (`consultas.endereco_imovel`), e exigir os sete
                campos do cliente travava o cadastro de quem só tinha nome e
                telefone — o caso comum de um primeiro contato. Nenhum deles é
                usado em cálculo. */}
            <h3 style={{ color: '#0E1B2C', fontSize: '15px', fontWeight: 'bold', margin: '20px 0 12px 0', paddingTop: '16px', borderTop: '1px solid #E5E7EB' }}>
              Endereço <span style={{ fontWeight: 'normal', color: '#9CA3AF', fontSize: '13px' }}>— opcional</span>
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label htmlFor="input-cep" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>CEP</label>
                <div style={{ position: 'relative' }}>
                  <input id="input-cep" name="cep" value={form.cep} onChange={handleChange} onBlur={handleCepBlur} placeholder="00000-000" maxLength={9}
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                  {cepLoading && <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#2E7D6B', fontSize: '12px' }}>Buscando...</span>}
                </div>
              </div>
              <div>
                <label htmlFor="input-rua" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Rua / Logradouro</label>
                <input id="input-rua" name="rua" value={form.rua} onChange={handleChange} placeholder="Rua, Avenida, etc."
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label htmlFor="input-numero" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Número</label>
                <input id="input-numero" name="numero" value={form.numero} onChange={handleChange} placeholder="Nº"
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label htmlFor="input-complemento" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Complemento</label>
                <input id="input-complemento" name="complemento" value={form.complemento} onChange={handleChange} placeholder="Apto, Bloco..."
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label htmlFor="input-bairro" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Bairro</label>
                <input id="input-bairro" name="bairro" value={form.bairro} onChange={handleChange} placeholder="Bairro"
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label htmlFor="input-cidade" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Cidade</label>
                <input id="input-cidade" name="cidade" value={form.cidade} onChange={handleChange} placeholder="Cidade"
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label htmlFor="select-estado" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Estado</label>
                <select id="select-estado" name="estado" value={form.estado} onChange={handleChange}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', background: '#fff' }}>
                  <option value="">UF</option>
                  {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(uf => (
                    <option key={uf} value={uf}>{uf}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div>
                <label htmlFor="input-pais" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>País</label>
                <input id="input-pais" name="pais" value={form.pais} onChange={handleChange} placeholder="Brasil"
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label htmlFor="input-notas" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Observações</label>
                <input id="input-notas" name="notas" value={form.notas} onChange={handleChange} placeholder="Anotações sobre o cliente"
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>
            <button type="submit" disabled={saving} style={{
              background: saving ? '#9CA3AF' : '#2E7D6B', color: '#ffffff', border: 'none',
              padding: '12px 32px', borderRadius: '8px', fontSize: '15px',
              fontWeight: 'bold', cursor: saving ? 'not-allowed' : 'pointer'
            }}>
              {saving ? 'Salvando...' : 'Salvar cliente'}
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <Skeleton variant="list" rows={4} />
      ) : totalCount === 0 ? (
        <div className="panel" style={{
          padding: '64px 32px', textAlign: 'center',
        }}>
          <Users size={44} strokeWidth={1.5} color="#2E7D6B" style={{ margin: '0 auto 16px' }} aria-hidden="true" />
          <h3 style={{ color: '#0E1B2C', fontSize: '18px', marginBottom: '8px' }}>Nenhum cliente cadastrado</h3>
          <p style={{ color: '#6B7280', fontSize: '14px' }}>Clique em &quot;Novo cliente&quot; para comecar</p>
        </div>
      ) : filteredClientes.length === 0 ? (
        <div className="panel" style={{
          padding: '48px 32px', textAlign: 'center',
        }}>
          <Search size={34} strokeWidth={1.5} color="#9CA3AF" style={{ margin: '0 auto 12px' }} aria-hidden="true" />
          <h3 style={{ color: '#0E1B2C', fontSize: '16px', marginBottom: '8px' }}>Nenhum cliente encontrado</h3>
          <p style={{ color: '#6B7280', fontSize: '14px' }}>Tente ajustar o filtro de busca.</p>
        </div>
      ) : (
        // Linhas, não cards: cabem quatro vezes mais clientes na tela e cada
        // linha responde «em que pé está?», que era a pergunta sem resposta.
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="linha-cliente cabecalho-lista" style={{
            padding: '12px 18px', borderBottom: '1px solid #F1EEE6', background: '#FBF9F4',
          }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#6B7280' }}>Cliente</span>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#6B7280' }}>Imóvel em curso</span>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#6B7280' }}>Etapa do diagnóstico</span>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#6B7280' }}>Financeiro</span>
            <span />
          </div>

          {filteredClientes.map((cliente, indice) => {
            const resumo = resumos[cliente.id]
            const consulta = resumo?.consulta ?? null
            const ativo = (cliente as Cliente & { ativo?: boolean }).ativo !== false
            const mingGua = calcularMingGua(cliente.data_nascimento, (cliente as Cliente & { genero?: string | null }).genero)
            const graus = consulta?.bagua_entrada?.orientacao_graus
            const acao = acaoDaLinha(resumo, cliente.id)
            const foto = resolverFoto(cliente.foto_url)

            return (
              <div key={cliente.id} className="linha-cliente" style={{
                padding: '14px 18px', alignItems: 'center',
                borderBottom: indice < filteredClientes.length - 1 ? '1px solid #F1EEE6' : 'none',
                opacity: ativo ? 1 : 0.7,
              }}>
                {/* ── Cliente ────────────────────────────────────────── */}
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', minWidth: 0 }}>
                  <div style={{
                    width: '38px', height: '38px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                    background: '#E4F1EC', color: '#2E7D6B', fontSize: '13px', fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
                  }}>
                    {foto
                      ? <Image src={foto} alt="" fill unoptimized style={{ objectFit: 'cover' }} />
                      : iniciaisDe(cliente.nome_completo)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <Link href={`/clientes/${cliente.id}`} style={{
                      display: 'block', fontSize: '14px', fontWeight: 600, color: '#0E1B2C', textDecoration: 'none',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{cliente.nome_completo}</Link>
                    {/* Lacuna é informação, não silêncio: «sem data de nascimento»
                        explica por que o Ming Gua não aparece no relatório. */}
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {cliente.cidade
                        ? `${cliente.cidade}${cliente.estado ? ` · ${cliente.estado}` : ''}`
                        : 'Sem endereço cadastrado'}
                      {' · '}
                      {mingGua ? `Ming Gua ${mingGua.kua}` : 'sem data de nascimento'}
                    </p>
                  </div>
                </div>

                {/* ── Imóvel em curso ────────────────────────────────── */}
                <div style={{ minWidth: 0 }}>
                  {consulta ? (
                    <>
                      <p style={{ margin: 0, fontSize: '13px', color: '#0E1B2C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {consulta.nome_imovel?.trim() || 'Imóvel sem nome'}
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: '12px', color: typeof graus === 'number' ? '#9CA3AF' : '#B4533A' }}>
                        {typeof graus === 'number'
                          ? `${montanhaDoGrau(graus).nome} · ${graus.toFixed(1).replace('.', ',')}°`
                          : 'Sem leitura de fachada'}
                        {consulta.finalizada_em && ` · concluída em ${formatarData(consulta.finalizada_em)}`}
                      </p>
                    </>
                  ) : (
                    <p style={{ margin: 0, fontSize: '13px', color: '#9CA3AF' }}>Nenhuma consulta ainda</p>
                  )}
                </div>

                {/* ── Etapa do diagnóstico ───────────────────────────── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', minWidth: 0 }}>
                  {resumo?.progresso ? (
                    <>
                      <div role="img" aria-label={`Etapa: ${resumo.progresso.rotulo}`} style={{ display: 'flex', gap: '3px' }}>
                        {resumo.progresso.cumpridas.map((cumprida, i) => (
                          <span key={i} style={{
                            height: '5px', flex: 1, borderRadius: '99px',
                            // Fundo claro aqui: a barra do dashboard vive sobre
                            // tinta e usa branco translúcido, que sumiria nesta.
                            background: cumprida ? '#2E7D6B' : i === resumo.progresso!.indice ? '#C9A227' : '#EAE5DA',
                          }} />
                        ))}
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: resumo.progresso.completo ? '#2E7D6B' : '#8A6E2F' }}>
                        {resumo.progresso.completo
                          ? 'Entregue'
                          : `${resumo.progresso.rotulo.replace('Etapa ', '')} · ${resumo.progresso.cumpridas.filter(Boolean).length} de 5`}
                      </span>
                    </>
                  ) : (
                    <span style={{ fontSize: '12px', color: '#9CA3AF' }}>—</span>
                  )}
                </div>

                {/* ── Financeiro ─────────────────────────────────────── */}
                <div style={{ minWidth: 0 }}>
                  {resumo?.financeiro.vencido
                    ? <span style={{ fontSize: '13px', color: '#B4533A', fontWeight: 700 }}>{formatarMoeda(resumo.financeiro.vencido)} vencido</span>
                    : resumo?.financeiro.aberto
                      ? <span style={{ fontSize: '13px', color: '#2E7D6B', fontWeight: 600 }}>Em dia</span>
                      : <span style={{ fontSize: '13px', color: '#9CA3AF' }}>—</span>}
                </div>

                {/* ── Ação ───────────────────────────────────────────── */}
                <Link href={acao.href} style={{
                  fontSize: '13px', fontWeight: 700, padding: '8px 14px', borderRadius: '8px',
                  textAlign: 'center', textDecoration: 'none', whiteSpace: 'nowrap',
                  ...(acao.primaria
                    ? { background: '#2E7D6B', color: '#fff' }
                    : { border: '1px solid #D8D0C0', color: '#0E1B2C' }),
                }}>{acao.texto}</Link>
              </div>
            )
          })}
        </div>
      )}

      <style>{`
        .linha-cliente {
          display: grid;
          grid-template-columns: 2fr 1.6fr 1.5fr 1fr 128px;
          gap: 14px;
        }
        /* Abaixo de 1000px as cinco colunas não cabem: viram duas, e o
           cabeçalho some porque deixa de rotular coluna nenhuma. */
        @media (max-width: 1000px) {
          .linha-cliente { grid-template-columns: 1fr 1fr; }
          .cabecalho-lista { display: none; }
        }
        @media (max-width: 600px) {
          .linha-cliente { grid-template-columns: 1fr; }
        }
      `}</style>

      {totalPages > 1 && (
        <div style={{
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          gap: '8px', marginTop: '24px',
        }}>
          <button type="button"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 0}
            style={{
              padding: '8px 16px', borderRadius: '8px', border: '1px solid #E5E7EB',
              background: currentPage === 0 ? '#F9FAFB' : '#ffffff',
              color: currentPage === 0 ? '#D1D5DB' : '#374151',
              cursor: currentPage === 0 ? 'not-allowed' : 'pointer',
              fontSize: '13px', fontWeight: 'bold',
            }}
          >← Anterior</button>
          <span style={{ color: '#6B7280', fontSize: '13px' }}>
            Página {currentPage + 1} de {totalPages}
          </span>
          <button type="button"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage + 1 >= totalPages}
            style={{
              padding: '8px 16px', borderRadius: '8px', border: '1px solid #E5E7EB',
              background: currentPage + 1 >= totalPages ? '#F9FAFB' : '#ffffff',
              color: currentPage + 1 >= totalPages ? '#D1D5DB' : '#374151',
              cursor: currentPage + 1 >= totalPages ? 'not-allowed' : 'pointer',
              fontSize: '13px', fontWeight: 'bold',
            }}
          >Próximo →</button>
        </div>
      )}

    </AppShell>
  )
}
