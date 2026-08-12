'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../src/lib/supabase'
import { logger } from '../../src/lib/logger'
import Skeleton from '../components/Skeleton'
import { AREA_META } from '../../src/lib/constants'
import { formatarData, formatarMoeda } from '../../src/lib/formato'
import {
  curasDoSetor, setoresParaPrescrever, montarPrescricao, chaveDaPrescricao,
  type CuraDisponivel, type SetorPrescricao,
} from '../../src/lib/prescricao'
import type { SetorBagua } from '../../src/lib/types'
import { Check, Gem, Leaf, Amphora, AudioLines, ShoppingBag } from 'lucide-react'

/**
 * Curas como prescrição — a coluna da direita é o entregável.
 *
 * O catálogo por elemento continua existindo (a «Biblioteca completa»), mas
 * deixou de ser a tela: aqui os setores entram ordenados pelo score do
 * diagnóstico, cada cura tem «Prescrever», e o que é prescrito vira linha em
 * `prescricoes` — a tabela que liga o diagnóstico ao relatório, ao ritual e à
 * loja, e que até agora nunca tinha sido escrita.
 */

const ICONE_DO_TIPO = {
  cristal: Gem, planta: Leaf, objeto: Amphora, pratica: AudioLines,
} as const

const TOM_DA_URGENCIA = {
  prioridade: { fundo: '#FAEEE9', texto: '#A9613C' },
  atencao: { fundo: '#FAF3E0', texto: '#8A6E2F' },
  equilibrado: { fundo: '#F0F6F3', texto: '#2E7D6B' },
  nao_avaliado: { fundo: '#F3EEE4', texto: '#6B7280' },
} as const

const ESTILO_PAINEL: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid rgba(14,27,44,0.06)',
  borderRadius: '14px',
  boxShadow: '0 1px 2px rgba(14,27,44,0.04), 0 10px 28px -16px rgba(14,27,44,0.18)',
  padding: '18px 20px',
}

interface Prescrita {
  id: string
  titulo: string
  descricao: string | null
  objeto: string | null
  prioridade: number
  aplicada_em: string | null
}

interface Produto {
  id: string
  nome: string
  preco: number | null
}

