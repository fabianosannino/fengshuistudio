/**
 * «Precisa de você» — o que está parado esperando o consultor.
 *
 * ## Por que existe
 *
 * O dashboard mostrava quatro contadores e quatro gráficos. Nenhum deles
 * respondia a pergunta que o consultor faz ao abrir o app: *o que eu preciso
 * fazer agora?* Um relatório concluído e nunca emitido, uma parcela vencida e
 * um imóvel sem leitura de fachada ficavam invisíveis até alguém lembrar.
 *
 * As seis regras abaixo saíram do handoff de design. Todas são **derivadas** do
 * dado que já existe — nenhuma cria uma tabela de tarefas, que seria mais uma
 * coisa para sincronizar e envelhecer errado.
 *
 * ## A ordem
 *
 * Dinheiro vencido primeiro, depois o que o cliente está esperando, depois o
 * que trava o método, depois o que só está parado. É a ordem do prejuízo: uma
 * parcela vencida custa dinheiro hoje; um imóvel sem ano de construção custa
 * uma seção do relatório.
 */

export type TipoDePendencia =
  | 'parcela_vencida'
  | 'relatorio_nao_emitido'
  | 'ritual_hoje'
  | 'sem_fachada'
  | 'sem_ano_construcao'
  | 'consulta_parada'

export interface Pendencia {
  tipo: TipoDePendencia
  /** Chave estável para `key` e para deduplicar. */
  id: string
  titulo: string
  /** A consequência, não a repetição do título. */
  detalhe: string
  /** Texto do botão. */
  acao: string
  href: string
  /** `alerta` pinta terracota; `atencao`, dourado; `neutro`, jade. */
  tom: 'alerta' | 'atencao' | 'neutro'
}

/** Peso de ordenação — menor vem primeiro. */
const PRIORIDADE: Record<TipoDePendencia, number> = {
  parcela_vencida: 0,
  relatorio_nao_emitido: 1,
  ritual_hoje: 2,
  sem_fachada: 3,
  sem_ano_construcao: 4,
  consulta_parada: 5,
}

/**
 * Dias entre a conclusão do diagnóstico e a cobrança do relatório.
 *
 * Dois, e não zero: emitir o PDF no mesmo dia em que se fecha o diagnóstico não
 * é atraso, é o fluxo normal. Cobrar no ato transformaria a lista num alarme
 * permanente, e uma lista que está sempre cheia deixa de ser lida.
 */
export const DIAS_ATE_COBRAR_RELATORIO = 2

/** Dias sem toque a partir dos quais uma consulta viva conta como parada. */
export const DIAS_ATE_CONSULTA_PARADA = 14

export interface ConsultaParaPendencias {
  id: string
  nome_imovel?: string | null
  status?: string | null
  atualizado_em?: string | null
  finalizada_em?: string | null
  relatorio_gerado_em?: string | null
  ano_construcao?: number | null
  ano_reforma_estrutural?: number | null
  bagua_entrada?: { orientacao_graus?: number | null; data_construcao?: string | null } | null
  clientes?: { nome_completo?: string | null } | null
}

export interface PagamentoParaPendencias {
  id: string
  descricao?: string | null
  valor?: number | string | null
  status?: string | null
  data_vencimento?: string | null
  clientes?: { nome_completo?: string | null } | null
}

export interface RitualParaPendencias {
  id: string
  titulo?: string | null
  data_ritual?: string | null
  horario?: string | null
  status?: string | null
  clientes?: { nome_completo?: string | null } | null
}

/** Dias inteiros entre duas datas, ou `null` se a primeira não for legível. */
function diasDesde(iso: string | null | undefined, agora: Date): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return Math.floor((agora.getTime() - t) / 86_400_000)
}

/** 'yyyy-mm-dd' de uma data, no fuso local — é assim que `date` chega do banco. */
function diaLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function nomeDoCliente(x: { clientes?: { nome_completo?: string | null } | null }): string | null {
  const nome = x.clientes?.nome_completo
  return typeof nome === 'string' && nome.trim() !== '' ? nome.trim() : null
}

function comCliente(base: string, nome: string | null): string {
  return nome ? `${base} · ${nome}` : base
}

