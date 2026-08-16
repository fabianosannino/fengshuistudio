/**
 * Quanto custa **agora** — e por que isso é uma pergunta, não uma coluna.
 *
 * ## O defeito que este módulo evita antes de existir
 *
 * A forma óbvia de fazer promoção é uma coluna `em_promocao boolean` e um
 * `preco_promocional`. Ela quebra sozinha: alguém — pessoa ou rotina — precisa
 * virar o booleano quando o prazo acabar. Enquanto não vira, o banco afirma uma
 * campanha encerrada, e quem lê a afirmação é o checkout. O comprador paga o
 * preço de ontem e o extrato não bate com a vitrine de hoje.
 *
 * O ADR 0027 já nomeou isso em outro lugar: «atrasado» sai da data de
 * vencimento, nunca de `pagamentos.status`. Aqui é a mesma frase com outro
 * substantivo — «em promoção» sai da janela, nunca de uma coluna.
 *
 * ## Por que uma função só, e não duas leituras parecidas
 *
 * Porque o preço aparece em dois lugares que **precisam** concordar: o número
 * do cartão da vitrine e o `unit_amount` que vai ao Stripe. Se cada um
 * calculasse por conta, a divergência apareceria exatamente na fronteira em que
 * ninguém olha — a campanha que termina entre o carregamento da página e o
 * clique em «Comprar».
 *
 * Essa fronteira não some com uma função única; o que muda é o tamanho. Com
 * duas implementações, a janela de divergência é «alguém esqueceu de mudar os
 * dois lados». Com uma, é o intervalo real entre carregar e clicar, e o
 * servidor sempre decide por último — o preço cobrado é o do instante do
 * clique, que é o certo, porque é o instante em que o dinheiro se move.
 *
 * ## Preço nunca vem do cliente
 *
 * Vale reafirmar, porque promoção é o convite mais natural para quebrar essa
 * regra: nada aqui recebe valor do body. `precoVigente` recebe a linha do banco
 * e a hora, e é chamada no servidor. A tela usa a mesma função só para mostrar
 * o mesmo número, não para propô-lo.
 */

/** As colunas que decidem o preço. Um subconjunto de `Produto`, de propósito. */
export interface ProdutoComPreco {
  preco_centavos: number
  promocao_preco_centavos?: number | null
  promocao_inicio?: string | null
  promocao_fim?: string | null
}

export interface PrecoVigente {
  /** O que se cobra agora. É este o número que vai ao Stripe. */
  centavos: number
  emPromocao: boolean
  /**
   * O preço cheio, **só** quando há promoção rodando — é o «de» riscado.
   *
   * `null` fora da promoção em vez de repetir o valor de `centavos`: repetido,
   * a tela teria que comparar os dois para saber se risca ou não, e um dia
   * riscaria um preço igual ao lado do outro.
   */
  precoCheioCentavos: number | null
  /** Quando a janela fecha, para a tela poder dizer até quando. */
  terminaEm: string | null
}

/**
 * O preço deste produto no instante dado.
 *
 * `agora` é parâmetro e não `new Date()` interno porque a resposta **depende**
 * do instante, e um cálculo que consulta o relógio por dentro não pode ser
 * testado nas bordas — que é justamente onde ele erra.
 */
export function precoVigente(produto: ProdutoComPreco, agora: Date): PrecoVigente {
  const semPromocao: PrecoVigente = {
    centavos: produto.preco_centavos,
    emPromocao: false,
    precoCheioCentavos: null,
    terminaEm: null,
  }

  const { promocao_preco_centavos: preco, promocao_inicio: inicio, promocao_fim: fim } = produto

  // As três juntas ou nenhuma — o banco garante por constraint, e aqui a
  // checagem existe para o caso de a linha vir de outro lugar (um teste, um
  // seed, uma leitura parcial). Falta de qualquer uma é «sem promoção», não
  // erro: o produto tem preço, e recusar a venda seria pior que ignorar a
  // campanha malformada.
  if (preco == null || !inicio || !fim) return semPromocao

  const abertura = new Date(inicio).getTime()
  const fechamento = new Date(fim).getTime()
  if (Number.isNaN(abertura) || Number.isNaN(fechamento)) return semPromocao

  const t = agora.getTime()

  /*
   * Aberto em `inicio`, fechado em `fim`.
   *
   * A fronteira precisa de lado escolhido, e a escolha aqui é a mesma da janela
   * de atribuição do afiliado: «até» significa antes de. Uma campanha anunciada
   * «até dia 20» termina quando o dia 20 começa se a data gravada for o dia 20
   * — o que o admin grava é o instante do fim, e a tela mostra qual é.
   */
  if (t < abertura || t >= fechamento) return semPromocao

  // Promoção que não desconta não vira selo. O banco recusa gravar assim; se
  // uma linha antiga escapar, o comportamento honesto é cobrar o menor e não
  // riscar nada.
  if (preco >= produto.preco_centavos) return semPromocao

  return {
    centavos: preco,
    emPromocao: true,
    precoCheioCentavos: produto.preco_centavos,
    terminaEm: fim,
  }
}

