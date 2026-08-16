'use client'

/**
 * Editar um produto e agendar promoção — o painel que abre dentro do cartão.
 *
 * ## Por que existe
 *
 * Até 16/08 a tela de catálogo só cadastrava e publicava. Corrigir um preço
 * digitado errado obrigava a criar produto novo — e produto novo com o mesmo
 * nome polui o histórico de vendas, que é justamente onde se olha quando o
 * preço parece errado.
 *
 * A rota `PATCH` já aceitava `nome`, `descricao` e `preco_centavos` desde a
 * fase 2; nunca houve tela que os enviasse. Era capacidade de servidor sem
 * interface — que na prática é capacidade nenhuma.
 *
 * ## A promoção é uma janela, não um botão
 *
 * Não existe «ativar promoção». Existe **de quando até quando**, e o preço
 * volta sozinho ao cheio quando a janela fecha (ADR 0027). É por isso que os
 * três estados aparecem por escrito aqui — «agendada», «rodando» e «encerrada»
 * se parecem na vitrine, onde as duas últimas mostram o preço cheio, e sem
 * distingui-las o admin recadastra uma campanha que já está no ar.
 */

import { useState } from 'react'
import { Tag, X } from 'lucide-react'
import {
  situacaoDaPromocao, precoVigente, descontoEmPorcento,
  type SituacaoDaPromocao,
} from '../../../src/lib/promocao-do-produto'

export interface ProdutoEditavel {
  id: string
  nome: string
  descricao: string | null
  preco_centavos: number
  modo_de_venda: 'marketplace' | 'indicacao'
  promocao_preco_centavos: number | null
  promocao_inicio: string | null
  promocao_fim: string | null
}

/**
 * Reais digitados → centavos.
 *
 * Aceita «19,90» e «19.90»: exigir o ponto num campo em pt-BR é transformar o
 * teclado do admin em fonte de erro de preço.
 */
function centavosDe(texto: string): number | null {
  const n = Number(texto.replace(',', '.'))
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n * 100)
}

/**
 * `datetime-local` fala no fuso do browser e o banco guarda em UTC.
 *
 * As duas conversões ficam juntas aqui de propósito. Separadas, uma delas
 * acabaria esquecida — e o sintoma seria uma campanha começando três horas
 * antes ou depois do que o admin digitou, que ninguém atribui a fuso.
 */
function paraCampoLocal(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const desloc = d.getTimezoneOffset() * 60_000
  return new Date(d.getTime() - desloc).toISOString().slice(0, 16)
}

function doCampoLocal(valor: string): string {
  // `new Date('2026-08-20T18:00')` já interpreta no fuso local — é a metade
  // que o browser faz de graça.
  return new Date(valor).toISOString()
}

const ROTULO: Record<SituacaoDaPromocao, string> = {
  sem_promocao: '',
  agendada: 'Promoção agendada',
  rodando: 'Promoção rodando',
  encerrada: 'Promoção encerrada',
}

const COR: Record<SituacaoDaPromocao, { fundo: string; texto: string }> = {
  sem_promocao: { fundo: '#F3F4F6', texto: '#6B7280' },
  agendada: { fundo: '#FAF3E0', texto: '#8A6E2F' },
  rodando: { fundo: '#FDECEC', texto: '#A33A3A' },
  encerrada: { fundo: '#F3F4F6', texto: '#6B7280' },
}

/** O selo do cartão. Fora do formulário porque a lista inteira o mostra. */
export function SeloDaPromocao({ produto, agora }: { produto: ProdutoEditavel; agora: Date }) {
  const situacao = situacaoDaPromocao(produto, agora)
  if (situacao === 'sem_promocao') return null

  const vigente = precoVigente(produto, agora)
  const desconto = descontoEmPorcento(vigente)
  const cor = COR[situacao]

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      background: cor.fundo, color: cor.texto, padding: '3px 9px',
      borderRadius: '999px', fontSize: '12px', fontWeight: 'bold',
    }}>
      <Tag size={12} aria-hidden="true" />
      {ROTULO[situacao]}
      {desconto !== null && ` · −${desconto}%`}
    </span>
  )
}

interface Props {
  produto: ProdutoEditavel
  onSalvo: () => Promise<void> | void
  onFechar: () => void
  onErro: (mensagem: string) => void
}

const ROTA = '/api/admin/produtos'

