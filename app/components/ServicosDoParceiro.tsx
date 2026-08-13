/**
 * Os serviços de um parceiro, no card das buscas.
 *
 * ## Por que é componente compartilhado
 *
 * `/parceiros` (logada) e `/consultores` (pública) mostram a mesma vitrine
 * para públicos diferentes. Duas implementações divergiriam na primeira
 * mudança — e a que envelhecesse seria a pública, que é justamente a que o
 * visitante vê antes de decidir se confia.
 *
 * ## Sem botão de comprar, de propósito
 *
 * A vitrine é informativa (decisão de 13/08). Quem se interessa fala com o
 * consultor; a venda com preço fechado acontece na loja dele. Um botão aqui
 * faria a vitrine virar a loja com outro nome.
 */

'use client'

import { faixaDePreco, ROTULO_DA_MODALIDADE } from './VitrineDeServicos'

export interface ServicoVisivel {
  id: string
  perfil_id: string
  nome: string
  descricao: string | null
  modalidade: string
  duracao_minutos: number | null
  preco_a_partir_de_centavos: number | null
}

/**
 * Quantos serviços cabem num card sem transformá-lo numa lista.
 *
 * O resto não some sem avisar: o card diz quantos ficaram de fora, porque
 * cortar em silêncio faz o consultor achar que o cadastro não salvou.
 */
const MAXIMO_NO_CARD = 3

export default function ServicosDoParceiro({ servicos }: { servicos: ServicoVisivel[] }) {
  // Ausência é ausência: sem serviços, o bloco não existe — não vira «nenhum
  // serviço cadastrado», que só ocuparia o card com uma informação inútil.
  if (servicos.length === 0) return null

  const visiveis = servicos.slice(0, MAXIMO_NO_CARD)
  const restantes = servicos.length - visiveis.length

  return (
    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #F3F4F6' }}>
      <p style={{ color: '#6B7280', fontSize: '11px', fontWeight: 'bold', margin: '0 0 8px', letterSpacing: '0.02em' }}>
        SERVIÇOS
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {visiveis.map(servico => (
          <div key={servico.id}>
            <div style={{ color: '#111827', fontSize: '13px', fontWeight: 600 }}>{servico.nome}</div>
            <div style={{ color: '#6B7280', fontSize: '12px' }}>
              {ROTULO_DA_MODALIDADE[servico.modalidade] ?? servico.modalidade}
              {servico.duracao_minutos ? ` · ${servico.duracao_minutos} min` : ''}
              {' · '}{faixaDePreco(servico.preco_a_partir_de_centavos)}
            </div>
          </div>
        ))}
      </div>
      {restantes > 0 && (
        <p style={{ color: '#9CA3AF', fontSize: '12px', margin: '8px 0 0' }}>
          e mais {restantes} {restantes === 1 ? 'serviço' : 'serviços'}
        </p>
      )}
    </div>
  )
}

/** Agrupa por perfil, para o card achar os seus numa consulta só. */
export function agruparPorParceiro(servicos: ServicoVisivel[]): Record<string, ServicoVisivel[]> {
  const mapa: Record<string, ServicoVisivel[]> = {}
  for (const servico of servicos) {
    ;(mapa[servico.perfil_id] ??= []).push(servico)
  }
  return mapa
}

/** Colunas da vitrine, num lugar só — as duas buscas pedem as mesmas. */
export const COLUNAS_DA_VITRINE =
  'id, perfil_id, nome, descricao, modalidade, duracao_minutos, preco_a_partir_de_centavos'