function moeda(valor: number | string | null | undefined): string {
  const n = Number(valor)
  if (!Number.isFinite(n)) return ''
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export interface EntradasDePendencias {
  consultas: ConsultaParaPendencias[]
  pagamentos: PagamentoParaPendencias[]
  rituais: RitualParaPendencias[]
}

/**
 * Monta a lista. `agora` é parâmetro para o teste não depender do relógio.
 *
 * Uma consulta pode gerar mais de uma pendência (sem fachada **e** parada há
 * um mês são dois problemas diferentes, com ações diferentes). O que não
 * acontece é a mesma consulta aparecer duas vezes pelo mesmo motivo.
 */
export function montarPendencias(
  { consultas, pagamentos, rituais }: EntradasDePendencias,
  agora: Date = new Date()
): Pendencia[] {
  const pendencias: Pendencia[] = []
  const hoje = diaLocal(agora)

  // ── 1. Parcela vencida ────────────────────────────────────────────────────
  // Vencido é **derivado** da data, não lido de `status`. O status gravado e a
  // data podem discordar — e discordam, porque nada roda um job diário para
  // virar 'pendente' em 'atrasado'. Quem sabe a verdade é a data.
  for (const p of pagamentos) {
    if ((p.status ?? '').toLowerCase() === 'pago' || (p.status ?? '').toLowerCase() === 'cancelado') continue
    if (!p.data_vencimento || p.data_vencimento >= hoje) continue

    const nome = nomeDoCliente(p)
    const dias = diasDesde(p.data_vencimento, agora)
    pendencias.push({
      tipo: 'parcela_vencida',
      id: `parcela_vencida:${p.id}`,
      titulo: `${p.descricao?.trim() || 'Parcela'} vencida — ${moeda(p.valor)}`.trim(),
      detalhe: comCliente(
        dias === 0 ? 'Venceu hoje' : dias === 1 ? 'Venceu ontem' : `Venceu há ${dias} dias`,
        nome
      ),
      acao: 'Cobrar',
      href: '/pagamentos',
      tom: 'alerta',
    })
  }

  for (const c of consultas) {
    const nome = nomeDoCliente(c)
    const imovel = c.nome_imovel?.trim() || 'Imóvel sem nome'
    const status = (c.status ?? '').toLowerCase()
    const viva = status !== 'arquivada' && status !== 'deletada'

    // ── 2. Relatório não emitido ────────────────────────────────────────────
    const diasDesdeFim = diasDesde(c.finalizada_em, agora)
    if (status === 'finalizada' && !c.relatorio_gerado_em && diasDesdeFim !== null && diasDesdeFim >= DIAS_ATE_COBRAR_RELATORIO) {
      pendencias.push({
        tipo: 'relatorio_nao_emitido',
        id: `relatorio_nao_emitido:${c.id}`,
        titulo: `${imovel} — relatório não emitido`,
        detalhe: comCliente(`Diagnóstico concluído há ${diasDesdeFim} dias`, nome),
        acao: 'Gerar PDF',
        href: `/consultas/${c.id}/relatorio`,
        tom: 'neutro',
      })
    }

    if (!viva) continue

    // ── 3. Sem leitura de fachada ───────────────────────────────────────────
    // A consequência é o que importa: sem orientação não existe Kua da Casa nem
    // Estrelas Voadoras, e o relatório sai sem essas seções sem explicar por quê.
    if (typeof c.bagua_entrada?.orientacao_graus !== 'number') {
      pendencias.push({
        tipo: 'sem_fachada',
        id: `sem_fachada:${c.id}`,
        titulo: `${imovel} sem leitura de fachada`,
        detalhe: 'Sem orientação não há Kua da Casa nem Estrelas Voadoras',
        acao: 'Medir',
        href: `/bagua-planta?consulta=${c.id}`,
        tom: 'atencao',
      })
    }

    // ── 4. Sem ano de construção ────────────────────────────────────────────
    // `bagua_entrada.data_construcao` ainda vale para as consultas anteriores à
    // migration 20260812140000 — cobrar delas seria cobrar dado que já existe.
    const temAno = typeof c.ano_construcao === 'number'
      || typeof c.ano_reforma_estrutural === 'number'
      || typeof c.bagua_entrada?.data_construcao === 'string'
    if (!temAno) {
      pendencias.push({
        tipo: 'sem_ano_construcao',
        id: `sem_ano_construcao:${c.id}`,
        titulo: `${imovel} sem ano de construção`,
        detalhe: 'As Estrelas Voadoras ficam de fora do relatório',
        acao: 'Informar',
        href: `/consultas/${c.id}`,
        tom: 'atencao',
      })
    }

    // ── 5. Consulta parada ──────────────────────────────────────────────────
    const parada = diasDesde(c.atualizado_em, agora)
    if (parada !== null && parada >= DIAS_ATE_CONSULTA_PARADA) {
      pendencias.push({
        tipo: 'consulta_parada',
        id: `consulta_parada:${c.id}`,
        titulo: `${imovel} parado há ${parada} dias`,
        detalhe: comCliente('Nada mudou desde a última vez', nome),
        acao: 'Retomar',
        href: `/consultas/${c.id}`,
        tom: 'neutro',
      })
    }
  }

  // ── 6. Ritual do dia ──────────────────────────────────────────────────────
  // Só o de hoje. Ritual de amanhã não é pendência: é agenda, e tem o painel
  // dela. Uma lista de «precisa de você» com coisas de semana que vem é uma
  // lista que ninguém termina.
  for (const r of rituais) {
    if ((r.status ?? '').toLowerCase() !== 'pendente') continue
    if (r.data_ritual !== hoje) continue

    const hora = typeof r.horario === 'string' ? r.horario.slice(0, 5) : null
    pendencias.push({
      tipo: 'ritual_hoje',
      id: `ritual_hoje:${r.id}`,
      titulo: `${r.titulo?.trim() || 'Ritual'} — hoje${hora ? ` às ${hora}` : ''}`,
      detalhe: nomeDoCliente(r) ?? 'Sem cliente vinculado',
      acao: 'Abrir',
      href: '/calendario',
      tom: 'neutro',
    })
  }

  return pendencias.sort((a, b) => PRIORIDADE[a.tipo] - PRIORIDADE[b.tipo])
}
