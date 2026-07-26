/**
 * Remédios TIPADOS com proveniência (`Remedio` de sintese-metodos.ts) — a
 * taxonomia que a Parte IV do documento de referência especifica.
 *
 * ─── FRONTEIRA DE ESCOPO, DELIBERADA (ver ADR 0015) ──────────────────────
 *
 * Este módulo cobre APENAS as fontes de recomendação **estruturadas**, cuja
 * semântica o código conhece e portanto pode classificar com honestidade:
 *
 *   1. Conflitos clássicos cômodo×setor (`comodo-setor.ts`)
 *   2. Problemas geométricos — setor ausente / extensão (regra do terço)
 *   3. Estratégia dos Cinco Elementos (`estrategiaElemental`)
 *
 * **NÃO cobre** as 94 dicas em texto livre de `SETOR_DICAS` (70) e
 * `CRITERIO_DICAS` (24). Isso não é preguiça nem esquecimento: atribuir
 * `forcaEvidencia` a uma recomendação de Feng Shui é um julgamento de
 * literatura clássica por afirmação — decidir se "adicione cristais negros
 * como obsidiana" é consenso clássico, variante de escola ou tradição
 * popular exige conhecimento que este código não tem. Rotular errado seria
 * pior que não rotular: colocaria selo de autoridade clássica em conselho
 * que talvez seja moderno, num relatório que vai para cliente pagante.
 * Essa curadoria é tarefa de quem tem a formação, não do software.
 *
 * `gerarRecomendacoes` (o motor de texto usado por tela/detalhe/PDF) segue
 * **intocado** — este módulo é aditivo, não uma substituição.
 */

import { estrategiaElemental, normalizarElemento, NOME_ELEMENTO, ATIVADORES, type Elemento } from './cinco-elementos'
import { conflitosComodoSetor, normalizarSetor, ELEMENTO_DO_SETOR } from './comodo-setor'
import { classificacaoDaDica } from './dicas-classificadas'
import { LIMIAR_GEOMETRICO_PCT } from './recomendacoes'
import { ordenarRemedios, type Remedio } from './sintese-metodos'

export interface RemediosInput {
  nomeSetor: string
  scorePct: number
  faltaPct?: number
  excessoPct?: number
  elemento?: string | null
  comodos?: Array<string | null | undefined>
  /**
   * Dicas de texto livre que JÁ se aplicam a este setor — normalmente a união
   * de `gerarRecomendacoes(...).urgente/melhoria/manutencao`.
   *
   * Só as que estiverem curadas em `CATALOGO_DICAS` viram `Remedio`; as demais
   * são ignoradas aqui (seguem aparecendo como texto no relatório). Recebemos
   * a lista pronta de propósito: quem decide QUAIS dicas se aplicam é o motor
   * de texto, e duplicar essa lógica (limiares de score, notas de critério)
   * criaria duas fontes de verdade divergentes.
   */
  dicas?: string[]
}

/**
 * Remédios estruturados de um setor, já ordenados por "custo zero e
 * reversível primeiro" (`ordenarRemedios`, Parte IV).
 */
