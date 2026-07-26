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
 *   4. Dicas de texto livre **já curadas com fonte** (`dicas-classificadas.ts`
 *      + `curadoria-evidencia.ts`): 68 das 76 acionáveis. As 8 restantes não
 *      têm enunciado localizável em nenhuma obra do corpus e por isso não
 *      viram `Remedio` — seguem aparecendo como texto, sem selo de evidência.
 *      Ver ADR 0017.
 *

 * `gerarRecomendacoes` (o motor de texto usado por tela/detalhe/PDF) segue
 * **intocado** — este módulo é aditivo, não uma substituição.
 */

import { estrategiaElemental, normalizarElemento, NOME_ELEMENTO, ATIVADORES, type Elemento } from './cinco-elementos'
import { conflitosComodoSetor, normalizarSetor, ELEMENTO_DO_SETOR } from './comodo-setor'
import { classificacaoDaDica } from './dicas-classificadas'
import { alertaEstrela5 } from './estrela-anual'
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
  /**
   * Metodologia ativa ('bussola' | 'btb'). Só com `'bussola'` o setor tem
   * direção cardinal, e só então dá para dizer se a Estrela 5 anual cai aqui.
   * Ausente = trata como desconhecido, e o aviso fica genérico.
   */
  escola?: string
  /**
   * Ano solar da consulta (Li Chun aplicado — use `dataSolar(...).anoSolar`,
   * nunca `getFullYear()`). Sem ele não há alerta específico de Estrela 5.
   */
  anoSolar?: number
}

/**
 * Remédios estruturados de um setor, já ordenados por "custo zero e
 * reversível primeiro" (`ordenarRemedios`, Parte IV).
 */
export function gerarRemedios(input: RemediosInput): Remedio[] {
  const { nomeSetor, scorePct, faltaPct, excessoPct, elemento, comodos, dicas, escola, anoSolar } = input
  const remedios: Remedio[] = []

  // Alerta específico da Estrela 5 anual, quando dá para saber (só na Escola
  // da Bússola — ver ADR 0018 e `alertaEstrela5`). Substitui o aviso genérico
  // da curadoria, que fica valendo em todo o resto.
  const avisoEstrela5 = escola && anoSolar != null
    ? alertaEstrela5(nomeSetor, anoSolar, escola)
    : null

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
  // Só entram as que têm sugestão mecânica E curadoria de evidência com fonte
  // nomeada. As 8 dicas de DICAS_SEM_FONTE_LOCALIZADA nunca entram — seguem
  // aparecendo como texto no relatório, sem selo. Ver ADR 0015 e ADR 0017.
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
      // Ressalvas e contestações levantadas na pesquisa de proveniência —
      // o consultor precisa vê-las junto com a recomendação, não num doc.
      contraindicacoes: classificacao.contraindicacoes,
      exigeSelecaoDeData: false,
    })
  }

  // ── 5. Alerta da Estrela 5 anual, se ela cai NESTE setor ────────────────
  // Aplica a TODO remédio de ativação do setor — `elemento` e `ativacao` —, não
  // só à dica que por acaso carrega a contraindicação genérica. O motivo é
  // consistência: `estrategiaElemental` gera "Ative com iluminação quente,
  // velas, tons de vermelho" no setor da Fama, que é exatamente o mesmo risco
  // que a dica "adicione velas". Avisar num e calar no outro seria incoerente.
  //
  // NÃO se aplica a `layout`, `comportamental` nem `bloqueio-de-forma`: a
  // regra clássica do Wu Huang é não ATIVAR nem revolver o palácio — limpar e
  // desobstruir continuam recomendados ali.
  //
  // Também não se aplica a remédios de RESTRIÇÃO (`acaoWuXing: 'controlar'`,
  // as recomendações do tipo "evite X em excesso neste setor"). Pego na
  // conferência da saída: o alerta aparecia em "Evite Água em excesso",
  // dizendo "adie ativações de Fogo aqui" — incoerente, porque não há ativação
  // nenhuma sendo proposta. Restringir já é o comportamento que o Wu Huang
  // pede.
  if (avisoEstrela5) {
    for (const r of remedios) {
      const ehAtivacao = (r.mecanismo === 'elemento' || r.mecanismo === 'ativacao')
        && r.acaoWuXing !== 'controlar'
      if (ehAtivacao) r.contraindicacoes = [avisoEstrela5, ...r.contraindicacoes]
    }
  }

  return ordenarRemedios(remedios)
}