export default function EditarProduto({ produto, onSalvo, onFechar, onErro }: Props) {
  const [nome, setNome] = useState(produto.nome)
  const [descricao, setDescricao] = useState(produto.descricao ?? '')
  const [preco, setPreco] = useState((produto.preco_centavos / 100).toFixed(2).replace('.', ','))

  const temPromocao = produto.promocao_preco_centavos !== null
  const [precoPromo, setPrecoPromo] = useState(
    temPromocao ? (produto.promocao_preco_centavos! / 100).toFixed(2).replace('.', ',') : ''
  )
  const [inicio, setInicio] = useState(paraCampoLocal(produto.promocao_inicio))
  const [fim, setFim] = useState(paraCampoLocal(produto.promocao_fim))

  const [salvando, setSalvando] = useState(false)

  // Indicação não tem promoção: quem define o preço é o parceiro (ADR 0032).
  // O banco recusa por constraint; aqui o campo simplesmente não aparece.
  const podeTerPromocao = produto.modo_de_venda !== 'indicacao'

  async function enviar(corpo: Record<string, unknown>) {
    setSalvando(true)
    try {
      const res = await fetch(ROTA, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: produto.id, ...corpo }),
      })
      const dados = await res.json().catch(() => ({}))
      if (!res.ok) { onErro(dados.error ?? 'Não foi possível salvar.'); return false }
      await onSalvo()
      return true
    } finally {
      setSalvando(false)
    }
  }

  async function salvar() {
    const centavos = centavosDe(preco)
    if (centavos === null) { onErro('Informe um preço válido.'); return }

    const corpo: Record<string, unknown> = {
      nome, descricao, preco_centavos: centavos,
    }

    /*
     * A promoção só vai junto quando os três campos estão preenchidos.
     *
     * Mandar parcial faria o servidor recusar o pedido inteiro — inclusive a
     * correção de nome que o admin veio fazer. Aqui, campo de promoção vazio
     * significa «não mexi nisso», e o valor no banco fica como está.
     */
    if (podeTerPromocao && precoPromo && inicio && fim) {
      const promo = centavosDe(precoPromo)
      if (promo === null) { onErro('Informe um preço promocional válido.'); return }
      corpo.promocao = {
        preco_centavos: promo,
        inicio: doCampoLocal(inicio),
        fim: doCampoLocal(fim),
      }
    }

    if (await enviar(corpo)) onFechar()
  }

  /** Encerrar antes da hora: o prazo pode ter sido digitado errado. */
  async function encerrarPromocao() {
    if (await enviar({ promocao: null })) {
      setPrecoPromo(''); setInicio(''); setFim('')
    }
  }

  const campo = {
    width: '100%', padding: '9px 11px', border: '1px solid #E5E7EB',
    borderRadius: '8px', fontSize: '14px', fontFamily: 'inherit',
  }
  const rotulo = {
    display: 'block', color: '#6B7280', fontSize: '12px',
    fontWeight: 600, margin: '0 0 4px',
  }

  return (
    <div style={{
      marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #F3F4F6',
      display: 'flex', flexDirection: 'column', gap: '12px',
    }}>
      <div>
        <label style={rotulo} htmlFor={`nome-${produto.id}`}>Nome</label>
        <input id={`nome-${produto.id}`} style={campo} value={nome} maxLength={120}
          onChange={e => setNome(e.target.value)} />
      </div>

      <div>
        <label style={rotulo} htmlFor={`desc-${produto.id}`}>Descrição</label>
        <textarea id={`desc-${produto.id}`} maxLength={600} value={descricao}
          onChange={e => setDescricao(e.target.value)}
          style={{ ...campo, minHeight: '64px', resize: 'vertical' }} />
      </div>

      <div style={{ maxWidth: '180px' }}>
        <label style={rotulo} htmlFor={`preco-${produto.id}`}>Preço cheio (R$)</label>
        <input id={`preco-${produto.id}`} style={campo} value={preco} inputMode="decimal"
          onChange={e => setPreco(e.target.value)} />
      </div>

      {podeTerPromocao && (
        <div style={{
          background: '#FAFAFA', border: '1px solid #F3F4F6',
          borderRadius: '10px', padding: '14px',
        }}>
          <p style={{ color: '#0E1B2C', fontSize: '13px', fontWeight: 700, margin: '0 0 4px' }}>
            Promoção por prazo
          </p>
          <p style={{ color: '#6B7280', fontSize: '12px', margin: '0 0 12px', lineHeight: 1.5 }}>
            O preço volta ao cheio sozinho quando a janela fecha — não é preciso
            lembrar de desligar. Pode ser agendada para começar no futuro.
          </p>

          <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
            <div>
              <label style={rotulo} htmlFor={`promo-${produto.id}`}>Preço promocional (R$)</label>
              <input id={`promo-${produto.id}`} style={campo} value={precoPromo} inputMode="decimal"
                placeholder="menor que o cheio"
                onChange={e => setPrecoPromo(e.target.value)} />
            </div>
            <div>
              <label style={rotulo} htmlFor={`inicio-${produto.id}`}>Começa em</label>
              <input id={`inicio-${produto.id}`} style={campo} type="datetime-local"
                value={inicio} onChange={e => setInicio(e.target.value)} />
            </div>
            <div>
              <label style={rotulo} htmlFor={`fim-${produto.id}`}>Termina em</label>
              <input id={`fim-${produto.id}`} style={campo} type="datetime-local"
                value={fim} onChange={e => setFim(e.target.value)} />
            </div>
          </div>

          {temPromocao && (
            <button type="button" onClick={encerrarPromocao} disabled={salvando}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                marginTop: '12px', padding: '7px 12px', background: '#fff',
                color: '#A33A3A', border: '1px solid #E5E7EB', borderRadius: '8px',
                fontSize: '13px', cursor: salvando ? 'default' : 'pointer',
              }}>
              <X size={14} aria-hidden="true" /> Encerrar promoção agora
            </button>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <button type="button" onClick={salvar} disabled={salvando || !nome.trim()}
          style={{
            padding: '9px 18px', background: '#0E1B2C', color: '#fff', border: 'none',
            borderRadius: '8px', fontSize: '14px', fontWeight: 'bold',
            cursor: salvando || !nome.trim() ? 'default' : 'pointer',
            opacity: salvando || !nome.trim() ? 0.6 : 1,
          }}>
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
        <button type="button" onClick={onFechar} disabled={salvando}
          style={{
            padding: '9px 16px', background: '#fff', color: '#6B7280',
            border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '14px',
            cursor: 'pointer',
          }}>
          Cancelar
        </button>
        <span style={{ color: '#9CA3AF', fontSize: '12px' }}>
          Preço vale para compras novas — pedidos já feitos guardam o que foi pago.
        </span>
      </div>
    </div>
  )
}
