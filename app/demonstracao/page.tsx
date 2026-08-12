'use client'

import Link from 'next/link'
import AppShell from '../components/AppShell'
import { AREA_META, LIMIAR_SCORE_BOM, LIMIAR_SCORE_CRITICO } from '../../src/lib/constants'
import {
  IMOVEL_EXEMPLO, FACHADA_GRAUS_EXEMPLO, ANO_CONSTRUCAO_EXEMPLO, setoresDaDemonstracao,
} from '../../src/lib/demonstracao'
import { gerarRecomendacoes, criteriosPorNomeParaArray } from '../../src/lib/recomendacoes'
import { montanhaDoGrau } from '../../src/lib/montanhas'
import { calcularEstrelasVoadoras, type Palacio } from '../../src/lib/estrelas-voadoras'
import { periodoDoAno, faixaDoPeriodo } from '../../src/lib/periodo-do-imovel'
import { Compass, Info, ArrowRight } from 'lucide-react'

/**
 * Demonstração — o produto funcionando, sem gravar nada.
 *
 * Nenhuma consulta é criada, nenhuma vaga do plano é ocupada e nada entra nas
 * contagens do mês: «sem afetar seus dados» é literal. Os insumos (notas por
 * critério, fachada, ano) são fixos em `src/lib/demonstracao.ts`; os
 * **resultados** saem dos mesmos módulos que a tela real usa, para a
 * demonstração não virar mentira na primeira mudança de limiar.
 */

const NIVEIS = {
  bom: { rotulo: 'Em harmonia', fundo: '#F0F6F3', texto: '#2E7D6B' },
  atencao: { rotulo: 'Pede atenção', fundo: '#FAF3E0', texto: '#8A6E2F' },
  critico: { rotulo: 'Precisa de cuidado', fundo: '#FAEEE9', texto: '#A9613C' },
  ausente: { rotulo: 'Não avaliado', fundo: '#F3EEE4', texto: '#6B7280' },
} as const

function nivelDoScore(score: number | null) {
  if (score === null) return NIVEIS.ausente
  if (score >= LIMIAR_SCORE_BOM) return NIVEIS.bom
  if (score >= LIMIAR_SCORE_CRITICO) return NIVEIS.atencao
  return NIVEIS.critico
}

const ESTILO_PAINEL: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid rgba(14,27,44,0.06)',
  borderRadius: '14px',
  boxShadow: '0 1px 2px rgba(14,27,44,0.04), 0 10px 28px -16px rgba(14,27,44,0.18)',
  padding: '18px 20px',
}

