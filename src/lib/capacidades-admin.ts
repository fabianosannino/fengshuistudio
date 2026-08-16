/**
 * O que cada admin pode fazer — a lista e a régua, sem I/O.
 *
 * ## Por que `role = 'admin'` não bastava
 *
 * Porque atrás de `/admin` moram coisas de alcance muito diferente. Ler o
 * relatório semanal e **promover alguém a admin** eram, até aqui, a mesma
 * permissão. Também eram a mesma permissão gerar chave de plano pago e
 * conferir a trilha de auditoria.
 *
 * Um booleano só consegue responder «entra ou não entra». A pergunta que
 * faltava é «entra para quê», e ela não é um grau da primeira — é outro eixo.
 * É a mesma separação que o ADR 0024 já faz entre papel e plano: dois eixos
 * distintos que, colados num só, produzem autorização por acidente.
 *
 * ## A régua
 *
 * `role = 'admin'` continua sendo **abrir o painel**. `capacidades_admin` diz
 * **o que se faz lá dentro**. As duas são exigidas juntas em
 * `tem_capacidade()`, e isso é deliberado: tirar o papel de alguém precisa
 * bastar para tirar tudo, sem caçar cada capacidade que a pessoa acumulou.
 *
 * ## Esta lista precisa concordar com o banco
 *
 * `public.capacidades_conhecidas()` tem as mesmas entradas, e o `CHECK` da
 * coluna recusa o que não estiver lá. Se divergirem, **o banco vence** — ele é
 * a barreira; isto aqui é o que responde antes, com mensagem melhor, e o que
 * desenha o menu.
 */

export const CAPACIDADES = [
  'chaves:ler',
  'chaves:gerar',
  'chaves:cancelar',
  'catalogo:escrever',
  'usuarios:promover',
  'assinaturas:escrever',
  'relatorios:ler',
  'reconciliacao:executar',
  'auditoria:ler',
] as const

export type Capacidade = (typeof CAPACIDADES)[number]

/**
 * O rótulo de cada uma, para a tela que concede.
 *
 * Diz o que a capacidade **permite**, não o nome técnico dela — quem concede
 * precisa entender o que está entregando, e `usuarios:promover` não explica
 * que aquilo fabrica outro administrador.
 */
export const DESCRICAO_DA_CAPACIDADE: Record<Capacidade, string> = {
  'chaves:ler': 'Ver as chaves de ativação e quem as usou',
  'chaves:gerar': 'Gerar chaves de ativação (dá plano pago a quem usar)',
  'chaves:cancelar': 'Cancelar chaves ainda não usadas',
  'catalogo:escrever': 'Cadastrar e publicar produtos da loja',
  'usuarios:promover': 'Tornar outra pessoa administradora',
  'assinaturas:escrever': 'Cancelar assinatura e conceder gratuidade',
  'relatorios:ler': 'Ver o relatório semanal (MRR, churn, receita)',
  'reconciliacao:executar': 'Rodar e corrigir a reconciliação com o Stripe',
  'auditoria:ler': 'Ler a trilha de auditoria',
}

/**
 * As capacidades que um admin recebe quando nada é dito.
 *
 * Vazio de propósito. Um padrão generoso reencenaria o defeito que esta
 * mudança desfaz: admin novo nasceria podendo promover outros, e ninguém
 * decidiria isso — seria herdado.
 */
export const CAPACIDADES_PADRAO: Capacidade[] = []

/** Tem a capacidade? A régua, sem banco. */
export function temCapacidade(
  capacidadesDoPerfil: readonly string[] | null | undefined,
  exigida: Capacidade
): boolean {
  return (capacidadesDoPerfil ?? []).includes(exigida)
}

/** É uma capacidade conhecida? Usado ao conceder, antes de tocar o banco. */
export function ehCapacidadeConhecida(valor: string): valor is Capacidade {
  return (CAPACIDADES as readonly string[]).includes(valor)
}

/**
 * A capacidade que cada item do menu exige.
 *
 * `null` significa «não tem capacidade própria» — hoje ninguém, mas a coluna
 * existe para que uma tela futura sem exigência não vire uma exceção escondida
 * num `if`.
 */
export const CAPACIDADE_DA_TELA: Record<string, Capacidade | null> = {
  '/admin/chaves': 'chaves:ler',
  '/admin/produtos': 'catalogo:escrever',
  '/admin/reconciliacao': 'reconciliacao:executar',
  '/admin/pagamentos': 'assinaturas:escrever',
  // Estornar venda nossa mexe em dinheiro que já entrou, como cancelar
  // assinatura — mesma capacidade, mesma gravidade.
  //
  // Depois de `/admin/pagamentos` de propósito: a ordem daqui é a do menu, e é
  // ela que decide onde alguém cai ao passar pelo segundo fator. Pôr esta tela
  // antes mudaria o destino de quem tem `assinaturas:escrever` sem que a
  // mudança se parecesse com uma decisão sobre destino.
  '/admin/vendas': 'assinaturas:escrever',
  '/admin/relatorios': 'relatorios:ler',
  '/admin/auditoria': 'auditoria:ler',
}

/**
 * Para onde mandar alguém que acabou de passar pelo segundo fator.
 *
 * A primeira tela que ele consegue abrir — não uma fixa. `/admin/pagamentos`
 * era o destino desde sempre, e com capacidades ele passa a ser inalcançável
 * para quem só cuida do catálogo: a pessoa entraria e levaria um redirect sem
 * explicação.
 */
export function primeiraTelaVisivel(
  capacidadesDoPerfil: readonly string[] | null | undefined
): string | null {
  for (const [rota, exigida] of Object.entries(CAPACIDADE_DA_TELA)) {
    if (exigida === null || temCapacidade(capacidadesDoPerfil, exigida)) return rota
  }
  return null
}