/** Quanto por cento saiu do preço. Só para a tela — nunca decide cobrança. */
export function descontoEmPorcento(vigente: PrecoVigente): number | null {
  if (!vigente.emPromocao || !vigente.precoCheioCentavos) return null
  const desconto = 1 - vigente.centavos / vigente.precoCheioCentavos
  return Math.round(desconto * 100)
}

/**
 * A campanha ainda vai acontecer? Distinto de «está acontecendo».
 *
 * A tela de admin precisa dos três estados — agendada, rodando, encerrada —
 * porque só «rodando» e «encerrada» se parecem na vitrine (nos dois o preço é o
 * cheio), e confundi-los faria o admin cadastrar de novo uma campanha que já
 * está no ar para semana que vem.
 */
export type SituacaoDaPromocao = 'sem_promocao' | 'agendada' | 'rodando' | 'encerrada'

export function situacaoDaPromocao(produto: ProdutoComPreco, agora: Date): SituacaoDaPromocao {
  const { promocao_inicio: inicio, promocao_fim: fim } = produto
  if (produto.promocao_preco_centavos == null || !inicio || !fim) return 'sem_promocao'

  const t = agora.getTime()
  if (t < new Date(inicio).getTime()) return 'agendada'
  if (t >= new Date(fim).getTime()) return 'encerrada'
  return 'rodando'
}

/**
 * A promoção proposta é válida? Devolve o motivo da recusa, ou `null`.
 *
 * Repete o que o banco garante por constraint, e a repetição é deliberada — a
 * mesma escolha já feita na indicação de terceiro. Aqui vira mensagem que o
 * admin entende; lá é a garantia de que nenhum caminho escapa. Uma sem a outra
 * deixa metade do problema: só o banco dá «violates check constraint» na cara
 * de quem cadastra, e só a rota deixa um script gravar o que quiser.
 */
export type RecusaDaPromocao =
  | 'incompleta' | 'nao_desconta' | 'janela_invertida' | 'ja_terminou' | 'datas_invalidas'

export function recusaDaPromocao(
  proposta: { precoCentavos: number; inicio: string; fim: string },
  precoCheioCentavos: number,
  agora: Date
): RecusaDaPromocao | null {
  if (!proposta.inicio || !proposta.fim || !Number.isFinite(proposta.precoCentavos)) {
    return 'incompleta'
  }

  const abertura = new Date(proposta.inicio).getTime()
  const fechamento = new Date(proposta.fim).getTime()
  if (Number.isNaN(abertura) || Number.isNaN(fechamento)) return 'datas_invalidas'

  if (fechamento <= abertura) return 'janela_invertida'

  /*
   * Campanha que já terminou é aceita pelo banco — as três colunas estão
   * preenchidas e coerentes entre si. Só que ela não faz nada, e o admin sai da
   * tela achando que fez. É o defeito que só aparece quando alguém compra pelo
   * preço cheio e reclama do anúncio.
   *
   * Agendar para o futuro continua valendo: é o caso de uso, não o engano.
   */
  if (fechamento <= agora.getTime()) return 'ja_terminou'

  if (proposta.precoCentavos <= 0 || proposta.precoCentavos >= precoCheioCentavos) {
    return 'nao_desconta'
  }

  return null
}

export const MENSAGEM_DA_RECUSA: Record<RecusaDaPromocao, string> = {
  incompleta: 'Preencha preço, início e fim da promoção.',
  datas_invalidas: 'As datas da promoção não são válidas.',
  janela_invertida: 'O fim da promoção precisa vir depois do início.',
  ja_terminou: 'Essa promoção termina no passado — ela não valeria em momento nenhum.',
  nao_desconta: 'O preço promocional precisa ser menor que o preço cheio.',
}