export default function Demonstracao() {
  const setores = setoresDaDemonstracao()
  const montanha = montanhaDoGrau(FACHADA_GRAUS_EXEMPLO)
  const periodo = periodoDoAno(ANO_CONSTRUCAO_EXEMPLO)
  const mapa = periodo ? calcularEstrelasVoadoras({ facingGraus: FACHADA_GRAUS_EXEMPLO, periodo: periodo.periodo }) : null
  const faixa = faixaDoPeriodo(ANO_CONSTRUCAO_EXEMPLO)

  // O setor mais crítico avaliado — é dele que sai o exemplo de recomendação.
  const avaliados = setores.filter(s => s.score !== null)
  const pior = avaliados.reduce((a, b) => (a.score! <= b.score! ? a : b), avaliados[0])
  const recomendacoes = gerarRecomendacoes({
    nomeSetor: pior.nome,
    scorePct: pior.score!,
    criterios: criteriosPorNomeParaArray(pior.criterios),
    elemento: AREA_META[pior.nome]?.elem,
  })

  const porPalacio = mapa ? Object.fromEntries(mapa.palacios.map(p => [p.palacio, p])) : null
  const LINHAS_PALACIO: Palacio[][] = [['SE', 'S', 'SW'], ['E', 'C', 'W'], ['NE', 'N', 'NW']]

  return (
    <AppShell currentPage="demonstracao">
      {/* Que isto é exemplo precisa estar no topo, não num rodapé: alguém que
          chega direto por link não deve confundir com a própria carteira. */}
      <div style={{
        background: '#FAF3E0', border: '1px solid #F0DFAE', borderRadius: '12px',
        padding: '14px 18px', marginBottom: '20px',
        display: 'flex', gap: '12px', alignItems: 'flex-start',
      }}>
        <Info size={20} strokeWidth={1.75} color="#8A6E2F" style={{ flexShrink: 0, marginTop: '1px' }} aria-hidden="true" />
        <div>
          <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#0E1B2C' }}>
            Diagnóstico de exemplo — nomes e endereço fictícios
          </p>
          <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#6B7280', lineHeight: 1.5 }}>
            Nada aqui é gravado: nenhuma consulta é criada, nenhuma vaga do seu plano é usada
            e nenhum número do seu mês muda. Os cálculos são os mesmos das telas reais.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '16px', marginBottom: '18px', flexWrap: 'wrap' }}>
        <div>
          <p style={{ color: '#C9A227', fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', margin: '0 0 6px' }}>
            Demonstração
          </p>
          <h1 style={{ fontFamily: 'var(--font-fraunces), serif', fontSize: '25px', fontWeight: 500, margin: 0, color: '#0E1B2C', letterSpacing: '-0.01em' }}>
            {IMOVEL_EXEMPLO.nome} · {IMOVEL_EXEMPLO.cliente}
          </h1>
          <p style={{ color: '#6B7280', fontSize: '13px', margin: '4px 0 0' }}>
            {IMOVEL_EXEMPLO.tipo} · {IMOVEL_EXEMPLO.cidade}
          </p>
        </div>
        <Link href="/consultas/nova" style={{
          background: '#2E7D6B', color: '#fff', fontSize: '14px', fontWeight: 700,
          padding: '11px 18px', borderRadius: '9px', textDecoration: 'none',
        }}>Criar a minha primeira consulta</Link>
      </div>

      <div className="demo-grade" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '18px', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>

          {/* ── Grade dos setores ──────────────────────────────────────── */}
          <div style={ESTILO_PAINEL}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 4px', color: '#0E1B2C' }}>Os nove setores</h2>
            <p style={{ fontSize: '12px', color: '#9CA3AF', margin: '0 0 14px' }}>
              Na disposição do Lo Shu. O score é a média dos oito critérios avaliados.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {setores.map(setor => {
                const nivel = nivelDoScore(setor.score)
                const meta = AREA_META[setor.nome]
                return (
                  <div key={setor.nome} style={{
                    background: nivel.fundo, borderRadius: '12px', padding: '14px 12px',
                    textAlign: 'center', border: '1px solid rgba(14,27,44,0.05)',
                  }}>
                    {meta && (
                      <div style={{ fontSize: '18px', color: nivel.texto, fontFamily: "'Noto Serif SC', serif", lineHeight: 1 }} aria-hidden="true">{meta.zh}</div>
                    )}
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#0E1B2C', margin: '6px 0 2px' }}>{setor.nome}</div>
                    <div style={{ fontSize: '19px', fontWeight: 700, color: nivel.texto }}>
                      {setor.score === null ? '—' : `${setor.score}%`}
                    </div>
                    <div style={{ fontSize: '11px', color: nivel.texto }}>{nivel.rotulo}</div>
                  </div>
                )
              })}
            </div>
            {/* Um setor sem avaliação aparece como «—», não como 0%: são coisas
                diferentes, e o produto inteiro segue essa regra. */}
            {setores.some(s => s.score === null) && (
              <p style={{ fontSize: '12px', color: '#8A6E2F', background: '#FAF3E0', border: '1px solid #EEDFB4', borderRadius: '8px', padding: '8px 12px', margin: '12px 0 0' }}>
                «Pessoas Úteis» aparece como «—» porque não foi avaliado. Não avaliado não
                é 0% — o relatório declara a lacuna em vez de preenchê-la.
              </p>
            )}
          </div>

          {/* ── Recomendações do setor mais crítico ────────────────────── */}
          <div style={ESTILO_PAINEL}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 4px', color: '#0E1B2C' }}>
              O que o produto recomenda para {pior.nome}
            </h2>
            <p style={{ fontSize: '12px', color: '#9CA3AF', margin: '0 0 14px' }}>
              Setor com o menor score ({pior.score}%). Custo zero e reversível primeiro.
            </p>
            {([
              { titulo: 'Urgente', itens: recomendacoes.urgente, cor: '#B4533A' },
              { titulo: 'Melhoria', itens: recomendacoes.melhoria, cor: '#8A6E2F' },
              { titulo: 'Manutenção', itens: recomendacoes.manutencao, cor: '#2E7D6B' },
            ] as const).filter(g => g.itens.length > 0).map(grupo => (
              <div key={grupo.titulo} style={{ marginBottom: '12px' }}>
                <p style={{ fontSize: '12px', fontWeight: 700, color: grupo.cor, margin: '0 0 6px' }}>{grupo.titulo}</p>
                {grupo.itens.slice(0, 4).map((texto, i) => (
                  <p key={i} style={{ fontSize: '13px', color: '#3D4C58', margin: '0 0 5px', paddingLeft: '12px', lineHeight: 1.5 }}>• {texto}</p>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>

          {/* ── Orientação ─────────────────────────────────────────────── */}
          <div style={{ background: 'linear-gradient(120deg,#0E1B2C,#1C3A52)', borderRadius: '14px', padding: '18px 20px', color: '#fff' }}>
            <p style={{ color: '#C9A227', fontSize: '11px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', margin: '0 0 10px' }}>
              Orientação da fachada
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Compass size={30} strokeWidth={1.5} color="#C9A227" aria-hidden="true" />
              <div>
                <p style={{ margin: 0, fontFamily: 'var(--font-fraunces), serif', fontSize: '22px' }}>
                  {FACHADA_GRAUS_EXEMPLO.toFixed(1).replace('.', ',')}°
                </p>
                <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.72)' }}>
                  Montanha <strong style={{ color: '#fff' }}>{montanha.nome}</strong>
                </p>
              </div>
            </div>
            <p style={{ margin: '12px 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
              É esta leitura que habilita o Kua da Casa e as Estrelas Voadoras. Sem ela,
              as duas seções ficam de fora do relatório.
            </p>
          </div>

          {/* ── Estrelas Voadoras ──────────────────────────────────────── */}
          {mapa && porPalacio && (
            <div style={ESTILO_PAINEL}>
              <h2 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 4px', color: '#0E1B2C' }}>
                Estrelas Voadoras — Período {mapa.periodo}
              </h2>
              <p style={{ fontSize: '12px', color: '#9CA3AF', margin: '0 0 12px' }}>
                Carta natal do Período {mapa.periodo} ({faixa.inicio}–{faixa.fim}), pela construção
                de {ANO_CONSTRUCAO_EXEMPLO}.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                {LINHAS_PALACIO.flat().map(palacio => {
                  const p = porPalacio[palacio]
                  if (!p) return <div key={palacio} />
                  return (
                    <div key={palacio} style={{
                      background: p.temEstrela5 ? '#FAEEE9' : '#F6F2E9',
                      border: '1px solid #E7E1D6', borderRadius: '8px',
                      padding: '8px 4px', textAlign: 'center',
                    }}>
                      <div style={{ fontSize: '10px', color: '#9CA3AF' }}>{palacio}</div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#0E1B2C' }}>
                        {p.montanha} · {p.periodo} · {p.fachada}
                      </div>
                    </div>
                  )
                })}
              </div>
              <p style={{ fontSize: '11px', color: '#9CA3AF', margin: '10px 0 0', lineHeight: 1.5 }}>
                Em cada palácio: montanha · período · fachada. Fundo terracota marca a
                presença do 5 (Wu Huang).
              </p>
            </div>
          )}

          <div style={{ background: '#F3EEE4', border: '1px solid #E7E1D6', borderRadius: '14px', padding: '18px 20px' }}>
            <p style={{ fontSize: '13px', color: '#3D4C58', margin: '0 0 12px', lineHeight: 1.6 }}>
              Este é o resultado de um diagnóstico completo. O seu começa cadastrando o
              imóvel e anexando a planta.
            </p>
            <Link href="/consultas/nova" style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              fontSize: '13px', fontWeight: 700, color: '#2E7D6B', textDecoration: 'none',
            }}>Começar agora <ArrowRight size={14} strokeWidth={2.25} aria-hidden="true" /></Link>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .demo-grade { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </AppShell>
  )
}