export function gerarRemedios(input: RemediosInput): Remedio[] {
  const { nomeSetor, scorePct, faltaPct, excessoPct, elemento, comodos, dicas } = input
  const remedios: Remedio[] = []

  // ── 1. Conflitos cômodo×setor ───────────────────────────────────────────
  // Classificação uniforme, verificada lendo as 14 curas da tabela: todas
  // são "feche porta/ralo" + acrescentar um objeto pequeno de um elemento
  // (planta, cerâmica, objeto metálico). Nenhuma exige obra — por isso
  // custo 'baixo' e reversibilidade 'facil' valem para todas.
  // `forcaEvidencia: 'consenso-classico'` porque os próprios textos invocam
  // a regra clássica de drenagem e os ciclos Sheng nomeadamente.
  // `acaoWuXing: 'nenhuma'` NÃO significa que não há ação elemental — significa
  // que o ciclo específico varia por regra (umas geram, uma exaure) e a tabela
  // de origem não codifica isso. Preencher por heurística de texto seria chute.
  if (comodos?.length) {
    conflitosComodoSetor(nomeSetor, comodos).forEach((c, i) => {
      remedios.push({
        id: `conflito-${nomeSetor}-${i}`,
        metodo: 'formas',
        setor: nomeSetor,
        problema: c.problema,
        acao: c.cura,
        mecanismo: 'elemento',
        acaoWuXing: 'nenhuma',
        custo: 'baixo',
        reversibilidade: 'facil',
        forcaEvidencia: 'consenso-classico',
        contraindicacoes: [],
        exigeSelecaoDeData: false,
      })
    })
  }

  // ── 2. Geometria (regra do terço) ───────────────────────────────────────
  // O DIAGNÓSTICO (setor ausente/extensão) é clássico e está documentado em
  // §1.7 — mas a CURA não tem forma canônica única na literatura, e é a cura
  // que está sendo recomendada aqui. Daí 'variante-de-escola', não
  // 'consenso-classico': classificar pela força do que se recomenda, não pela
  // do diagnóstico que motivou.
  if (faltaPct != null && faltaPct > LIMIAR_GEOMETRICO_PCT) {
    remedios.push({
      id: `geometria-falta-${nomeSetor}`,
      metodo: 'formas',
      setor: nomeSetor,
      problema: `Setor com área faltante (${Math.round(faltaPct)}%) — a energia de ${nomeSetor} está enfraquecida.`,
      acao: 'Compense com ativação energética intensa: mais objetos do elemento do setor, cores correspondentes e intenção.',
      mecanismo: 'ativacao',
      acaoWuXing: 'gerar',
      custo: 'baixo',
      reversibilidade: 'facil',
      forcaEvidencia: 'variante-de-escola',
      contraindicacoes: [],
      exigeSelecaoDeData: false,
    })
  }
  if (excessoPct != null && excessoPct > LIMIAR_GEOMETRICO_PCT) {
    remedios.push({
      id: `geometria-excesso-${nomeSetor}`,
      metodo: 'formas',
      setor: nomeSetor,
      problema: `Setor com excesso (${Math.round(excessoPct)}%) — pode gerar desequilíbrio em ${nomeSetor}.`,
      acao: 'Use divisórias simbólicas ou espelhos para definir limites energéticos claros.',
      mecanismo: 'bloqueio-de-forma',
      acaoWuXing: 'nenhuma',
      // Divisória física custa e é menos reversível que pendurar um objeto.
      custo: 'medio',
      reversibilidade: 'facil',
      forcaEvidencia: 'variante-de-escola',
      contraindicacoes: [],
      exigeSelecaoDeData: false,
    })
  }

  // ── 3. Estratégia dos Cinco Elementos ───────────────────────────────────
  // Construída a partir do RETORNO ESTRUTURADO de estrategiaElemental
  // (`fortalecer` / `evitar`), não das strings que ela gera — assim o ciclo
  // Wu Xing de cada remédio é conhecido, não inferido de texto.
  const setorCanonico = normalizarSetor(nomeSetor)
  const elementoSetor = normalizarElemento(elemento) ?? (setorCanonico ? ELEMENTO_DO_SETOR[setorCanonico] : null)
  if (elementoSetor) {
    const estrategia = estrategiaElemental(elementoSetor, scorePct)

    for (const alvo of estrategia.fortalecer) {
      const ehProprioElemento = alvo === elementoSetor
      remedios.push({
        id: `elemento-fortalecer-${nomeSetor}-${alvo}`,
        metodo: 'formas',
        setor: nomeSetor,
        problema: ehProprioElemento
          ? `Elemento ${NOME_ELEMENTO[alvo]} do setor está enfraquecido.`
          : `O setor precisa de nutrição pelo ciclo Sheng: ${NOME_ELEMENTO[alvo]} gera ${NOME_ELEMENTO[elementoSetor]}.`,
        acao: `Ative com ${ATIVADORES[alvo]}.`,
        mecanismo: 'elemento',
        acaoWuXing: 'gerar',
        custo: 'baixo',
        reversibilidade: 'facil',
        forcaEvidencia: 'consenso-classico',
        contraindicacoes: [],
        exigeSelecaoDeData: false,
      })
    }

    if (estrategia.fortalecer.length > 0) {
      const controlador: Elemento = estrategia.evitar
      remedios.push({
        id: `elemento-evitar-${nomeSetor}-${controlador}`,
        metodo: 'formas',
        setor: nomeSetor,
        problema: `No ciclo de controle, ${NOME_ELEMENTO[controlador]} enfraquece ${NOME_ELEMENTO[elementoSetor]}.`,
        acao: `Evite ${NOME_ELEMENTO[controlador]} em excesso neste setor.`,
        mecanismo: 'elemento',
        acaoWuXing: 'controlar',
        // É uma restrição, não uma compra: nada a gastar, e desfazer é imediato.
        custo: 'zero',
        reversibilidade: 'instantanea',
        forcaEvidencia: 'consenso-classico',
        contraindicacoes: [],
        exigeSelecaoDeData: false,
      })
    }
  }

  // ── 4. Dicas de texto livre JÁ CURADAS ──────────────────────────────────
  // Só entram as que existem em CATALOGO_DICAS. Enquanto o catálogo estiver
  // vazio (estado inicial), este bloco não produz nada — e o relatório segue
  // exibindo as dicas como texto, sem selo de evidência. Ver ADR 0015.
  for (const dica of dicas ?? []) {
    const classificacao = classificacaoDaDica(dica)
    if (!classificacao) continue
    remedios.push({
      id: `dica-${nomeSetor}-${dica.slice(0, 40)}`,
      metodo: 'formas',
      setor: nomeSetor,
      problema: `Ponto de atenção em ${nomeSetor}.`,
      acao: dica,
      mecanismo: classificacao.mecanismo,
      acaoWuXing: 'nenhuma',
      custo: classificacao.custo,
      reversibilidade: classificacao.reversibilidade,
      forcaEvidencia: classificacao.forcaEvidencia,
      contraindicacoes: [],
      exigeSelecaoDeData: false,
    })
  }

  return ordenarRemedios(remedios)
}
