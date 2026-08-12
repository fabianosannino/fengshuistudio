/**
 * Fluxo de Chi — «não verifiquei» não é «está errado».
 *
 * ## O defeito que isto corrige
 *
 * O checklist guardava `string[]` com os itens marcados, e o score era
 * `marcados / total`. Só existiam dois estados, e o que faltava era ambíguo:
 * um item desmarcado tanto podia ser um problema encontrado quanto um ponto
 * que o consultor não chegou a olhar.
 *
 * Na prática isso significa que **um imóvel não avaliado pontua igual a um
 * imóvel problemático** — 0%. E o relatório do cliente apresentava esse 0%
 * como diagnóstico, quando era ausência de diagnóstico.
 *
 * ## A regra
 *
 * Três estados por item: `conforme`, `problema` e — pela ausência da chave —
 * não verificado. O score passa a ser `conforme / (conforme + problema)`, ou
 * seja, a proporção do que **foi olhado**. Item não verificado não entra no
 * denominador, e a tela informa quantos faltam.
 *
 * Um imóvel com 2 itens olhados e ambos conformes tem 100% de conformidade
 * *sobre o que foi verificado* — e o `verificados: 2 de 11` ao lado impede que
 * isso seja lido como diagnóstico completo.
 */

export type EstadoDoItem = 'conforme' | 'problema'

/**
 * Como o checklist é gravado em `consultas.checklist_chi`.
 *
 * A ausência da chave é o terceiro estado. Guardar `'nao_verificado'`
 * explicitamente pareceria mais claro, mas obrigaria a escrever uma linha para
 * cada item que ninguém tocou — e o padrão de um checklist novo é justamente
 * ninguém ter tocado em nada.
 */
export type ChecklistChi = Record<string, EstadoDoItem>

/**
 * Aceita o formato antigo (`string[]` = itens marcados) e o novo.
 *
 * No formato antigo, marcado significava «verifiquei e está conforme» — é a
 * leitura fiel do que o consultor fez, e a única que não inventa problema onde
 * havia silêncio.
 */
export function normalizarChecklist(valor: unknown): ChecklistChi {
  if (Array.isArray(valor)) {
    const saida: ChecklistChi = {}
    for (const id of valor) {
      if (typeof id === 'string') saida[id] = 'conforme'
    }
    return saida
  }

  if (valor && typeof valor === 'object') {
    const saida: ChecklistChi = {}
    for (const [id, estado] of Object.entries(valor as Record<string, unknown>)) {
      if (estado === 'conforme' || estado === 'problema') saida[id] = estado
    }
    return saida
  }

  return {}
}

export interface ResumoDoChi {
  conforme: number
  problema: number
  naoVerificado: number
  total: number
  /**
   * Conformidade sobre o que foi verificado, 0–100. `null` quando nada foi
   * verificado — e `null` é diferente de `0`: um é «não sei», o outro é «tudo
   * que olhei está errado».
   */
  score: number | null
  /** `true` quando todo item do checklist tem estado. */
  completo: boolean
  /** «8 de 11 pontos verificados» — o texto que qualifica o score. */
  texto: string
}

export function resumirChi(checklist: ChecklistChi, idsDoChecklist: string[]): ResumoDoChi {
  let conforme = 0
  let problema = 0

  for (const id of idsDoChecklist) {
    const estado = checklist[id]
    if (estado === 'conforme') conforme++
    else if (estado === 'problema') problema++
  }

  const verificados = conforme + problema
  const total = idsDoChecklist.length
  const naoVerificado = total - verificados

  return {
    conforme,
    problema,
    naoVerificado,
    total,
    score: verificados === 0 ? null : Math.round((conforme / verificados) * 100),
    completo: naoVerificado === 0,
    texto: verificados === 0
      ? `Nenhum dos ${total} pontos verificado`
      : `${verificados} de ${total} pontos verificados`,
  }
}

/**
 * Próximo estado ao clicar. Ciclo: não verificado → conforme → problema →
 * não verificado.
 *
 * O ciclo começa em «conforme» porque é o caso comum: o consultor percorre a
 * lista confirmando o que está certo e para nos que não estão.
 */
export function proximoEstado(atual: EstadoDoItem | undefined): EstadoDoItem | undefined {
  if (atual === undefined) return 'conforme'
  if (atual === 'conforme') return 'problema'
  return undefined
}

/** Aplica o estado a um item, removendo a chave quando volta a não verificado. */
export function definirEstado(
  checklist: ChecklistChi,
  id: string,
  estado: EstadoDoItem | undefined
): ChecklistChi {
  const saida = { ...checklist }
  if (estado === undefined) delete saida[id]
  else saida[id] = estado
  return saida
}

/** Ids com problema encontrado — o que vira pauta no relatório. */
export function itensComProblema(checklist: ChecklistChi, idsDoChecklist: string[]): string[] {
  return idsDoChecklist.filter(id => checklist[id] === 'problema')
}

/** Ids que ninguém olhou — a lacuna que o relatório precisa declarar. */
export function itensNaoVerificados(checklist: ChecklistChi, idsDoChecklist: string[]): string[] {
  return idsDoChecklist.filter(id => checklist[id] === undefined)
}
