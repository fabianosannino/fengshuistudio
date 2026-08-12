'use client'

import Link from 'next/link'
import { redirecionarParaLogin } from '../../src/lib/auth-rotas'
import { useEffect, useState } from 'react'
import { supabase } from '../../src/lib/supabase'
import { logger } from '../../src/lib/logger'
import AppShell from '../components/AppShell'
import Skeleton from '../components/Skeleton'
import PrimeiroUso from './PrimeiroUso'
import HomeDoCliente from './HomeDoCliente'
import { ehClienteFinal } from '../../src/lib/papel-do-usuario'
import type { Profile, BaguaEntrada } from '../../src/lib/types'
import { montarPendencias, type Pendencia, type TipoDePendencia } from '../../src/lib/pendencias'
import { progressoDoDiagnostico, coresDaBarra, type ProgressoDoDiagnostico } from '../../src/lib/etapa-do-diagnostico'
import { formatarMoeda } from '../../src/lib/formato'
import { faseLunar } from '../../src/lib/lunar'
import { montanhaDoGrau } from '../../src/lib/montanhas'
import {
  Plus, UserPlus, FileText, CircleAlert, Compass, CalendarDays, Moon, Clock,
  ArrowRight, type LucideIcon,
} from 'lucide-react'

/**
 * Home do consultor — «o que eu preciso fazer agora?».
 *
 * A tela anterior abria com «Bem-vindo ao FengShui Studio», quatro contadores e
 * quatro gráficos. Nenhum deles respondia a pergunta que se faz ao abrir o app:
 * um relatório concluído e nunca emitido, uma parcela vencida e um imóvel sem
 * leitura de fachada ficavam invisíveis até alguém lembrar. Os gráficos
 * continuam existindo, em `/relatorios` — como relatório, que é o que são.
 *
 * O título diz o estado do dia («4 consultas ativas · 2 esperando você») em vez
 * de cumprimentar. As regras de «Precisa de você» estão em `src/lib/pendencias.ts`
 * e a etapa de cada consulta em `src/lib/etapa-do-diagnostico.ts` — ambas
 * derivadas, nada gravado.
 */

const ICONE_DA_PENDENCIA: Record<TipoDePendencia, LucideIcon> = {
  parcela_vencida: CircleAlert,
  relatorio_nao_emitido: FileText,
  ritual_hoje: Moon,
  sem_fachada: Compass,
  sem_ano_construcao: CalendarDays,
  consulta_parada: Clock,
}

const TOM_DA_PENDENCIA = {
  alerta: { fundo: '#FAEEE9', icone: '#B4533A' },
  atencao: { fundo: '#FAF3E0', icone: '#8A6E2F' },
  neutro: { fundo: '#F0F6F3', icone: '#2E7D6B' },
} as const

const ESTILO_PAINEL: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid rgba(14,27,44,0.06)',
  borderRadius: '14px',
  boxShadow: '0 1px 2px rgba(14,27,44,0.04), 0 10px 28px -16px rgba(14,27,44,0.18)',
  padding: '18px 20px',
}

const ESTILO_TITULO_PAINEL: React.CSSProperties = {
  fontSize: '15px', fontWeight: 700, margin: 0, color: '#0E1B2C',
}

interface ConsultaAtiva {
  id: string
  nome: string
  cliente: string | null
  iniciais: string
  progresso: ProgressoDoDiagnostico
  diasParada: number | null
  orientacaoGraus: number | null
}

interface NumerosDoMes {
  relatoriosEntregues: number
  recebido: number
  aReceber: number
  vencido: number
}

interface ItemDaAgenda {
  id: string
  quando: string
  texto: string
  hoje: boolean
}

/** Iniciais para o avatar — no máximo duas, sem inventar quando não há nome. */
function iniciais(nome: string | null): string {
  if (!nome) return '—'
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '—'
  return (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase()
}

function diasDesde(iso: string | null | undefined): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return Math.floor((Date.now() - t) / 86_400_000)
}