export default function PlanoDeCuras({
  consultaId, setores,
}: {
  consultaId: string
  setores: SetorBagua[]
}) {
  const [prescritas, setPrescritas] = useState<Prescrita[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const [expandido, setExpandido] = useState<Record<string, boolean>>({})

  /**
   * Um contador em vez de uma função de recarga chamada direto: cada mutação
   * incrementa `versao`, e o efeito refaz a leitura. Isso mantém a única
   * escrita de estado dentro do efeito, com guarda de desmontagem — sem ela,
   * uma prescrição salva depois de sair da tela escreveria em componente morto.
   */
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    let ativo = true
    async function carregar() {
      const [prescricoesRes, produtosRes] = await Promise.all([
        supabase
          .from('prescricoes')
          .select('id, titulo, descricao, objeto, prioridade, aplicada_em')
          .eq('consulta_id', consultaId)
          .order('prioridade', { ascending: true }),
        supabase.from('produtos_afiliados').select('id, nome, preco'),
      ])
      if (!ativo) return

      if (prescricoesRes.error) {
        // Lista vazia por falha se leria como «nada prescrito», e o consultor
        // prescreveria de novo o que já está lá.
        logger.error('Falha ao carregar as prescrições da consulta', {
          route: '/curas', consultaId, error: prescricoesRes.error.message,
        })
        setErro('Não foi possível carregar o plano do cliente. Recarregue a página antes de prescrever.')
        setCarregando(false)
        return
      }

      setPrescritas((prescricoesRes.data ?? []) as unknown as Prescrita[])
      setProdutos((produtosRes.data ?? []) as unknown as Produto[])
      setCarregando(false)
    }
    void carregar()
    return () => { ativo = false }
  }, [consultaId, versao])

  const recarregar = () => setVersao(v => v + 1)

  const ordenados = setoresParaPrescrever(setores)

  /** Chaves já prescritas, no formato «setor|chave». */
  const jaPrescritas = new Set(prescritas.map(p => p.objeto).filter((o): o is string => typeof o === 'string'))

  const setorPorNome = new Map(setores.map(s => [s.nome, s]))

  async function prescrever(setor: SetorPrescricao, cura: CuraDisponivel) {
    const chaveCompleta = `${setor.nome}|${cura.chave}`
    if (jaPrescritas.has(chaveCompleta)) return

    setSalvando(chaveCompleta)
    setErro('')
    const linha = montarPrescricao(consultaId, setorPorNome.get(setor.nome)?.id ?? null, setor, cura)
    const { error } = await supabase.from('prescricoes').insert(linha)
    setSalvando(null)

    if (error) {
      logger.error('Falha ao prescrever cura', {
        route: '/curas', consultaId, setor: setor.nome, error: error.message,
      })
      setErro('Não foi possível prescrever esta cura. Tente novamente.')
      return
    }
    recarregar()
  }

  async function removerPrescricao(id: string) {
    setSalvando(id)
    setErro('')
    const { error } = await supabase.from('prescricoes').delete().eq('id', id)
    setSalvando(null)
    if (error) {
      logger.error('Falha ao remover prescrição', { route: '/curas', consultaId, error: error.message })
      setErro('Não foi possível remover esta cura do plano.')
      return
    }
    recarregar()
  }

  async function alternarAplicada(p: Prescrita) {
    setSalvando(p.id)
    const { error } = await supabase
      .from('prescricoes')
      .update({ aplicada_em: p.aplicada_em ? null : new Date().toISOString() })
      .eq('id', p.id)
    setSalvando(null)
    if (error) {
      logger.error('Falha ao marcar cura como aplicada', { route: '/curas', consultaId, error: error.message })
      setErro('Não foi possível atualizar o estado desta cura.')
      return
    }
    recarregar()
  }

  if (carregando) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: '18px' }}>
        <Skeleton width="100%" height="320px" />
        <Skeleton width="100%" height="320px" />
      </div>
    )
  }

  const equilibrados = ordenados.filter(s => s.urgencia === 'equilibrado')
  const aTratar = ordenados.filter(s => s.urgencia !== 'equilibrado')

  /**
   * Produtos só aparecem quando o nome casa com uma cura prescrita — nunca
   * antes. Uma vitrine solta ao lado do diagnóstico transforma a consulta em
   * catálogo, e é justamente a confusão que o produto precisa evitar.
   */
  const produtosRelacionados = produtos.filter(prod =>
    prescritas.some(p => {
      const nome = prod.nome?.toLowerCase() ?? ''
      const titulo = p.titulo?.toLowerCase() ?? ''
      return nome.length > 3 && (nome.includes(titulo) || titulo.includes(nome))
    })
  )

  const aplicadas = prescritas.filter(p => p.aplicada_em).length

  return (
    <>
      {erro && (
        <div style={{
          background: '#FEF2F2', border: '1px solid #FECACA', color: '#B4533A',
          borderRadius: '10px', padding: '10px 14px', fontSize: '13px', marginBottom: '14px',
        }}>{erro}</div>
      )}

      <div className="curas-grade" style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: '18px', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', minWidth: 0 }}>
          {aTratar.length === 0 && (
            <div style={ESTILO_PAINEL}>
              <p style={{ fontSize: '13px', color: '#6B7280', margin: 0, lineHeight: 1.6 }}>
                Nenhum setor com score abaixo do equilíbrio. Prescrever aqui seria
                tratar o que não pediu tratamento — a biblioteca completa continua
                disponível se você quiser sugerir uma ativação assim mesmo.
              </p>
            </div>
          )}

          {aTratar.map(setor => {
            const meta = AREA_META[setor.nome]
            const tom = TOM_DA_URGENCIA[setor.urgencia]
            const curas = curasDoSetor(setor.nome)
            const prescritasDoSetor = curas.filter(c => jaPrescritas.has(`${setor.nome}|${c.chave}`)).length
            const aberto = expandido[setor.nome] ?? setor.urgencia === 'prioridade'

            return (
              <div key={setor.nome} style={ESTILO_PAINEL}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    {meta && <span style={{ fontSize: '22px', color: '#2E7D6B', lineHeight: 1, fontFamily: "'Noto Serif SC', serif" }} aria-hidden="true">{meta.zh}</span>}
                    <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#0E1B2C' }}>
                      {setor.nome}{meta ? ` · ${meta.trig}` : ''}
                    </h3>
                  </div>
                  <span style={{
                    background: tom.fundo, color: tom.texto, fontSize: '12px', fontWeight: 700,
                    padding: '4px 12px', borderRadius: '20px',
                  }}>
                    {setor.score === null ? 'Não avaliado' : `Score ${setor.score}% · ${setor.rotulo}`}
                  </span>
                </div>

                <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#6B7280' }}>
                  {meta ? `Elemento ${meta.elem} · direção ${meta.dir}` : 'Setor do Ba Guá'}
                  {prescritasDoSetor > 0 && ` · ${prescritasDoSetor} no plano`}
                </p>

                {aberto ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {curas.map(cura => {
                      const chaveCompleta = `${setor.nome}|${cura.chave}`
                      const noPlano = jaPrescritas.has(chaveCompleta)
                      const Icone = ICONE_DO_TIPO[cura.tipo]
                      return (
                        <div key={cura.chave} style={{
                          display: 'flex', alignItems: 'center', gap: '12px',
                          border: '1px solid #F1EEE6', borderRadius: '11px', padding: '12px 14px',
                        }}>
                          <span style={{
                            width: '30px', height: '30px', borderRadius: '9px', flexShrink: 0,
                            background: cura.semCusto ? '#F0F6F3' : '#F3EEE4',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <Icone size={16} strokeWidth={1.75} color={cura.semCusto ? '#2E7D6B' : '#8A6E2F'} aria-hidden="true" />
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#0E1B2C' }}>{cura.titulo}</p>
                            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6B7280' }}>
                              {cura.descricao}{cura.semCusto && ' · sem custo'}
                            </p>
                          </div>
                          {noPlano ? (
                            <span style={{
                              background: '#F0F6F3', color: '#2E7D6B', fontSize: '12px', fontWeight: 700,
                              padding: '7px 13px', borderRadius: '8px', display: 'flex', gap: '6px',
                              alignItems: 'center', flexShrink: 0,
                            }}>
                              <Check size={13} strokeWidth={2.5} aria-hidden="true" />No plano
                            </span>
                          ) : (
                            <button type="button"
                              onClick={() => prescrever(setor, cura)}
                              disabled={salvando === chaveCompleta}
                              style={{
                                background: salvando === chaveCompleta ? '#9CA3AF' : '#2E7D6B',
                                color: '#fff', fontSize: '12px', fontWeight: 700, border: 'none',
                                padding: '7px 13px', borderRadius: '8px', flexShrink: 0,
                                cursor: salvando === chaveCompleta ? 'wait' : 'pointer',
                              }}
                            >{salvando === chaveCompleta ? 'Salvando…' : 'Prescrever'}</button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: '13px', color: '#9CA3AF' }}>
                    {curas.length} curas disponíveis
                    {prescritasDoSetor === 0 ? ' · nenhuma prescrita ainda' : ''}
                  </p>
                )}

                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #F1EEE6' }}>
                  <button type="button"
                    onClick={() => setExpandido(e => ({ ...e, [setor.nome]: !aberto }))}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '13px', fontWeight: 700, color: '#2E7D6B' }}
                  >{aberto ? 'Recolher' : `Ver as ${curas.length} curas deste Guá`}</button>
                </div>
              </div>
            )
          })}

          {equilibrados.length > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 18px',
              background: '#F3EEE4', border: '1px solid #E7E1D6', borderRadius: '14px',
            }}>
              <span style={{ fontSize: '13px', color: '#4A5A67' }}>
                {equilibrados.length} {equilibrados.length === 1 ? 'setor equilibrado' : 'setores equilibrados'} —{' '}
                {equilibrados.map(s => s.nome).join(', ')}
              </span>
            </div>
          )}
        </div>

        {/* ── Plano do cliente ─────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
          <div style={{ background: '#0E1B2C', borderRadius: '14px', padding: '20px', color: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px', marginBottom: '14px' }}>
              <p style={{ color: '#C9A227', fontSize: '11px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', margin: 0 }}>
                Plano do cliente
              </p>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
                {prescritas.length === 0 ? 'vazio' : `${aplicadas} de ${prescritas.length} aplicadas`}
              </span>
            </div>

            {prescritas.length === 0 ? (
              <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
                Nada prescrito ainda. O que entrar aqui é o que vai para o relatório
                do cliente e para a agenda de rituais — não é uma lista de estudo.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {prescritas.map(p => {
                  const chave = chaveDaPrescricao(p.objeto)
                  return (
                    <div key={p.id} style={{ display: 'flex', gap: '11px', alignItems: 'flex-start' }}>
                      <button type="button"
                        onClick={() => alternarAplicada(p)}
                        disabled={salvando === p.id}
                        aria-label={p.aplicada_em ? `Desmarcar ${p.titulo}` : `Marcar ${p.titulo} como aplicada`}
                        style={{
                          width: '22px', height: '22px', borderRadius: '6px', flexShrink: 0, marginTop: '1px',
                          cursor: 'pointer', padding: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          ...(p.aplicada_em
                            ? { background: '#2E7D6B', border: 'none' }
                            : { background: 'transparent', border: '2px solid rgba(255,255,255,0.35)' }),
                        }}
                      >{p.aplicada_em && <Check size={13} strokeWidth={2.5} color="#fff" aria-hidden="true" />}</button>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          margin: 0, fontSize: '13px',
                          color: p.aplicada_em ? 'rgba(255,255,255,0.55)' : '#fff',
                          textDecoration: p.aplicada_em ? 'line-through' : 'none',
                        }}>
                          {p.titulo}{chave ? ` · ${chave.setor}` : ''}
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
                          {p.aplicada_em ? `Aplicada em ${formatarData(p.aplicada_em)}` : p.descricao}
                        </p>
                      </div>
                      <button type="button" onClick={() => removerPrescricao(p.id)} disabled={salvando === p.id}
                        aria-label={`Tirar ${p.titulo} do plano`}
                        style={{
                          background: 'none', border: 'none', color: 'rgba(255,255,255,0.45)',
                          fontSize: '16px', lineHeight: 1, cursor: 'pointer', padding: '0 2px', flexShrink: 0,
                        }}>×</button>
                    </div>
                  )
                })}
              </div>
            )}

            {prescritas.length > 0 && (
              <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.12)', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {/* O plano já é lido pelo relatório e pela home do cliente — não
                    há um botão «incluir», porque não há um segundo lugar onde ele
                    poderia deixar de estar. */}
                <a href={`/consultas/${consultaId}/relatorio`} style={{
                  background: '#C9A227', color: '#0E1B2C', fontSize: '13px', fontWeight: 700,
                  padding: '10px 16px', borderRadius: '8px', textDecoration: 'none',
                }}>Ver no relatório</a>
                <a href="/calendario" style={{
                  border: '1px solid rgba(255,255,255,0.3)', color: '#fff', fontSize: '13px',
                  padding: '10px 16px', borderRadius: '8px', textDecoration: 'none',
                }}>Agendar ritual</a>
              </div>
            )}
          </div>

          <div style={ESTILO_PAINEL}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 10px', color: '#0E1B2C' }}>Da sua loja</h3>
            {produtosRelacionados.length === 0 ? (
              <p style={{ margin: 0, fontSize: '12px', color: '#9CA3AF', lineHeight: 1.5 }}>
                Produtos aparecem aqui quando correspondem a uma cura prescrita — nunca antes.
              </p>
            ) : (
              <>
                {produtosRelacionados.slice(0, 4).map(prod => (
                  <div key={prod.id} style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{
                      width: '40px', height: '40px', borderRadius: '10px', background: '#F3EEE4', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <ShoppingBag size={19} strokeWidth={1.75} color="#8A6E2F" aria-hidden="true" />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#0E1B2C' }}>{prod.nome}</p>
                      <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6B7280' }}>
                        {typeof prod.preco === 'number' ? formatarMoeda(prod.preco) : 'preço não informado'}
                      </p>
                    </div>
                  </div>
                ))}
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#9CA3AF', lineHeight: 1.5 }}>
                  Só produtos que correspondem a uma cura já prescrita.
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .curas-grade { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  )
}
