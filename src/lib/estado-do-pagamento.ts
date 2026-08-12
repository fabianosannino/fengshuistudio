/**
 * Estado de uma parcela — derivado da data, não lido de `status`.
 *
 * ## O defeito que isto corrige
 *
 * `pagamentos.status` guarda `'pendente' | 'pago' | 'atrasado' | 'cancelado'`.
 * «Atrasado» é o único desses quatro que **muda sozinho com o tempo**, e nada
 * roda um job diário virando `pendente` em `atrasado`. O resultado é que os
 * dois convivem na mesma tela e discordam:
 *
 * - a lista mostrava «Pendente» numa parcela vencida há três semanas, porque o
 *   status gravado nunca foi atualizado;
 * - e os totais **contavam a mesma parcela duas vezes**: a soma de pendentes
 *   incluía todo `status = 'pendente'`, e a de atrasados somava por cima os
 *   pendentes com data vencida. Pendente + atrasado dava mais que o devido.
 *
 * A regra aqui: `pago` e `cancelado` vêm do status, porque são fatos que
 * alguém registrou. `atrasado` e `pendente` vêm da **data**, porque é ela que
 * sabe. Ninguém precisa lembrar de atualizar nada.
 *
 * O status gravado continua existindo — é o que registra que a parcela foi
 * paga. O que deixa de existir é `status = 'atrasado'` como fonte de verdade.
 */

export type EstadoDoPagamento = 'pago' | 'cancelado' | 'atrasado' | 'vence_hoje' | 'a_vencer'

export interface PagamentoParaEstado {
  status?: string | null
  data_vencimento?: string | null
  data_pagamento?: string | null
  valor?: number | string | null
}

/** 'yyyy-mm-dd' no fuso local — é assim que uma coluna `date` chega do banco. */
export function diaLocal(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function estadoDoPagamento(
  pagamento: PagamentoParaEstado,
  hoje: string = diaLocal()
): EstadoDoPagamento {
  const status = (pagamento.status ?? '').trim().toLowerCase()
  if (status === 'pago') return 'pago'
  if (status === 'cancelado') return 'cancelado'

  const vencimento = pagamento.data_vencimento
  // Sem data de vencimento não dá para dizer que está atrasado. A parcela fica
  // «a vencer» — afirmar atraso sem data seria cobrar por um prazo inventado.
  if (typeof vencimento !== 'string' || vencimento === '') return 'a_vencer'

  if (vencimento < hoje) return 'atrasado'
  if (vencimento === hoje) return 'vence_hoje'
  return 'a_vencer'
}

export interface AparenciaDoEstado {
  rotulo: string
  cor: string
  fundo: string
}

/**
 * `vence_hoje` e `a_vencer` compartilham o dourado de propósito: são o mesmo
 * recado («ainda não venceu»), com urgências diferentes que o **rótulo**
 * distingue. Os outros três precisam de cores próprias e têm.
 */
export const APARENCIA: Record<EstadoDoPagamento, AparenciaDoEstado> = {
  pago: { rotulo: 'Pago', cor: '#2E7D6B', fundo: '#F0F6F3' },
  cancelado: { rotulo: 'Cancelado', cor: '#6B7280', fundo: '#F3EEE4' },
  atrasado: { rotulo: 'Vencido', cor: '#B4533A', fundo: '#FAEEE9' },
  vence_hoje: { rotulo: 'Vence hoje', cor: '#8A6E2F', fundo: '#FAF3E0' },
  a_vencer: { rotulo: 'A vencer', cor: '#8A6E2F', fundo: '#FAF3E0' },
}

/** Dias de atraso. `0` quando não está atrasada. */
export function diasDeAtraso(pagamento: PagamentoParaEstado, hoje: string = diaLocal()): number {
  if (estadoDoPagamento(pagamento, hoje) !== 'atrasado') return 0
  const venc = new Date(`${pagamento.data_vencimento}T12:00:00`).getTime()
  const ref = new Date(`${hoje}T12:00:00`).getTime()
  if (Number.isNaN(venc) || Number.isNaN(ref)) return 0
  return Math.max(0, Math.round((ref - venc) / 86_400_000))
}

export interface TotaisFinanceiros {
  recebido: number
  aReceber: number
  vencido: number
  /** Recebido + a receber + vencido — o que foi combinado, menos cancelados. */
  contratado: number
}

/**
 * Os totais, com cada parcela em **exatamente um** balde.
 *
 * A checagem que importa: `recebido + aReceber + vencido === contratado`. Era
 * ela que falhava, porque a mesma parcela entrava em dois baldes.
 */
export function totaisFinanceiros(
  pagamentos: PagamentoParaEstado[],
  hoje: string = diaLocal()
): TotaisFinanceiros {
  let recebido = 0, aReceber = 0, vencido = 0

  for (const p of pagamentos) {
    const valor = Number(p.valor)
    if (!Number.isFinite(valor)) continue

    switch (estadoDoPagamento(p, hoje)) {
      case 'pago': recebido += valor; break
      case 'atrasado': vencido += valor; break
      case 'cancelado': break // fora do contratado, de propósito
      default: aReceber += valor
    }
  }

  return { recebido, aReceber, vencido, contratado: recebido + aReceber + vencido }
}

/**
 * A régua da parcela: onde ela está entre combinada e recebida.
 *
 * Três marcos, não quatro: «enviado» e «aberto» exigem um link de cobrança com
 * rastreio, que ainda não existe. Inventar os dois marcos aqui e desenhá-los
 * apagados sugeriria que o produto sabe se o cliente abriu a cobrança — e ele
 * não sabe.
 */
export interface MarcoDaRegua {
  rotulo: string
  cumprido: boolean
  atual: boolean
}

export function reguaDaParcela(
  pagamento: PagamentoParaEstado,
  hoje: string = diaLocal()
): MarcoDaRegua[] {
  const estado = estadoDoPagamento(pagamento, hoje)
  const pago = estado === 'pago'
  const vencido = estado === 'atrasado'

  return [
    { rotulo: 'Combinada', cumprido: true, atual: false },
    { rotulo: vencido ? 'Vencida' : 'A vencer', cumprido: pago || vencido, atual: !pago && !vencido },
    { rotulo: 'Recebida', cumprido: pago, atual: vencido },
  ]
}