function textoDeDias(dias: number | null): string {
  if (dias === null) return ''
  if (dias === 0) return 'hoje'
  if (dias === 1) return 'ontem'
  return `há ${dias} dias`
}

export default function Dashboard() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [pendencias, setPendencias] = useState<Pendencia[]>([])
  const [ativas, setAtivas] = useState<ConsultaAtiva[]>([])
  const [numeros, setNumeros] = useState<NumerosDoMes>({ relatoriosEntregues: 0, recebido: 0, aReceber: 0, vencido: 0 })
  const [agenda, setAgenda] = useState<ItemDaAgenda[]>([])
  const [temAlgumDado, setTemAlgumDado] = useState(true)

  useEffect(() => {
    async function carregar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { redirecionarParaLogin(); return }

      const { data: perfil } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(perfil)

      // O cliente final tem outra home (`HomeDoCliente`), que busca o próprio
      // dado. Seguir com as consultas de carteira aqui gastaria seis queries
      // cujo resultado ninguém veria.
      if (ehClienteFinal(perfil)) { setLoading(false); return }

      const inicioDoMes = new Date()
      inicioDoMes.setDate(1)
      inicioDoMes.setHours(0, 0, 0, 0)
      const inicioISO = inicioDoMes.toISOString()
      const hoje = new Date().toISOString().slice(0, 10)
      const em7dias = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10)

      // As consultas primeiro: os ids delas filtram as duas tabelas seguintes.
      const consultasRes = await supabase
        .from('consultas')
        .select('id, nome_imovel, status, criado_em, atualizado_em, finalizada_em, relatorio_gerado_em, ano_construcao, ano_reforma_estrutural, bagua_entrada, clientes(nome_completo)')
        .eq('consultor_id', user.id)
        .order('atualizado_em', { ascending: false })

      const idsDasConsultas = (consultasRes.data ?? []).map(c => c.id as string)

      const [pagamentosRes, rituaisRes, prescricoesRes, setoresRes, clientesRes] = await Promise.all([
        supabase
          .from('pagamentos')
          .select('id, descricao, valor, status, data_vencimento, data_pagamento, clientes(nome_completo)')
          .eq('consultor_id', user.id),
        supabase
          .from('rituais')
          .select('id, titulo, data_ritual, horario, status, clientes(nome_completo)')
          .eq('consultor_id', user.id)
          .eq('status', 'pendente')
          .gte('data_ritual', hoje)
          .lte('data_ritual', em7dias)
          .order('data_ritual', { ascending: true }),
        // Filtradas pelas consultas do usuário, não varrendo a tabela inteira.
        // Sem isso o PostgREST corta em 1000 linhas (`max-rows`) — e como
        // `setores_bagua` tem até 9 por consulta, a partir de ~112 consultas o
        // corte silencioso faria a etapa do diagnóstico **regredir** conforme a
        // carteira cresce, que é o oposto do que se espera.
        supabase.from('prescricoes').select('consulta_id').in('consulta_id', idsDasConsultas),
        supabase.from('setores_bagua').select('consulta_id, score_percentual').in('consulta_id', idsDasConsultas),
        supabase.from('clientes').select('id', { count: 'exact', head: true }).eq('consultor_id', user.id).eq('ativo', true),
      ])

      // Falha de consulta nunca vira «não há nada»: o consultor leria a lista
      // vazia como carteira vazia e tomaria decisão sobre um dado que não veio.
      const falhou = [consultasRes, pagamentosRes, rituaisRes, prescricoesRes, setoresRes].find(r => r.error)
      if (falhou?.error) {
        logger.error('Falha ao carregar a home do consultor', {
          route: '/dashboard', userId: user.id, error: falhou.error.message,
        })
      }

      const consultas = (consultasRes.data ?? []) as unknown as {
        id: string; nome_imovel: string | null; status: string | null
        criado_em: string | null; atualizado_em: string | null
        finalizada_em: string | null; relatorio_gerado_em: string | null
        ano_construcao: number | null; ano_reforma_estrutural: number | null
        bagua_entrada: BaguaEntrada | null
        clientes?: { nome_completo: string } | null
      }[]
      const pagamentos = (pagamentosRes.data ?? []) as unknown as {
        id: string; descricao: string | null; valor: number | string | null
        status: string | null; data_vencimento: string | null; data_pagamento: string | null
        clientes?: { nome_completo: string } | null
      }[]
      const rituais = (rituaisRes.data ?? []) as unknown as {
        id: string; titulo: string | null; data_ritual: string | null
        horario: string | null; status: string | null
        clientes?: { nome_completo: string } | null
      }[]

      setTemAlgumDado(consultas.length > 0 || (clientesRes.count ?? 0) > 0)

      setPendencias(montarPendencias({ consultas, pagamentos, rituais }))

      // Prescrições e setores por consulta — o que decide as etapas 4 e 3. RLS
      // já limita as duas tabelas ao dono, então não há filtro por consultor.
      const prescricoesPorConsulta = new Map<string, number>()
      for (const p of (prescricoesRes.data ?? []) as { consulta_id: string }[]) {
        prescricoesPorConsulta.set(p.consulta_id, (prescricoesPorConsulta.get(p.consulta_id) ?? 0) + 1)
      }
      const setoresPorConsulta = new Map<string, number>()
      for (const s of (setoresRes.data ?? []) as { consulta_id: string; score_percentual: number | null }[]) {
        if (s.score_percentual == null) continue
        setoresPorConsulta.set(s.consulta_id, (setoresPorConsulta.get(s.consulta_id) ?? 0) + 1)
      }

      const vivas = consultas.filter(c => {
        const st = (c.status ?? '').toLowerCase()
        return st !== 'arquivada' && st !== 'deletada' && st !== 'finalizada'
      })

      setAtivas(vivas.map(c => ({
        id: c.id,
        nome: c.nome_imovel?.trim() || 'Imóvel sem nome',
        cliente: c.clientes?.nome_completo ?? null,
        iniciais: iniciais(c.clientes?.nome_completo ?? null),
        progresso: progressoDoDiagnostico({
          orientacaoGraus: c.bagua_entrada?.orientacao_graus,
          baguaFinalizadaEm: c.bagua_entrada?.finalizada_em,
          setoresComScore: setoresPorConsulta.get(c.id) ?? 0,
          prescricoes: prescricoesPorConsulta.get(c.id) ?? 0,
          relatorioGeradoEm: c.relatorio_gerado_em,
        }),
        diasParada: diasDesde(c.atualizado_em ?? c.criado_em),
        orientacaoGraus: typeof c.bagua_entrada?.orientacao_graus === 'number' ? c.bagua_entrada.orientacao_graus : null,
      })))

      // ── Números do mês ──────────────────────────────────────────────────
      // «Vencido» é derivado da data, como em `pendencias.ts`: o status gravado
      // e a data podem discordar, e é a data que sabe.
      let recebido = 0, aReceber = 0, vencido = 0
      for (const p of pagamentos) {
        const valor = Number(p.valor)
        if (!Number.isFinite(valor)) continue
        const st = (p.status ?? '').toLowerCase()
        if (st === 'cancelado') continue
        if (st === 'pago') {
          if (p.data_pagamento && p.data_pagamento >= inicioISO.slice(0, 10)) recebido += valor
          continue
        }
        if (p.data_vencimento && p.data_vencimento < hoje) vencido += valor
        else aReceber += valor
      }

      setNumeros({
        relatoriosEntregues: consultas.filter(c =>
          c.relatorio_gerado_em && c.relatorio_gerado_em >= inicioISO
        ).length,
        recebido, aReceber, vencido,
      })

      // ── Agenda da semana ────────────────────────────────────────────────
      setAgenda(rituais.slice(0, 5).map(r => {
        const ehHoje = r.data_ritual === hoje
        const d = r.data_ritual ? new Date(`${r.data_ritual}T12:00:00`) : null
        return {
          id: r.id,
          quando: ehHoje ? 'Hoje' : d
            ? d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' }).replace('.', '')
            : '—',
          texto: [r.titulo?.trim() || 'Ritual', r.clientes?.nome_completo].filter(Boolean).join(' · '),
          hoje: ehHoje,
        }
      }))

      setLoading(false)
    }
    carregar()
  }, [])

  const retomar = ativas[0] ?? null
  const esperando = pendencias.length

  if (loading) {
    return (
      <AppShell currentPage="dashboard">
        <div style={{ marginBottom: '18px' }}><Skeleton width="360px" height="28px" /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '18px', alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Skeleton width="100%" height="188px" />
            <Skeleton width="100%" height="240px" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Skeleton width="100%" height="140px" />
            <Skeleton width="100%" height="200px" />
          </div>
        </div>
      </AppShell>
    )
  }

  // Consultor sem nenhum dado recebe a tela de primeiro uso inteira, não quatro
  // painéis vazios com mensagens negativas.
  if (ehClienteFinal(profile)) {
    return (
      <AppShell currentPage="dashboard">
        <HomeDoCliente nome={profile?.nome_completo ?? null} />
      </AppShell>
    )
  }

  if (!temAlgumDado) {
    return (
      <AppShell currentPage="dashboard">
        <PrimeiroUso nome={profile?.nome_completo ?? null} />
      </AppShell>
    )
  }

  return (
    <AppShell currentPage="dashboard">
      <div className="home-cabecalho" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '16px', marginBottom: '18px', flexWrap: 'wrap' }}>
        <h1 style={{
          fontFamily: 'var(--font-fraunces), serif', fontSize: '25px', fontWeight: 500,
          margin: 0, color: '#0E1B2C', letterSpacing: '-0.01em',
        }}>
          {ativas.length === 0
            ? 'Nenhuma consulta em aberto'
            : `${ativas.length} ${ativas.length === 1 ? 'consulta ativa' : 'consultas ativas'}`}
          {esperando > 0 && ` · ${esperando} ${esperando === 1 ? 'esperando você' : 'esperando você'}`}
        </h1>
        <span style={{ color: '#6B7280', fontSize: '13px' }}>
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
          {' · '}{faseLunar(new Date()).nome.toLowerCase()}
        </span>
      </div>

      <div className="home-grade" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '18px', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>

          {/* ── Continue de onde parou ─────────────────────────────────── */}
          {retomar && (
            <div style={{
              background: 'linear-gradient(120deg,#0E1B2C,#1C3A52)',
              borderRadius: '14px', padding: '20px 22px', color: '#fff',
            }}>
              <p style={{ color: '#C9A227', fontSize: '11px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', margin: '0 0 8px' }}>
                Continue de onde parou
              </p>
              <p style={{ fontFamily: 'var(--font-fraunces), serif', fontSize: '21px', margin: '0 0 4px' }}>
                {retomar.nome}{retomar.cliente ? ` · ${retomar.cliente}` : ''}
              </p>
              <p style={{ color: 'rgba(255,255,255,0.66)', fontSize: '13px', margin: '0 0 12px' }}>
                {retomar.progresso.rotulo}
                {retomar.diasParada !== null && ` — última mudança ${textoDeDias(retomar.diasParada)}`}
              </p>

              {/* A barra é a etapa derivada, não um campo gravado. */}
              <div role="img"
                aria-label={`Progresso do diagnóstico: ${retomar.progresso.rotulo}`}
                style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '14px' }}>
                {coresDaBarra(retomar.progresso).map((cor, i) => (
                  <span key={i} style={{ height: '6px', flex: 1, borderRadius: '99px', background: cor }} />
                ))}
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                <Link href={`/consultas/${retomar.id}`} style={{
                  background: '#C9A227', color: '#0E1B2C', fontSize: '14px', fontWeight: 700,
                  padding: '10px 20px', borderRadius: '9px', textDecoration: 'none',
                }}>Retomar diagnóstico</Link>
                <Link href={`/bagua-planta?consulta=${retomar.id}`} style={{
                  border: '1px solid rgba(255,255,255,0.28)', color: '#fff', fontSize: '14px',
                  padding: '10px 18px', borderRadius: '9px', textDecoration: 'none',
                }}>Ver planta</Link>
                {/* A leitura da fachada é o que decide Kua da Casa e Estrelas
                    Voadoras; quando falta, dizer isso vale mais que um espaço vazio. */}
                <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>
                  {retomar.orientacaoGraus === null
                    ? 'Fachada ainda não medida'
                    : <>{retomar.orientacaoGraus.toFixed(1).replace('.', ',')}° · <strong style={{ color: '#fff' }}>{montanhaDoGrau(retomar.orientacaoGraus).nome}</strong></>}
                </span>
              </div>
            </div>
          )}

          {/* ── Precisa de você ────────────────────────────────────────── */}
          <div style={ESTILO_PAINEL}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h2 style={ESTILO_TITULO_PAINEL}>Precisa de você</h2>
              <span style={{ color: '#9CA3AF', fontSize: '12px' }}>
                {pendencias.length === 0 ? 'nada pendente' : `${pendencias.length} ${pendencias.length === 1 ? 'item' : 'itens'}`}
              </span>
            </div>
            {pendencias.length === 0 ? (
              <p style={{ color: '#6B7280', fontSize: '13px', margin: 0 }}>
                Nenhum relatório atrasado, nenhuma parcela vencida e nenhum imóvel com lacuna
                de método. Lista vazia aqui é boa notícia.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {pendencias.slice(0, 6).map((p, i, lista) => {
                  const Icone = ICONE_DA_PENDENCIA[p.tipo]
                  const tom = TOM_DA_PENDENCIA[p.tom]
                  return (
                    <div key={p.id} style={{
                      display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 8px',
                      borderBottom: i < lista.length - 1 ? '1px solid #F1EEE6' : 'none',
                    }}>
                      <span style={{
                        width: '32px', height: '32px', borderRadius: '9px', flexShrink: 0,
                        background: tom.fundo, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Icone size={17} strokeWidth={1.75} color={tom.icone} aria-hidden="true" />
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#0E1B2C' }}>{p.titulo}</p>
                        <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#9CA3AF' }}>{p.detalhe}</p>
                      </div>
                      <Link href={p.href} style={{
                        fontSize: '12px', fontWeight: 700, textDecoration: 'none', flexShrink: 0,
                        padding: '6px 12px', borderRadius: '8px',
                        ...(p.tom === 'neutro' && p.tipo === 'relatorio_nao_emitido'
                          ? { background: '#2E7D6B', color: '#fff' }
                          : { border: '1px solid #D8D0C0', color: '#0E1B2C' }),
                      }}>{p.acao}</Link>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Consultas ativas ───────────────────────────────────────── */}
          <div style={ESTILO_PAINEL}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h2 style={ESTILO_TITULO_PAINEL}>Consultas ativas</h2>
              <Link href="/consultas" style={{ fontSize: '12px', fontWeight: 700, color: '#2E7D6B', textDecoration: 'none' }}>
                Ver todas <ArrowRight size={13} strokeWidth={2.25} style={{ verticalAlign: '-2px' }} aria-hidden="true" />
              </Link>
            </div>
            {ativas.length === 0 ? (
              <p style={{ color: '#6B7280', fontSize: '13px', margin: 0 }}>
                Nenhuma consulta em aberto. As finalizadas continuam em Consultas.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {ativas.slice(0, 6).map(c => {
                  const parada = c.diasParada !== null && c.diasParada >= 14
                  return (
                    <Link key={c.id} href={`/consultas/${c.id}`} style={{
                      display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none',
                      padding: '10px 12px', border: '1px solid #F1EEE6', borderRadius: '10px',
                      opacity: parada ? 0.78 : 1,
                    }}>
                      <span style={{
                        width: '34px', height: '34px', borderRadius: '9px', flexShrink: 0,
                        background: '#E4F1EC', color: '#2E7D6B', fontSize: '12px', fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }} aria-hidden="true">{c.iniciais}</span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#0E1B2C' }}>{c.nome}</span>
                        <span style={{ display: 'block', fontSize: '12px', color: '#9CA3AF' }}>{c.cliente ?? 'Sem cliente vinculado'}</span>
                      </span>
                      <span style={{
                        fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '20px',
                        flexShrink: 0, color: '#2E7D6B', background: '#F0F6F3',
                      }}>{c.progresso.rotulo.replace('Etapa ', '')}</span>
                      <span style={{
                        fontSize: '12px', width: '68px', textAlign: 'right', flexShrink: 0,
                        color: parada ? '#B4533A' : '#9CA3AF',
                      }}>{textoDeDias(c.diasParada)}</span>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>

          {/* ── Começar ────────────────────────────────────────────────── */}
          <div style={{ background: '#F3EEE4', border: '1px solid #E7E1D6', borderRadius: '14px', padding: '18px 20px' }}>
            <p style={{ color: '#8A6E2F', fontSize: '11px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', margin: '0 0 10px' }}>
              Começar
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Link href="/consultas/nova" style={{
                background: '#2E7D6B', color: '#fff', fontSize: '14px', fontWeight: 700,
                padding: '11px 16px', borderRadius: '9px', textDecoration: 'none',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}><Plus size={16} strokeWidth={2} aria-hidden="true" />Nova consulta</Link>
              <Link href="/clientes" style={{
                border: '1px solid #D8D0C0', background: '#fff', color: '#0E1B2C', fontSize: '14px',
                padding: '11px 16px', borderRadius: '9px', textDecoration: 'none',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}><UserPlus size={16} strokeWidth={1.75} aria-hidden="true" />Novo cliente</Link>
            </div>
          </div>

          {/* ── Números do mês ─────────────────────────────────────────── */}
          <div style={ESTILO_PAINEL}>
            <h2 style={{ ...ESTILO_TITULO_PAINEL, marginBottom: '14px', textTransform: 'capitalize' }}>
              {new Date().toLocaleDateString('pt-BR', { month: 'long' })}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { rotulo: 'Relatórios entregues', valor: String(numeros.relatoriosEntregues), alerta: false },
                { rotulo: 'Recebido', valor: formatarMoeda(numeros.recebido), alerta: false },
                { rotulo: 'A receber', valor: formatarMoeda(numeros.aReceber), alerta: false },
                { rotulo: 'Vencido', valor: formatarMoeda(numeros.vencido), alerta: numeros.vencido > 0 },
              ].map(linha => (
                <div key={linha.rotulo} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px' }}>
                  <span style={{ fontSize: '13px', color: linha.alerta ? '#B4533A' : '#6B7280' }}>{linha.rotulo}</span>
                  <strong style={{ fontSize: '19px', color: linha.alerta ? '#B4533A' : '#0E1B2C' }}>{linha.valor}</strong>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #F1EEE6' }}>
              <Link href="/relatorios" style={{ fontSize: '13px', fontWeight: 700, color: '#2E7D6B', textDecoration: 'none' }}>
                Relatórios e gráficos <ArrowRight size={13} strokeWidth={2.25} style={{ verticalAlign: '-2px' }} aria-hidden="true" />
              </Link>
            </div>
          </div>

          {/* ── Agenda da semana ───────────────────────────────────────── */}
          <div style={ESTILO_PAINEL}>
            <h2 style={{ ...ESTILO_TITULO_PAINEL, marginBottom: '12px' }}>Agenda da semana</h2>
            {agenda.length === 0 ? (
              <p style={{ color: '#6B7280', fontSize: '13px', margin: 0 }}>
                Nada marcado para os próximos sete dias.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {agenda.map(item => (
                  <div key={item.id} style={{ display: 'flex', gap: '10px', alignItems: 'baseline' }}>
                    <span style={{
                      fontSize: '12px', fontWeight: 700, width: '52px', flexShrink: 0,
                      color: item.hoje ? '#2E7D6B' : '#6B7280', textTransform: 'capitalize',
                    }}>{item.quando}</span>
                    <span style={{ fontSize: '13px', color: '#3D4C58' }}>{item.texto}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        /* A grade de duas colunas não cabe em telas estreitas: vira uma coluna,
           na ordem em que as coisas importam. */
        @media (max-width: 900px) {
          .home-grade { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </AppShell>
  )
}
