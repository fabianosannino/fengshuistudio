/**
 * De quem veio o comprador — a atribuição do afiliado.
 *
 * ## O que este módulo é, e o que não é
 *
 * É a **primeira fatia da fase 5**: registrar o clique e resolver de qual
 * indicação nasceu uma compra. Não calcula comissão, não repassa dinheiro.
 *
 * A ordem não é arbitrária. Percentual e forma de pagamento dependem de
 * decisão comercial e de contador — retenção na fonte muda entre pessoa física
 * e jurídica, e isso altera quanto se paga de verdade. Nada disso impede nada:
 * quando existir, aplica-se sobre pedidos já gravados.
 *
 * **Clique não registrado, ao contrário, é atribuição perdida para sempre.**
 * Não há como descobrir amanhã de onde veio quem comprou hoje. Por isso o que
 * urge é justamente a metade que não depende de ninguém decidir nada.
 *
 * ## Entrada, não saída
 *
 * Afiliado **de entrada**: alguém traz um comprador e ganha percentual do que
 * passou pela nossa conta. Não confundir com `produtos-da-plataforma.ts` e
 * `cliques_de_indicacao`, que tratam da **saída** — link para loja de terceiro,
 * onde nenhum dinheiro nosso circula e não existe pedido deste lado.
 *
 * Mesmo nome, naturezas opostas, tabelas separadas (seção 8 do modelo da loja).
 */

import { createHash, randomBytes } from 'crypto'

/**
 * Trinta dias, e a escolha é de produto antes de ser técnica.
 *
 * «Último clique, janela de 30 dias» é o padrão do mercado e o mais fácil de
 * explicar a quem vai divulgar — e quem divulga precisa entender a regra para
 * confiar nela. Uma janela exótica seria defensável tecnicamente e ruim
 * comercialmente.
 */
export const JANELA_DE_ATRIBUICAO_DIAS = 30

/** Nome do cookie que carrega a identidade opaca do visitante. */
export const COOKIE_DO_VISITANTE = 'fs_v'

/**
 * O cookie vive um pouco mais que a janela.
 *
 * Se expirasse junto, um clique feito no último minuto do dia 30 perderia o
 * portador antes de a indicação vencer — e a atribuição morreria por
 * contabilidade de segundos, não por regra.
 */
export const COOKIE_DO_VISITANTE_DIAS = JANELA_DE_ATRIBUICAO_DIAS + 1

/**
 * A forma do código de afiliado.
 *
 * Letras, números e hífen; 4 a 32. Curto o bastante para caber num impresso e
 * legível o bastante para ser ditado ao telefone — os dois usos reais de um
 * código de divulgação.
 *
 * A mesma expressão está como `check` no banco. A duplicação é deliberada e
 * tem hierarquia: a rota recusa cedo com mensagem útil, e o banco é quem
 * garante. Se divergirem, o banco vence — mesma regra das capacidades de admin.
 */
const FORMA_DO_CODIGO = /^[a-zA-Z0-9-]{4,32}$/

export function ehCodigoDeAfiliadoValido(codigo: string | null | undefined): boolean {
  if (!codigo) return false
  return FORMA_DO_CODIGO.test(codigo)
}

/**
 * Uma identidade nova para o visitante — aleatória e sem significado.
 *
 * Não é hash de IP nem de user-agent, e a diferença importa. Aqueles são dado
 * pessoal derivado: identificam a pessoa sem pedir licença, e colocariam esta
 * tabela no inventário da LGPD. Um número aleatório não diz nada sobre
 * ninguém — só distingue esta visita das outras, que é tudo o que a atribuição
 * precisa.
 */
export function novaIdentidadeDeVisitante(): string {
  return randomBytes(24).toString('hex')
}

/**
 * O que vai para o banco: o hash, nunca o valor do cookie.
 *
 * Guardar o valor cru permitiria a quem lesse a tabela forjar o cookie e
 * reivindicar a atribuição de outro afiliado. Com o hash, ler a tabela não dá
 * poder nenhum sobre ela — a mesma razão pela qual senha não se guarda em
 * texto, aplicada a um identificador que também é credencial.
 */
export function hashDoVisitante(identidade: string): string {
  return createHash('sha256').update(identidade).digest('hex')
}

/** Quando o clique de agora deixa de valer. */
export function expiraEm(agora: Date): Date {
  return new Date(agora.getTime() + JANELA_DE_ATRIBUICAO_DIAS * 24 * 60 * 60 * 1000)
}

/** O registro do clique, no formato em que este módulo raciocina sobre ele. */
export interface IndicacaoRegistrada {
  id: string
  afiliado_perfil_id: string
  criada_em: string
  expira_em: string
}

/**
 * Qual indicação leva o crédito desta compra.
 *
 * **Último clique**: entre as vivas, ganha a mais recente. Não a primeira, e
 * não a de maior valor — quem converteu foi quem falou por último, e é a regra
 * que o afiliado consegue conferir sozinho.
 *
 * **Viva**: `expira_em` no futuro em relação ao instante da compra. A data vem
 * gravada na linha em vez de recalculada aqui, porque a janela é uma promessa
 * feita no momento da divulgação: mudar a regra amanhã não pode reescrever o
 * que valia ontem. É a forma de `concessoes_de_plano`, pelo mesmo motivo.
 *
 * `null` quando nenhuma vale — que é o caso da maioria das vendas, e não é
 * erro. Ausência ≠ zero: pedido sem indicação não é pedido com indicação de
 * valor nenhum.
 */
export function indicacaoQueAtribui(
  indicacoes: IndicacaoRegistrada[],
  agora: Date
): IndicacaoRegistrada | null {
  const vivas = indicacoes.filter(i => new Date(i.expira_em).getTime() > agora.getTime())
  if (vivas.length === 0) return null

  return vivas.reduce((maisRecente, atual) =>
    new Date(atual.criada_em).getTime() > new Date(maisRecente.criada_em).getTime()
      ? atual
      : maisRecente
  )
}

/**
 * Um afiliado não ganha comissão por trazer a si mesmo.
 *
 * Sem esta regra, o caminho mais curto para o desconto é claro: clicar no
 * próprio link antes de comprar. Não é fraude sofisticada — é o primeiro
 * pensamento de qualquer pessoa que receba um código, e uma regra que depende
 * de ninguém ter esse pensamento não é regra.
 *
 * A comparação é por perfil, e por isso só funciona quando o comprador tem
 * conta. Comprador anônimo com o próprio código não é detectável aqui — fica
 * declarado, e é o tipo de coisa que a apuração pega depois, comparando
 * cartão e conta de recebimento.
 */
export function atribuicaoValida(
  indicacao: IndicacaoRegistrada | null,
  compradorPerfilId: string | null | undefined
): boolean {
  if (!indicacao) return false
  if (!compradorPerfilId) return true
  return indicacao.afiliado_perfil_id !== compradorPerfilId
}
