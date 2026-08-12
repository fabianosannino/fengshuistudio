'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '../../src/lib/supabase'
import { logger } from '../../src/lib/logger'
import Skeleton from '../components/Skeleton'
import { LOSHU_ORDER, AREA_META } from '../../src/lib/constants'
import { leituraDoSetor, resumoDaCasa } from '../../src/lib/leitura-do-cliente'
import { montanhaDoGrau } from '../../src/lib/montanhas'
import type { BaguaEntrada } from '../../src/lib/types'
import {
  Sprout, Star, Heart, Users2, Activity, Palette, BookOpen, Briefcase, HandHeart,
  Handshake, Check, ArrowRight, type LucideIcon,
} from 'lucide-react'

/**
 * Home do cliente final — a própria casa, não um painel de negócio.
 *
 * Sem gráfico de barras, sem «consultas realizadas», sem financeiro: nada disso
 * é do morador. Os nove setores vêm do mesmo Ba Guá que o consultor usa; a
 * diferença é a **leitura** — «pede atenção» no lugar de «62%», pelas razões
 * em `src/lib/leitura-do-cliente.ts` — e uma única próxima ação em vez de uma
 * lista de pendências.
 */

/** Ícone por setor do Ba Guá, nos nomes que o produto usa internamente. */
const ICONE_DO_SETOR: Record<string, LucideIcon> = {
  'Prosperidade': Sprout,
  'Fama': Star,
  'Relacionamentos': Heart,
  'Família': Users2,
  'Centro': Activity,
  'Criatividade': Palette,
  'Conhecimento': BookOpen,
  'Carreira': Briefcase,
  'Pessoas Úteis': HandHeart,
}

/**
 * Nome que o morador lê. «Centro» e «Pessoas Úteis» são termos de método; o
 * cliente reconhece «Saúde» e «Amigos». O nome interno não muda — só a etiqueta.
 */
const NOME_PARA_O_CLIENTE: Record<string, string> = {
  'Centro': 'Saúde',
  'Conhecimento': 'Sabedoria',
  'Relacionamentos': 'Amor',
  'Pessoas Úteis': 'Amigos',
}

const ESTILO_PAINEL: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid rgba(14,27,44,0.06)',
  borderRadius: '14px',
  boxShadow: '0 1px 2px rgba(14,27,44,0.04), 0 10px 28px -16px rgba(14,27,44,0.18)',
  padding: '18px 20px',
}

interface Cura {
  id: string
  titulo: string
  setor: string | null
  concluida: boolean
}

interface Casa {
  consultaId: string
  nome: string
  orientacaoGraus: number | null
  scorePorSetor: Record<string, number | null>
}

