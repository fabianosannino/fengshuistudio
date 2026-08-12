'use client'

import { redirecionarParaLogin } from '../../../src/lib/auth-rotas'
import { useEffect, useState } from 'react'
import { supabase } from '../../../src/lib/supabase'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import AppShell from '../../components/AppShell'
import ConfirmModal from '../../components/ConfirmModal'
import Skeleton from '../../components/Skeleton'
import type { Cliente, Consulta } from '../../../src/lib/types'
import Link from 'next/link'
import { calcularMingGua } from '../../../src/lib/ming-gua'
import { calcularKuaDaCasa, compatibilidadeMoradorCasa } from '../../../src/lib/oito-mansoes'
import { montanhaDoGrau } from '../../../src/lib/montanhas'
import { formatarData } from '../../../src/lib/formato'
import { progressoDoDiagnostico, type ProgressoDoDiagnostico } from '../../../src/lib/etapa-do-diagnostico'
import { useUrlAssinada } from '../../components/useUrlsAssinadas'
import { BUCKET_CLIENTES } from '../../../src/lib/storage-imagens'


export default function ClienteDetalhe() {
  const params = useParams()
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [consultas, setConsultas] = useState<Consulta[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleteConsultaId, setDeleteConsultaId] = useState<string | null>(null)
  const [finalizarConsultaId, setFinalizarConsultaId] = useState<string | null>(null)
  const [form, setForm] = useState({
    nome_completo: '',
    email: '',
    telefone: '',
    data_nascimento: '',
    genero: '',
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
  const [uploadingFoto, setUploadingFoto] = useState(false)
  // Contagens por consulta, para a barra de etapa. Duas consultas para a ficha
  // inteira — RLS já limita as duas tabelas ao dono.
  const [setoresPorConsulta, setSetoresPorConsulta] = useState<Record<string, number>>({})
  const [prescricoesPorConsulta, setPrescricoesPorConsulta] = useState<Record<string, number>>({})

  async function loadConsultas() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('consultas')
      .select('*, bagua_entrada')
      .eq('cliente_id', params.id)
      .eq('consultor_id', user.id)
      .order('criado_em', { ascending: false })
    setConsultas(data || [])
    await carregarContagens((data || []).map(c => c.id))
  }

  async function carregarContagens(consultaIds: string[]) {
    if (consultaIds.length === 0) {
      setSetoresPorConsulta({})
      setPrescricoesPorConsulta({})
      return
    }
    const [setoresRes, prescricoesRes] = await Promise.all([
      supabase.from('setores_bagua').select('consulta_id, score_percentual').in('consulta_id', consultaIds),
      supabase.from('prescricoes').select('consulta_id').in('consulta_id', consultaIds),
    ])
    const setores: Record<string, number> = {}
    for (const s of (setoresRes.data ?? []) as { consulta_id: string; score_percentual: number | null }[]) {
      if (s.score_percentual == null) continue
      setores[s.consulta_id] = (setores[s.consulta_id] ?? 0) + 1
    }
    const prescricoes: Record<string, number> = {}
    for (const p of (prescricoesRes.data ?? []) as { consulta_id: string }[]) {
      prescricoes[p.consulta_id] = (prescricoes[p.consulta_id] ?? 0) + 1
    }
    setSetoresPorConsulta(setores)
    setPrescricoesPorConsulta(prescricoes)
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { redirecionarParaLogin(); return }

      // Run both queries in parallel (both use params.id, not each other's results)
      const [cliRes, consRes] = await Promise.all([
        supabase
          .from('clientes')
          .select('*')
          .eq('id', params.id)
          .eq('consultor_id', user.id)
          .single(),
        supabase
          .from('consultas')
          .select('*, bagua_entrada')
          .eq('cliente_id', params.id)
          .eq('consultor_id', user.id)
          .order('criado_em', { ascending: false }),
      ])

      const cli = cliRes.data
      if (!cli) { window.location.href = '/clientes'; return }
      setCliente(cli)
      setForm({
        nome_completo: cli.nome_completo || '',
        email: cli.email || '',
        telefone: cli.telefone || '',
        data_nascimento: cli.data_nascimento || '',
        genero: cli.genero || '',
        cep: cli.cep || '',
        rua: cli.rua || '',
        numero: cli.numero || '',
        complemento: cli.complemento || '',
        bairro: cli.bairro || '',
        cidade: cli.cidade || '',
        estado: cli.estado || '',
        pais: cli.pais || 'Brasil',
        notas: cli.notas || ''
      })

      setConsultas(consRes.data || [])
      setLoading(false)
    }
    load()
  }, [params.id])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = e.target
    if (name === 'cep') {
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

  // `handleFotoUpload` (envio imediato ao trocar a foto no cabeçalho) saiu
  // junto com o cabeçalho antigo. O formulário de edição já envia a foto no
  // mesmo submit — duas rotas para a mesma escrita davam dois estados possíveis
  // para o mesmo campo.



  async function handleFotoRemove() {
    if (!cliente) return
    setUploadingFoto(true)
    try {
      const res = await fetch('/api/clientes/foto', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cliente_id: cliente.id }),
      })
      if (res.ok) {
        setCliente({ ...cliente, foto_url: null })
        setFotoFile(null)
        setFotoPreview(null)
        setMessage('Foto removida com sucesso!')
        setTimeout(() => setMessage(''), 3000)
      }
    } catch {
      setMessage('Erro ao remover foto.')
    }
    setUploadingFoto(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    // Upload new photo if selected
    if (fotoFile) {
      const fd = new FormData()
      fd.append('foto', fotoFile)
      fd.append('cliente_id', params.id as string)
      const fotoRes = await fetch('/api/clientes/foto', { method: 'POST', body: fd })
      const fotoData = await fotoRes.json()
      if (fotoRes.ok) {
        setCliente(prev => prev ? { ...prev, foto_url: fotoData.foto_url } : prev)
      }
    }

    // Campos de data/enum vazios viram null (string vazia é inválida no Postgres).
    const payload = { ...form, data_nascimento: form.data_nascimento || null, genero: form.genero || null }
    const { error } = await supabase
      .from('clientes')
      .update(payload)
      .eq('id', params.id)
    if (error) {
      setMessage('Erro ao salvar: ' + error.message)
    } else {
      setCliente(prev => prev ? { ...prev, ...form } : prev)
      setEditing(false)
      setFotoFile(null)
      setFotoPreview(null)
      setMessage('Cliente atualizado com sucesso!')
      setTimeout(() => setMessage(''), 3000)
    }
    setSaving(false)
  }

  async function handleDelete() {
    const { error } = await supabase
      .from('clientes')
      .update({ ativo: false })
      .eq('id', params.id)
    if (error) {
      setMessage('Erro ao excluir: ' + error.message)
    } else {
      window.location.href = '/clientes'
    }
    setDeleteTarget(null)
  }

  async function handleDeleteConsulta() {
    if (!deleteConsultaId) return
    const { error } = await supabase
      .from('consultas')
      .update({ status: 'deletada' })
      .eq('id', deleteConsultaId)
    if (error) {
      setMessage('Erro ao deletar consulta: ' + error.message)
    } else {
      setMessage('Consulta removida com sucesso!')
      setTimeout(() => setMessage(''), 3000)
      await loadConsultas()
    }
    setDeleteConsultaId(null)
  }

  async function handleFinalizarConsulta() {
    if (!finalizarConsultaId) return
    const { error } = await supabase
      .from('consultas')
      .update({ status: 'finalizada', finalizada_em: new Date().toISOString() })
      .eq('id', finalizarConsultaId)
    if (error) {
      setMessage('Erro ao concluir consulta: ' + error.message)
    } else {
      setMessage('Consulta concluída com sucesso!')
      setTimeout(() => setMessage(''), 3000)
      await loadConsultas()
    }
    setFinalizarConsultaId(null)
  }

  const consultasVisiveis = consultas.filter(c => c.status !== 'deletada')

  const mingGua = calcularMingGua(cliente?.data_nascimento, cliente?.genero)

  /**
   * A divergência entre o grupo do morador e o da casa é a informação que o
   * consultor mais usa e que nenhuma tela mostrava. Vale a consulta em curso —
   * cada imóvel tem a sua fachada, e misturar os dois daria uma leitura que não
   * corresponde a nenhum deles.
   */
  const consultaComFachada = consultasVisiveis.find(c => typeof c.bagua_entrada?.orientacao_graus === 'number')
  const grausDaCasa = consultaComFachada?.bagua_entrada?.orientacao_graus
  const divergencia = mingGua && typeof grausDaCasa === 'number'
    ? compatibilidadeMoradorCasa(mingGua.kua, calcularKuaDaCasa(grausDaCasa).kua)
    : null

  const progressoPorConsulta: Record<string, ProgressoDoDiagnostico> = {}
  for (const c of consultasVisiveis) {
    progressoPorConsulta[c.id] = progressoDoDiagnostico({
      orientacaoGraus: c.bagua_entrada?.orientacao_graus,
      baguaFinalizadaEm: c.bagua_entrada?.finalizada_em,
      setoresComScore: setoresPorConsulta[c.id] ?? 0,
      prescricoes: prescricoesPorConsulta[c.id] ?? 0,
      relatorioGeradoEm: c.relatorio_gerado_em,
    })
  }

  const endereco = [
    cliente?.rua && `${cliente.rua}${cliente.numero ? `, ${cliente.numero}` : ''}`,
    cliente?.complemento,
    cliente?.bairro,
    cliente?.cidade && `${cliente.cidade}${cliente.estado ? ` - ${cliente.estado}` : ''}`,
    cliente?.cep && `CEP ${cliente.cep}`,
  ].filter(Boolean).join(' · ')

  /**
   * O histórico sai das datas que as próprias consultas já guardam. Um diário
   * à parte precisaria ser escrito em todo lugar que muda uma consulta, e o
   * primeiro esquecido deixaria o histórico mentindo por omissão.
   */
  const historico = consultasVisiveis
    .flatMap(c => {
      const imovel = c.nome_imovel?.trim() || 'Imóvel'
      const eventos: { data: string; texto: string }[] = []
      if (c.criado_em) eventos.push({ data: c.criado_em, texto: `${imovel} · consulta criada` })
      if (c.bagua_entrada?.finalizada_em) eventos.push({ data: c.bagua_entrada.finalizada_em, texto: `${imovel} · Ba Guá sobreposto à planta` })
      if (c.finalizada_em) eventos.push({ data: c.finalizada_em, texto: `${imovel} · diagnóstico concluído` })
      if (c.relatorio_gerado_em) eventos.push({ data: c.relatorio_gerado_em, texto: `${imovel} · relatório entregue` })
      return eventos
    })
    .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
    .slice(0, 8)
    .map(e => ({
      quando: new Date(e.data).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', ''),
      texto: e.texto,
    }))

  // Antes dos early returns: hook não pode ficar depois de um `return`.
  const fotoAssinada = useUrlAssinada(cliente?.foto_url, BUCKET_CLIENTES)

  if (loading) {
    return (
      <AppShell currentPage="clientes">
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <Skeleton width="150px" height="14px" />
          <div style={{ marginTop: '24px' }}>
            <Skeleton variant="card" />
          </div>
          <div style={{ marginTop: '32px' }}>
            <Skeleton width="180px" height="18px" />
            <div style={{ marginTop: '16px' }}>
              <Skeleton variant="list" rows={3} />
            </div>
          </div>
        </div>
      </AppShell>
    )
  }

  if (!cliente) return null

  return (
    <AppShell currentPage="clientes">
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

        <div style={{ marginBottom: '24px' }}>
          <button type="button" onClick={() => window.location.href = '/clientes'} style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            padding: '6px 14px', background: 'transparent', border: '1px solid #E5E7EB',
            borderRadius: '6px', color: '#6B7280', fontSize: '14px', fontWeight: 400, cursor: 'pointer',
          }}>← Clientes</button>
        </div>

        {message && (
          <div style={{
            marginBottom: '20px', padding: '12px 16px', borderRadius: '8px',
            background: message.includes('Erro') ? '#FEF2F2' : '#F0FDF4',
            border: `1px solid ${message.includes('Erro') ? '#FECACA' : '#BBF7D0'}`,
            color: message.includes('Erro') ? '#DC2626' : '#15803D', fontSize: '14px'
          }}>{message}</div>
        )}

        {!editing && (
          <>
            {/* ── Cabeçalho ──────────────────────────────────────────── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0 }}>
                <div style={{
                  width: '76px', height: '76px', borderRadius: '50%', overflow: 'hidden',
                  background: '#E4F1EC', color: '#2E7D6B', fontSize: '26px', fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, position: 'relative' as const,
                }}>
                  {fotoAssinada
                    ? <Image src={fotoAssinada} alt="" fill unoptimized style={{ objectFit: 'cover' }} />
                    : cliente.nome_completo?.charAt(0).toUpperCase()}
                </div>
                <div style={{ minWidth: 0 }}>
                  <h1 style={{
                    color: '#0E1B2C', fontSize: '26px', fontWeight: 500, margin: '0 0 6px 0',
                    fontFamily: 'var(--font-fraunces), serif', letterSpacing: '-0.01em',
                  }}>{cliente.nome_completo}</h1>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ background: '#F0F6F3', color: '#2E7D6B', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 700 }}>
                      {consultasVisiveis.length === 0 ? 'Sem consultas'
                        : `${consultasVisiveis.length} ${consultasVisiveis.length === 1 ? 'imóvel' : 'imóveis'}`}
                    </span>
                    {cliente.cidade && (
                      <span style={{ color: '#6B7280', fontSize: '13px' }}>{cliente.cidade}{cliente.estado ? ` · ${cliente.estado}` : ''}</span>
                    )}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <Link href={`/consultas/nova?cliente_id=${cliente.id}`} style={{
                  padding: '10px 18px', background: '#2E7D6B', color: '#fff', borderRadius: '9px',
                  fontSize: '14px', fontWeight: 700, textDecoration: 'none',
                }}>Nova consulta</Link>
                <button type="button" onClick={() => setEditing(true)} style={{
                  padding: '10px 18px', background: '#fff', color: '#0E1B2C',
                  border: '1px solid #D8D0C0', borderRadius: '9px', fontSize: '14px', cursor: 'pointer',
                }}>Editar</button>
                <button type="button" onClick={() => setDeleteTarget(params.id as string)} style={{
                  padding: '10px 14px', background: '#fff', color: '#B4533A',
                  border: '1px solid #EBD3C7', borderRadius: '9px', fontSize: '14px', cursor: 'pointer',
                }}>Excluir</button>
              </div>
            </div>

            <div className="ficha-grade" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '18px', alignItems: 'start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>

                {/* ── Imóveis ────────────────────────────────────────── */}
                <div className="panel" style={{ padding: '18px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#0E1B2C' }}>Imóveis</h2>
                    <span style={{ fontSize: '12px', color: '#9CA3AF' }}>{consultasVisiveis.length}</span>
                  </div>
                  {consultasVisiveis.length === 0 ? (
                    <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>Nenhuma consulta para este cliente ainda.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {consultasVisiveis.map(c => {
                        const progresso = progressoPorConsulta[c.id]
                        const graus = c.bagua_entrada?.orientacao_graus
                        const kuaDaCasa = typeof graus === 'number' ? calcularKuaDaCasa(graus) : null
                        const temAno = typeof c.ano_construcao === 'number'
                          || typeof c.ano_reforma_estrutural === 'number'
                          || typeof c.bagua_entrada?.data_construcao === 'string'
                        const concluida = c.status === 'finalizada'
                        return (
                          <div key={c.id} style={{
                            border: '1px solid #F1EEE6', borderRadius: '12px', padding: '14px 16px',
                            opacity: concluida ? 0.85 : 1,
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                              <Link href={`/consultas/${c.id}`} style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0E1B2C', textDecoration: 'none' }}>
                                {c.nome_imovel || 'Imóvel'}{c.area_total_m2 ? ` · ${c.area_total_m2} m²` : ''}
                              </Link>
                              <span style={{
                                fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px',
                                ...(concluida
                                  ? { background: '#F0F6F3', color: '#2E7D6B' }
                                  : { background: '#FAF3E0', color: '#8A6E2F' }),
                              }}>{concluida ? 'Concluída' : 'Em andamento'}</span>
                            </div>

                            {progresso && (
                              <div role="img" aria-label={`Etapa: ${progresso.rotulo}`} style={{ display: 'flex', gap: '3px', marginBottom: '10px' }}>
                                {progresso.cumpridas.map((cumprida, i) => (
                                  <span key={i} style={{
                                    height: '5px', flex: 1, borderRadius: '99px',
                                    background: cumprida ? '#2E7D6B' : i === progresso.indice ? '#C9A227' : '#EAE5DA',
                                  }} />
                                ))}
                              </div>
                            )}

                            {/* A linha de método: o que já sustenta e o que falta.
                                Lacuna aparece como consequência, não como campo vazio. */}
                            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '12px', color: '#6B7280' }}>
                              <span>Fachada{' '}
                                {typeof graus === 'number'
                                  ? <strong style={{ color: '#0E1B2C' }}>{graus.toFixed(1).replace('.', ',')}° · {montanhaDoGrau(graus).nome}</strong>
                                  : <strong style={{ color: '#B4533A' }}>não medida</strong>}
                              </span>
                              {kuaDaCasa && (
                                <span>Kua da Casa{' '}
                                  <strong style={{ color: '#0E1B2C' }}>{kuaDaCasa.kua} · grupo {kuaDaCasa.grupo === 'leste' ? 'Leste' : 'Oeste'}</strong>
                                </span>
                              )}
                              {!temAno && (
                                <span style={{ color: '#B4533A' }}>Estrelas Voadoras: falta o ano de construção</span>
                              )}
                              {c.relatorio_gerado_em && (
                                <span>Relatório entregue em <strong style={{ color: '#0E1B2C' }}>{formatarData(c.relatorio_gerado_em)}</strong></span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* ── Histórico ──────────────────────────────────────── */}
                <div className="panel" style={{ padding: '18px 20px' }}>
                  <h2 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 14px', color: '#0E1B2C' }}>Histórico</h2>
                  {historico.length === 0 ? (
                    <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>
                      Nada registrado ainda. O histórico é montado a partir das datas que as
                      próprias consultas já guardam — não há um diário à parte.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {historico.map((item, i) => (
                        <div key={i} style={{ display: 'flex', gap: '12px' }}>
                          <span style={{ fontSize: '12px', color: '#9CA3AF', width: '64px', flexShrink: 0 }}>{item.quando}</span>
                          <span style={{ fontSize: '13px', color: '#3D4C58' }}>{item.texto}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>

                {/* ── Dados do método ───────────────────────────────── */}
                <div style={{ background: '#0E1B2C', borderRadius: '14px', padding: '18px 20px', color: '#fff' }}>
                  <p style={{ color: '#C9A227', fontSize: '11px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', margin: '0 0 10px' }}>
                    Dados do método
                  </p>
                  {mingGua ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px' }}>
                        <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>Nascimento</span>
                        <strong style={{ fontSize: '14px' }}>{formatarData(cliente.data_nascimento)}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px' }}>
                        <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>Ming Gua</span>
                        <strong style={{ fontSize: '14px' }}>{mingGua.kua} · grupo {mingGua.grupo === 'leste' ? 'Leste' : 'Oeste'}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px' }}>
                        <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>Direções favoráveis</span>
                        <strong style={{ fontSize: '14px', textAlign: 'right' }}>
                          {[mingGua.direcoes.shengChi, mingGua.direcoes.tienYi, mingGua.direcoes.yenNien, mingGua.direcoes.fuWei].join(' · ')}
                        </strong>
                      </div>
                    </div>
                  ) : (
                    // Sem data ou sem gênero não há Ming Gua. Dizer qual dos dois
                    // falta é o que transforma o campo vazio em algo acionável.
                    <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', margin: 0, lineHeight: 1.5 }}>
                      Sem {!cliente.data_nascimento ? 'data de nascimento' : 'gênero informado'}, o Ming Gua não
                      é calculável — e sem ele o relatório sai sem as direções favoráveis do morador.
                    </p>
                  )}

                  {divergencia && (
                    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.12)' }}>
                      <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.66)', lineHeight: 1.5 }}>
                        {divergencia.mensagem}
                      </p>
                    </div>
                  )}
                </div>

                {/* ── Contato ────────────────────────────────────────── */}
                <div className="panel" style={{ padding: '18px 20px' }}>
                  <h2 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 12px', color: '#0E1B2C' }}>Contato</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                    <div><span style={{ color: '#9CA3AF' }}>E-mail</span><p style={{ margin: '2px 0 0', color: cliente.email ? '#0E1B2C' : '#9CA3AF' }}>{cliente.email || 'não informado'}</p></div>
                    <div><span style={{ color: '#9CA3AF' }}>Telefone</span><p style={{ margin: '2px 0 0', color: cliente.telefone ? '#0E1B2C' : '#9CA3AF' }}>{cliente.telefone || 'não informado'}</p></div>
                    <div>
                      <span style={{ color: '#9CA3AF' }}>Endereço</span>
                      <p style={{ margin: '2px 0 0', color: endereco ? '#0E1B2C' : '#9CA3AF' }}>{endereco || 'não informado'}</p>
                    </div>
                  </div>
                </div>

                {/* ── Observações ────────────────────────────────────── */}
                {cliente.notas && (
                  <div className="panel" style={{ padding: '18px 20px' }}>
                    <h2 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 10px', color: '#0E1B2C' }}>Observações</h2>
                    <p style={{ fontSize: '13px', color: '#3D4C58', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{cliente.notas}</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {editing && (
          <div style={{
            background: '#ffffff', borderRadius: '12px', padding: '28px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderTop: '3px solid #2E7D6B',
            marginBottom: '32px'
          }}>
            <h2 style={{ color: '#0E1B2C', fontSize: '18px', fontWeight: 'bold', marginTop: '0', marginBottom: '24px' }}>Editar Cliente</h2>
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
                  ) : fotoAssinada ? (
                    <Image src={fotoAssinada} alt={cliente.nome_completo} fill unoptimized style={{ objectFit: 'cover' }} />
                  ) : (
                    <span style={{ color: '#9CA3AF', fontSize: '28px' }}>📷</span>
                  )}
                </div>
                <div>
                  <label htmlFor="input-foto-edit" style={{ display: 'inline-block', padding: '8px 16px', background: '#F3F4F6', color: '#374151', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold' }}>
                    {cliente.foto_url || fotoPreview ? 'Trocar foto' : 'Adicionar foto'}
                  </label>
                  <input id="input-foto-edit" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFotoChange} style={{ display: 'none' }} />
                  {(cliente.foto_url || fotoPreview) && (
                    <button type="button" onClick={() => {
                      if (fotoPreview) { setFotoFile(null); setFotoPreview(null) }
                      else { handleFotoRemove() }
                    }} disabled={uploadingFoto} style={{
                      marginLeft: '8px', padding: '8px 12px', background: 'transparent', color: '#DC2626',
                      border: 'none', fontSize: '13px', cursor: 'pointer'
                    }}>Remover</button>
                  )}
                  <p style={{ color: '#9CA3AF', fontSize: '12px', margin: '4px 0 0 0' }}>JPG, PNG ou WEBP. Máx. 5MB.</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label htmlFor="input-nome-completo" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Nome completo *</label>
                  <input id="input-nome-completo" name="nome_completo" value={form.nome_completo} onChange={handleChange} required
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label htmlFor="input-email" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>E-mail</label>
                  <input id="input-email" name="email" value={form.email} onChange={handleChange} type="email"
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label htmlFor="input-telefone" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Telefone</label>
                  <input id="input-telefone" name="telefone" value={form.telefone} onChange={handleChange}
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label htmlFor="input-data-nascimento" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Data de nascimento</label>
                  <input id="input-data-nascimento" name="data_nascimento" type="date" value={form.data_nascimento} onChange={handleChange}
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                  <p style={{ color: '#9CA3AF', fontSize: '11px', margin: '4px 0 0 0' }}>Opcional — usada só para o Ming Gua (número Kua)</p>
                </div>
                <div>
                  <label htmlFor="input-genero" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Gênero (p/ Ming Gua)</label>
                  <select id="input-genero" name="genero" value={form.genero} onChange={handleChange}
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', background: '#fff' }}>
                    <option value="">Não informar</option>
                    <option value="feminino">Feminino</option>
                    <option value="masculino">Masculino</option>
                  </select>
                </div>
              </div>

              {/* Endereço */}
              <div style={{ marginBottom: '16px' }}>
                <h3 style={{ color: '#0E1B2C', fontSize: '15px', fontWeight: 'bold', margin: '8px 0 12px 0' }}>Endereço</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', marginBottom: '12px' }}>
                  <div>
                    <label htmlFor="input-cep" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>CEP</label>
                    <div style={{ position: 'relative' }}>
                      <input id="input-cep" name="cep" value={form.cep} onChange={handleChange} onBlur={handleCepBlur} placeholder="00000-000"
                        style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                      {cepLoading && <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: '#9CA3AF' }}>Buscando...</span>}
                    </div>
                  </div>
                  <div>
                    <label htmlFor="input-rua" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Rua</label>
                    <input id="input-rua" name="rua" value={form.rua} onChange={handleChange}
                      style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '16px', marginBottom: '12px' }}>
                  <div>
                    <label htmlFor="input-numero" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Número</label>
                    <input id="input-numero" name="numero" value={form.numero} onChange={handleChange}
                      style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label htmlFor="input-complemento" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Complemento</label>
                    <input id="input-complemento" name="complemento" value={form.complemento} onChange={handleChange}
                      style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label htmlFor="input-bairro" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Bairro</label>
                    <input id="input-bairro" name="bairro" value={form.bairro} onChange={handleChange}
                      style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '16px' }}>
                  <div>
                    <label htmlFor="input-cidade" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Cidade</label>
                    <input id="input-cidade" name="cidade" value={form.cidade} onChange={handleChange}
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
                  <div>
                    <label htmlFor="input-pais" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>País</label>
                    <input id="input-pais" name="pais" value={form.pais} onChange={handleChange}
                      style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label htmlFor="input-notas" style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Observações</label>
                <textarea id="input-notas" name="notas" value={form.notas} onChange={handleChange} rows={3}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', resize: 'vertical' }} />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" onClick={() => { setEditing(false); setForm({
                  nome_completo: cliente.nome_completo || '',
                  email: cliente.email || '',
                  telefone: cliente.telefone || '',
                  data_nascimento: cliente.data_nascimento || '',
                  genero: cliente.genero || '',
                  cep: cliente.cep || '',
                  rua: cliente.rua || '',
                  numero: cliente.numero || '',
                  complemento: cliente.complemento || '',
                  bairro: cliente.bairro || '',
                  cidade: cliente.cidade || '',
                  estado: cliente.estado || '',
                  pais: cliente.pais || 'Brasil',
                  notas: cliente.notas || ''
                }) }} style={{
                  padding: '10px 24px', background: '#F3F4F6', color: '#374151',
                  border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer'
                }}>Cancelar</button>
                <button type="submit" disabled={saving} style={{
                  padding: '10px 32px', background: saving ? '#9CA3AF' : '#2E7D6B',
                  color: '#ffffff', border: 'none', borderRadius: '8px',
                  fontSize: '14px', fontWeight: 'bold', cursor: saving ? 'not-allowed' : 'pointer'
                }}>{saving ? 'Salvando...' : 'Salvar alterações'}</button>
              </div>
            </form>
          </div>
        )}

        <style>{`
          @media (max-width: 900px) {
            .ficha-grade { grid-template-columns: 1fr !important; }
          }
        `}</style>

      </div>

      <ConfirmModal
        open={deleteTarget !== null}
        title="Excluir cliente"
        message="Tem certeza que deseja excluir este cliente? As consultas associadas serão mantidas."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmModal
        open={deleteConsultaId !== null}
        title="Apagar consulta"
        message="A consulta será removida da visualização. Deseja continuar?"
        confirmLabel="Apagar"
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={handleDeleteConsulta}
        onCancel={() => setDeleteConsultaId(null)}
      />

      <ConfirmModal
        open={finalizarConsultaId !== null}
        title="Concluir consulta"
        message="A consulta será marcada como concluída. Deseja continuar?"
        confirmLabel="Concluir"
        cancelLabel="Cancelar"
        variant="warning"
        onConfirm={handleFinalizarConsulta}
        onCancel={() => setFinalizarConsultaId(null)}
      />
    </AppShell>
  )
}