export default function HomeDoCliente({ nome }: { nome: string | null }) {
  const [loading, setLoading] = useState(true)
  const [casa, setCasa] = useState<Casa | null>(null)
  const [curas, setCuras] = useState<Cura[]>([])

  useEffect(() => {
    async function carregar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // O cliente final é o consultor da própria casa: a consulta é dele.
      const { data: consultas, error } = await supabase
        .from('consultas')
        .select('id, nome_imovel, status, bagua_entrada, setores_bagua(numero, score_percentual)')
        .eq('consultor_id', user.id)
        .not('status', 'in', '(arquivada,deletada)')
        .order('atualizado_em', { ascending: false })
        .limit(1)

      if (error) {
        // Falha de banco nunca vira «você não tem casa nenhuma».
        logger.error('Falha ao carregar a home do cliente', {
          route: '/dashboard', userId: user.id, error: error.message,
        })
        setLoading(false)
        return
      }

      const consulta = (consultas ?? [])[0] as unknown as {
        id: string; nome_imovel: string | null
        bagua_entrada: BaguaEntrada | null
        setores_bagua?: { numero: number | null; score_percentual: number | null }[]
      } | undefined

      if (!consulta) { setLoading(false); return }

      // `numero` é 1..9 na ordem do Lo Shu — a mesma de LOSHU_ORDER.
      const scorePorSetor: Record<string, number | null> = {}
      for (const setor of LOSHU_ORDER) scorePorSetor[setor] = null
      for (const s of consulta.setores_bagua ?? []) {
        const nomeSetor = typeof s.numero === 'number' ? LOSHU_ORDER[s.numero - 1] : undefined
        if (nomeSetor) scorePorSetor[nomeSetor] = s.score_percentual
      }

      setCasa({
        consultaId: consulta.id,
        nome: consulta.nome_imovel?.trim() || 'Minha casa',
        orientacaoGraus: typeof consulta.bagua_entrada?.orientacao_graus === 'number'
          ? consulta.bagua_entrada.orientacao_graus : null,
        scorePorSetor,
      })

      const { data: prescricoes } = await supabase
        .from('prescricoes')
        .select('id, titulo, prioridade, aplicada_em, setores_bagua(numero)')
        .eq('consulta_id', consulta.id)
        .order('prioridade', { ascending: true })

      setCuras(((prescricoes ?? []) as unknown as {
        id: string; titulo: string; aplicada_em: string | null
        setores_bagua?: { numero: number | null } | null
      }[]).map(p => ({
        id: p.id,
        titulo: p.titulo,
        setor: typeof p.setores_bagua?.numero === 'number' ? LOSHU_ORDER[p.setores_bagua.numero - 1] : null,
        concluida: !!p.aplicada_em,
      })))

      setLoading(false)
    }
    carregar()
  }, [])

  /**
   * Otimista de propósito: o morador marca a caixa e o risco aparece na hora.
   * Se a escrita falhar, o estado volta e a mensagem diz o que houve — o que
   * não pode acontecer é a caixa ficar marcada com o banco discordando.
   */
  async function marcarCura(cura: Cura) {
    const antes = curas
    setCuras(cs => cs.map(c => c.id === cura.id ? { ...c, concluida: !c.concluida } : c))

    const { error } = await supabase
      .from('prescricoes')
      .update({ aplicada_em: cura.concluida ? null : new Date().toISOString() })
      .eq('id', cura.id)

    if (error) {
      logger.error('Falha ao marcar cura como aplicada', {
        route: '/dashboard', action: 'marcar-cura', error: error.message,
      })
      setCuras(antes)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: '18px' }}>
        <Skeleton width="100%" height="380px" />
        <Skeleton width="100%" height="380px" />
      </div>
    )
  }

  if (!casa) {
    return (
      <div style={{ maxWidth: '640px' }}>
        <p style={{ color: '#C9A227', fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', margin: '0 0 8px' }}>
          Bem-vindo{nome ? `, ${nome.trim().split(/\s+/)[0]}` : ''}
        </p>
        <h1 style={{ fontFamily: 'var(--font-fraunces), serif', fontSize: '26px', fontWeight: 500, margin: '0 0 8px', color: '#0E1B2C' }}>
          Vamos conhecer a sua casa
        </h1>
        <p style={{ fontSize: '14px', color: '#4A5A67', margin: '0 0 20px', lineHeight: 1.6 }}>
          Cadastre o imóvel e anexe a planta baixa. A partir dela o mapa Ba Guá é
          sobreposto e cada ambiente ganha uma leitura.
        </p>
        <Link href="/consultas/nova" style={{
          background: '#2E7D6B', color: '#fff', fontSize: '14px', fontWeight: 700,
          padding: '12px 20px', borderRadius: '9px', textDecoration: 'none', display: 'inline-block',
        }}>Cadastrar minha casa</Link>
      </div>
    )
  }

  const scores = LOSHU_ORDER.map(setor => casa.scorePorSetor[setor])
  const resumo = resumoDaCasa(scores)

  // Uma ação só. A lista inteira é o trabalho do consultor; o morador precisa
  // saber por onde começar, e começar é a parte difícil.
  const proximoPasso = LOSHU_ORDER
    .map(setor => ({ setor, score: casa.scorePorSetor[setor] }))
    .filter((s): s is { setor: string; score: number } => typeof s.score === 'number')
    .sort((a, b) => a.score - b.score)[0] ?? null

  const curaDoPasso = proximoPasso
    ? curas.find(c => c.setor === proximoPasso.setor) ?? curas[0] ?? null
    : curas[0] ?? null

  const concluidas = curas.filter(c => c.concluida).length

  return (
    <>
      <div style={{ marginBottom: '18px' }}>
        <p style={{ color: '#C9A227', fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', margin: '0 0 6px' }}>
          {casa.nome}
        </p>
        <h1 style={{
          fontFamily: 'var(--font-fraunces), serif', fontSize: '27px', fontWeight: 500,
          margin: 0, color: '#0E1B2C', letterSpacing: '-0.01em',
        }}>{resumo.titulo}</h1>
      </div>

      <div className="cliente-grade" style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: '18px', alignItems: 'start' }}>

        {/* ── Mapa Ba Guá ────────────────────────────────────────────── */}
        <div style={{ ...ESTILO_PAINEL, padding: '20px', minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#0E1B2C' }}>Mapa Ba Guá da sua casa</h2>
            <span style={{ fontSize: '12px', color: '#9CA3AF' }}>
              {casa.orientacaoGraus === null
                ? 'Fachada ainda não medida'
                : `Fachada ${casa.orientacaoGraus.toFixed(0)}° · ${montanhaDoGrau(casa.orientacaoGraus).nome}`}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            {LOSHU_ORDER.map(setor => {
              const leitura = leituraDoSetor(casa.scorePorSetor[setor])
              const Icone = ICONE_DO_SETOR[setor] ?? Activity
              const rotulo = NOME_PARA_O_CLIENTE[setor] ?? setor
              return (
                <Link key={setor} href={`/consultas/${casa.consultaId}`} style={{
                  background: leitura.fundo, border: `1px solid ${leitura.borda}`,
                  borderRadius: '10px', padding: '12px 10px', textAlign: 'center',
                  textDecoration: 'none', minHeight: '48px', display: 'block',
                }}>
                  <Icone size={18} strokeWidth={1.75} color={leitura.texto} aria-hidden="true" />
                  <span style={{ display: 'block', margin: '6px 0 2px', fontSize: '13px', fontWeight: 600, color: '#0E1B2C' }}>{rotulo}</span>
                  {/* Sem percentual: o morador recebe julgamento, não score. */}
                  <span style={{ display: 'block', fontSize: '11px', color: leitura.texto, fontWeight: 700 }}>{leitura.rotulo}</span>
                </Link>
              )
            })}
          </div>

          <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #F1EEE6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <p style={{ margin: 0, fontSize: '13px', color: '#6B7280' }}>Toque em um setor para ver o que ele revela</p>
            <Link href={`/bagua-planta?consulta=${casa.consultaId}`} style={{ fontSize: '13px', fontWeight: 700, color: '#2E7D6B', textDecoration: 'none' }}>
              Ver a planta <ArrowRight size={13} strokeWidth={2.25} style={{ verticalAlign: '-2px' }} aria-hidden="true" />
            </Link>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>

          {/* ── Seu próximo passo ──────────────────────────────────────── */}
          {proximoPasso && (
            <div style={{ background: '#0E1B2C', borderRadius: '14px', padding: '20px 22px', color: '#fff' }}>
              <p style={{ color: '#C9A227', fontSize: '11px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', margin: '0 0 10px' }}>
                Seu próximo passo
              </p>
              <p style={{ fontFamily: 'var(--font-fraunces), serif', fontSize: '20px', margin: '0 0 6px' }}>
                Setor {NOME_PARA_O_CLIENTE[proximoPasso.setor] ?? proximoPasso.setor}
              </p>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', margin: '0 0 14px', lineHeight: 1.5 }}>
                {curaDoPasso?.titulo
                  ?? `É o setor que mais ${leituraDoSetor(proximoPasso.score).nivel === 'cuidado' ? 'precisa de cuidado' : 'pede atenção'} na sua casa. Comece por ele.`}
              </p>
              <Link href={`/consultas/${casa.consultaId}`} style={{
                background: '#C9A227', color: '#0E1B2C', fontSize: '14px', fontWeight: 700,
                padding: '10px 18px', borderRadius: '9px', textDecoration: 'none', display: 'inline-block',
              }}>Ver como fazer</Link>
            </div>
          )}

          {/* ── Minhas curas ───────────────────────────────────────────── */}
          <div style={ESTILO_PAINEL}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#0E1B2C' }}>Minhas curas</h2>
              <span style={{ fontSize: '12px', color: '#9CA3AF' }}>
                {curas.length === 0 ? 'nenhuma ainda' : `${concluidas} de ${curas.length} concluídas`}
              </span>
            </div>
            {curas.length === 0 ? (
              <p style={{ fontSize: '13px', color: '#6B7280', margin: 0, lineHeight: 1.5 }}>
                As curas aparecem aqui depois que os setores forem avaliados. Elas são
                as ações concretas para cada ambiente.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
                {curas.slice(0, 5).map(cura => (
                  <div key={cura.id} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button type="button"
                      onClick={() => marcarCura(cura)}
                      aria-label={cura.concluida ? `Desmarcar ${cura.titulo}` : `Marcar ${cura.titulo} como feita`}
                      style={{
                        width: '22px', height: '22px', borderRadius: '6px', flexShrink: 0,
                        padding: 0, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        ...(cura.concluida
                          ? { background: '#2E7D6B', border: 'none' }
                          : { background: 'transparent', border: '2px solid #D8D0C0' }),
                      }}>
                      {cura.concluida && <Check size={13} strokeWidth={2.5} color="#fff" aria-hidden="true" />}
                    </button>
                    <span style={{
                      fontSize: '13px',
                      color: cura.concluida ? '#9CA3AF' : '#0E1B2C',
                      textDecoration: cura.concluida ? 'line-through' : 'none',
                    }}>{cura.titulo}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #F1EEE6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <Link href="/curas" style={{ fontSize: '13px', fontWeight: 700, color: '#2E7D6B', textDecoration: 'none' }}>
                Ver todas as curas <ArrowRight size={13} strokeWidth={2.25} style={{ verticalAlign: '-2px' }} aria-hidden="true" />
              </Link>
              <span style={{ fontSize: '12px', color: '#9CA3AF' }}>Toque na caixa ao aplicar</span>
            </div>
          </div>

          {/* ── Ponte para a rede ──────────────────────────────────────── */}
          <div style={{
            background: '#F3EEE4', border: '1px solid #E7E1D6', borderRadius: '14px',
            padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap',
          }}>
            <span style={{
              width: '44px', height: '44px', borderRadius: '50%', background: '#2E7D6B', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Handshake size={21} strokeWidth={1.75} color="#fff" aria-hidden="true" />
            </span>
            <div style={{ flex: 1, minWidth: '160px' }}>
              <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: 700, color: '#0E1B2C' }}>Quer o diagnóstico completo?</p>
              <p style={{ margin: 0, fontSize: '12px', color: '#6B7280' }}>Um consultor revisa sua planta e assina o relatório</p>
            </div>
            <Link href="/parceiros" style={{
              background: '#0E1B2C', color: '#C9A227', fontSize: '13px', fontWeight: 700,
              padding: '9px 16px', borderRadius: '8px', textDecoration: 'none', whiteSpace: 'nowrap',
            }}>Ver consultores</Link>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .cliente-grade { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  )
}
