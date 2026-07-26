/**
 * Classificação das dicas de texto livre (`SETOR_DICAS` e `CRITERIO_DICAS` em
 * constants.ts) para que possam virar `Remedio` com proveniência.
 *
 * ─── A DIVISÃO DE TRABALHO ────────────────────────────────────────────────
 *
 * São 94 dicas, mas apenas **77 textos únicos** (17 são cópias literais entre
 * setores duplicados: Centro/Centro-Saúde, Pessoas Uteis/Úteis,
 * Fama/Fama-Reputação, e algumas repetidas entre Filhos e Criatividade).
 * Como o catálogo é indexado pelo texto, as repetidas compartilham uma única
 * classificação automaticamente.
 *
 * A classificação está separada em duas metades, por um motivo:
 *
 * 1. **`SUGESTOES_MECANICAS`** — `custo`, `reversibilidade` e `mecanismo`.
 *    Preenchido aqui, porque sai da LEITURA do texto, não de conhecimento de
 *    Feng Shui: "adicione um aquário" custa dinheiro e é removível; "mantenha
 *    o caminho livre" não custa nada e é imediato. São sugestões revisáveis —
 *    corrija o que discordar.
 *
 * 2. **`CURADORIA_EVIDENCIA`** (em `curadoria-evidencia.ts`) —
 *    `forcaEvidencia`. Decidir se "adicione cristais negros como obsidiana" é
 *    consenso clássico, variante de escola ou tradição popular é julgamento de
 *    literatura, e rotular errado poria selo de autoridade clássica em
 *    conselho possivelmente moderno, num relatório que vai para cliente
 *    pagante. Por isso o tipo daquele arquivo **exige fonte nomeada,
 *    localizador e citação literal** em cada entrada: não dá para acrescentar
 *    um palpite sem escrever de onde ele veio. Ver ADR 0015 e ADR 0017.
 *
 * Uma dica só vira `Remedio` quando tem **as duas metades**. Sem curadoria,
 * ela continua aparecendo no relatório como texto, sem selo — comportamento
 * honesto, e é o que ainda vale para as 8 dicas de
 * `DICAS_SEM_FONTE_LOCALIZADA`.
 *
 * Planilha de apoio com as 77 dicas, as sugestões e as fontes:
 * `docs/domain/curadoria-dicas.md`.
 *
 * ─── FRAGILIDADE CONHECIDA ───────────────────────────────────────────────
 *
 * A chave é o texto exato. Editar a redação de uma dica em `constants.ts`
 * desligaria a classificação **em silêncio**. O teste
 * `dicas-classificadas.test.ts` falha se qualquer chave daqui não existir
 * mais na origem — decisão registrada na ADR 0015 (chave-de-texto em vez de
 * ids, para não tocar `constants.ts` nem os consumidores; o custo é essa
 * fragilidade, e ela está sob teste).
 */

import { CURADORIA_EVIDENCIA, DICAS_SEM_FONTE_LOCALIZADA, citarFonte } from './curadoria-evidencia'
import type {
  CustoRemedio, ForcaEvidencia, MecanismoRemedio, Reversibilidade,
} from './sintese-metodos'

export {
  CURADORIA_EVIDENCIA, DICAS_SEM_FONTE_LOCALIZADA, FONTES_CURADORIA, citarFonte,
} from './curadoria-evidencia'
export type { EntradaCuradoria, Fonte, FonteId, Referencia } from './curadoria-evidencia'

export interface ClassificacaoDica {
  custo: CustoRemedio
  reversibilidade: Reversibilidade
  forcaEvidencia: ForcaEvidencia
  mecanismo: MecanismoRemedio
  /**
   * Ressalvas achadas na própria pesquisa de proveniência (ex.: "planta não em
   * quarto de casal", "triângulo nunca em quarto") e a contestação, quando
   * existe. Alimenta `Remedio.contraindicacoes` — é o ganho mais concreto da
   * curadoria: várias dessas dicas têm contraindicação documentada que o app
   * não mostrava a ninguém.
   *
   * Contém **só o que interessa a quem vai aplicar a cura**. A `nota` de
   * curadoria (onde a dica extrapola a fonte) fica FORA daqui de propósito: é
   * metadado de curadoria, e o relatório vai para cliente pagante.
   */
  contraindicacoes: string[]
  /** Proveniência formatada, para exibir ao consultor. */
  fonte: string
  /**
   * Onde a dica vai além do que a fonte sustenta. Uso interno (planilha de
   * curadoria, decisão de produto) — **não** é para o relatório do cliente.
   */
  nota?: string
}

/**
 * As três dimensões que saem da leitura do texto, não do domínio.
 *
 * `forcaEvidencia`, `contraindicacoes` e `fonte` ficam de fora **por
 * definição**: são a metade que exige literatura, e vivem em
 * `curadoria-evidencia.ts`. Se este Omit encolher, o teste que garante que
 * nenhuma sugestão carrega força de evidência é a rede de segurança.
 */
export type SugestaoMecanica =
  Omit<ClassificacaoDica, 'forcaEvidencia' | 'contraindicacoes' | 'fonte'>

/**
 * Sugestões de `custo`/`reversibilidade`/`mecanismo` por dica.
 *
 * Critério usado, para você poder discordar com base:
 * - `custo: 'zero'` = não exige comprar nada (arrumar, remover, abrir janela).
 * - `custo: 'baixo'` = um objeto pequeno (planta, cristal, almofada, lâmpada).
 * - `custo: 'medio'` = móvel, biombo, luminária, pintura, purificador.
 * - `reversibilidade: 'instantanea'` = desfazer é só parar de fazer.
 * - `reversibilidade: 'facil'` = basta remover/guardar o objeto.
 * - `reversibilidade: 'dificil'` = repintar/refazer para voltar.
 * - `mecanismo`: `layout` (mover/desobstruir), `elemento` (introduzir um dos
 *   Cinco Elementos), `ativacao` (símbolo/luz/objeto que ativa),
 *   `comportamental` (hábito), `bloqueio-de-forma` (barrar um fluxo).
 */
export const SUGESTOES_MECANICAS: Record<string, SugestaoMecanica> = {
  // ── Carreira (Água) ──
  'Adicione elemento água: aquário, fonte ou imagem de rio': { custo: 'baixo', reversibilidade: 'facil', mecanismo: 'elemento' },
  'Use tons pretos, azul escuro e ondulados': { custo: 'baixo', reversibilidade: 'facil', mecanismo: 'elemento' },
  'Coloque espelho estrategicamente para ampliar o espaço': { custo: 'baixo', reversibilidade: 'facil', mecanismo: 'ativacao' },
  'Mantenha o caminho até a porta livre': { custo: 'zero', reversibilidade: 'instantanea', mecanismo: 'layout' },
  'Adicione cristais negros como obsidiana': { custo: 'baixo', reversibilidade: 'facil', mecanismo: 'elemento' },

  // ── Conhecimento ──
  'Crie espaço de estudo ou leitura tranquilo': { custo: 'medio', reversibilidade: 'facil', mecanismo: 'layout' },
  'Use tons azul-escuro, verde e preto': { custo: 'baixo', reversibilidade: 'facil', mecanismo: 'elemento' },
  'Adicione livros, mapas ou objetos de aprendizado': { custo: 'baixo', reversibilidade: 'facil', mecanismo: 'ativacao' },
  'Iluminação focada e direta para concentração': { custo: 'baixo', reversibilidade: 'facil', mecanismo: 'ativacao' },
  'Elimine distrações e eletrônicos desnecessários': { custo: 'zero', reversibilidade: 'instantanea', mecanismo: 'comportamental' },

  // ── Espiritualidade ──
  'Crie um espaço de meditação ou altar pessoal': { custo: 'medio', reversibilidade: 'facil', mecanismo: 'layout' },
  'Use tons roxo, azul escuro e branco': { custo: 'baixo', reversibilidade: 'facil', mecanismo: 'elemento' },
  'Adicione objetos sagrados e significativos': { custo: 'baixo', reversibilidade: 'facil', mecanismo: 'ativacao' },
  'Iluminação suave com velas ou luz indireta': { custo: 'baixo', reversibilidade: 'facil', mecanismo: 'ativacao' },
  'Mantenha silêncio e tranquilidade neste setor': { custo: 'zero', reversibilidade: 'instantanea', mecanismo: 'comportamental' },

  // ── Família (Madeira) ──
  'Use tons verdes e azuis para harmonia familiar': { custo: 'baixo', reversibilidade: 'facil', mecanismo: 'elemento' },
  'Coloque fotos da família em momentos felizes': { custo: 'baixo', reversibilidade: 'facil', mecanismo: 'ativacao' },
  'Adicione plantas de madeira como bambu da sorte': { custo: 'baixo', reversibilidade: 'facil', mecanismo: 'elemento' },
  'Mantenha a área livre de objetos de conflito': { custo: 'zero', reversibilidade: 'instantanea', mecanismo: 'comportamental' },
  'Use madeira natural na decoração': { custo: 'medio', reversibilidade: 'facil', mecanismo: 'elemento' },

  // ── Prosperidade ──
  'Adicione plantas saudáveis e viçosas': { custo: 'baixo', reversibilidade: 'facil', mecanismo: 'elemento' },
  'Use tons roxo, verde e dourado': { custo: 'baixo', reversibilidade: 'facil', mecanismo: 'elemento' },
  'Coloque símbolos de abundância como moedas ou peixes': { custo: 'baixo', reversibilidade: 'facil', mecanismo: 'ativacao' },
  'Mantenha este setor sempre limpo e iluminado': { custo: 'zero', reversibilidade: 'instantanea', mecanismo: 'comportamental' },
  'Ative com fonte de água pequena ou aquário': { custo: 'baixo', reversibilidade: 'facil', mecanismo: 'elemento' },

  // ── Centro / Saúde (Terra) ──
  'Adicione cristais amarelos ou cerâmicas': { custo: 'baixo', reversibilidade: 'facil', mecanismo: 'elemento' },
  'Mantenha sempre limpo — centro irradia para todos os setores': { custo: 'zero', reversibilidade: 'instantanea', mecanismo: 'comportamental' },
  'Use tons terrosos: amarelo, ocre, marrom': { custo: 'baixo', reversibilidade: 'facil', mecanismo: 'elemento' },
  'Coloque uma tigela de cristal ou pedras naturais': { custo: 'baixo', reversibilidade: 'facil', mecanismo: 'elemento' },
  // NOTA: 'Este setor influencia todos os demais' fica de fora — ver
  // DICAS_NAO_ACIONAVEIS abaixo. É uma afirmação, não uma ação.

  // ── Pessoas Úteis (Metal) ──
  'Adicione objetos metálicos e brancos': { custo: 'baixo', reversibilidade: 'facil', mecanismo: 'elemento' },
  'Use tons cinza, prata e branco': { custo: 'baixo', reversibilidade: 'facil', mecanismo: 'elemento' },
  'Coloque imagens de mentores ou pessoas admiradas': { custo: 'baixo', reversibilidade: 'facil', mecanismo: 'ativacao' },
  'Mantenha uma lista de contatos importantes visível': { custo: 'zero', reversibilidade: 'instantanea', mecanismo: 'comportamental' },
  'Adicione sinos ou móbiles metálicos': { custo: 'baixo', reversibilidade: 'facil', mecanismo: 'elemento' },

  // ── Filhos / Criatividade (Metal) ──
  'Use tons brancos, cinza e pastéis': { custo: 'baixo', reversibilidade: 'facil', mecanismo: 'elemento' },
  'Adicione elementos metálicos e circulares': { custo: 'baixo', reversibilidade: 'facil', mecanismo: 'elemento' },
  'Exponha projetos criativos e expressão artística': { custo: 'zero', reversibilidade: 'facil', mecanismo: 'ativacao' },
  'Adicione cristais brancos como selenita': { custo: 'baixo', reversibilidade: 'facil', mecanismo: 'elemento' },
  'Crie espaço para brincadeira e criatividade': { custo: 'medio', reversibilidade: 'facil', mecanismo: 'layout' },
  'Adicione elementos brancos e metálicos': { custo: 'baixo', reversibilidade: 'facil', mecanismo: 'elemento' },
  'Coloque objetos circulares ou em arco': { custo: 'baixo', reversibilidade: 'facil', mecanismo: 'elemento' },
  'Exponha trabalhos criativos e projetos em andamento': { custo: 'zero', reversibilidade: 'facil', mecanismo: 'ativacao' },

  // ── Relacionamentos (Terra) ──
  'Use tons rosa, vermelho e branco em pares': { custo: 'baixo', reversibilidade: 'facil', mecanismo: 'elemento' },
  'Coloque objetos em duplas: velas, porta-retratos': { custo: 'baixo', reversibilidade: 'facil', mecanismo: 'ativacao' },
  'Adicione cristais de quartzo rosa': { custo: 'baixo', reversibilidade: 'facil', mecanismo: 'elemento' },
  'Exponha fotos felizes com pessoas amadas': { custo: 'baixo', reversibilidade: 'facil', mecanismo: 'ativacao' },
  'Remova imagens de solidão ou objetos únicos': { custo: 'zero', reversibilidade: 'instantanea', mecanismo: 'comportamental' },

  // ── Fama / Reputação (Fogo) ──
  'Adicione elementos de fogo: velas ou luz vermelha': { custo: 'baixo', reversibilidade: 'facil', mecanismo: 'elemento' },
  'Use tons vermelhos e laranja na decoração': { custo: 'baixo', reversibilidade: 'facil', mecanismo: 'elemento' },
  'Exponha diplomas, prêmios e reconhecimentos': { custo: 'zero', reversibilidade: 'facil', mecanismo: 'ativacao' },
  'Adicione objetos triangulares ou em forma de chama': { custo: 'baixo', reversibilidade: 'facil', mecanismo: 'elemento' },
  'Coloque imagens de animais com força e presença': { custo: 'baixo', reversibilidade: 'facil', mecanismo: 'ativacao' },

  // ── Critério 0: Limpeza e organização ──
  'Faça limpeza profunda e reorganize completamente este setor': { custo: 'zero', reversibilidade: 'instantanea', mecanismo: 'comportamental' },
  'Descarte objetos desnecessários — desordem bloqueia fluxo de energia': { custo: 'zero', reversibilidade: 'instantanea', mecanismo: 'comportamental' },
  'Elimine poeira e sujeira acumulada nos cantos e sob móveis': { custo: 'zero', reversibilidade: 'instantanea', mecanismo: 'comportamental' },

  // ── Critério 1: Iluminação ──
  'Aumente iluminação com luminárias adicionais ou spots direcionados': { custo: 'medio', reversibilidade: 'facil', mecanismo: 'ativacao' },
  'Substitua lâmpadas fracas ou queimadas por equivalentes mais potentes': { custo: 'baixo', reversibilidade: 'facil', mecanismo: 'ativacao' },
  'Adicione espelhos estratégicos para refletir e ampliar a luz natural': { custo: 'baixo', reversibilidade: 'facil', mecanismo: 'ativacao' },

  // ── Critério 2: Ventilação ──
  'Abra janelas diariamente para renovar o ar pelo menos 15 minutos': { custo: 'zero', reversibilidade: 'instantanea', mecanismo: 'comportamental' },
  'Adicione plantas purificadoras como espada-de-são-jorge ou lírio-da-paz': { custo: 'baixo', reversibilidade: 'facil', mecanismo: 'elemento' },
  'Considere um purificador de ar ou difusor de óleos essenciais': { custo: 'medio', reversibilidade: 'facil', mecanismo: 'ativacao' },

  // ── Critério 3: Cores ──
  'Introduza a cor dominante do elemento deste setor na decoração': { custo: 'baixo', reversibilidade: 'facil', mecanismo: 'elemento' },
  // Repintar para voltar atrás é trabalhoso — daí 'dificil', diferente das demais de cor.
  'Substitua cores dissonantes por tons neutros ou do elemento correto': { custo: 'medio', reversibilidade: 'dificil', mecanismo: 'elemento' },
  'Use almofadas, quadros ou tapetes nas cores indicadas para ativação': { custo: 'baixo', reversibilidade: 'facil', mecanismo: 'elemento' },

  // ── Critério 4: Mobiliário ──
  'Reposicione o móvel principal para ficar de costas para parede sólida': { custo: 'zero', reversibilidade: 'facil', mecanismo: 'layout' },
  'Afaste móveis de cantos mortos e garanta passagem de pelo menos 60cm': { custo: 'zero', reversibilidade: 'facil', mecanismo: 'layout' },
  'Remova móveis que bloqueiam portas, janelas ou o fluxo de circulação': { custo: 'zero', reversibilidade: 'facil', mecanismo: 'layout' },

  // ── Critério 5: Plantas ──
  'Adicione uma planta saudável e viçosa com folhas arredondadas': { custo: 'baixo', reversibilidade: 'facil', mecanismo: 'elemento' },
  'Substitua plantas murchas ou secas — plantas doentes geram energia negativa': { custo: 'baixo', reversibilidade: 'facil', mecanismo: 'elemento' },
  'Coloque um vaso com terra ou elemento natural representando o ciclo vital': { custo: 'baixo', reversibilidade: 'facil', mecanismo: 'elemento' },

  // ── Critério 6: Objetos quebrados ──
  'Remova imediatamente objetos quebrados, lascados ou sem funcionalidade': { custo: 'zero', reversibilidade: 'instantanea', mecanismo: 'comportamental' },
  'Conserte ou substitua itens danificados — simbolizam situações inacabadas': { custo: 'medio', reversibilidade: 'facil', mecanismo: 'comportamental' },
  'Verifique equipamentos elétricos com mau funcionamento e conserte-os': { custo: 'medio', reversibilidade: 'facil', mecanismo: 'comportamental' },

  // ── Critério 7: Fluxo de energia ──
  'Reorganize a disposição dos móveis para criar fluxo em curvas suaves': { custo: 'zero', reversibilidade: 'facil', mecanismo: 'layout' },
  'Elimine corredores longos e estreitos usando plantas ou biombos': { custo: 'medio', reversibilidade: 'facil', mecanismo: 'bloqueio-de-forma' },
  'Certifique-se que a porta principal abre completamente sem obstruções': { custo: 'zero', reversibilidade: 'instantanea', mecanismo: 'layout' },
}

/**
 * Textos de `SETOR_DICAS`/`CRITERIO_DICAS` que **não descrevem uma ação** e
 * portanto nunca podem virar `Remedio` — são afirmações informativas.
 *
 * Achado ao classificar: não é um bug do catálogo, é conteúdo que talvez
 * devesse sair da lista de "dicas" em `constants.ts`, já que aparece ao
 * consultor como se fosse uma recomendação acionável.
 */
export const DICAS_NAO_ACIONAVEIS: readonly string[] = [
  'Este setor influencia todos os demais',
]

/**
 * Classificação completa de uma dica — só existe quando a sugestão mecânica
 * E a curadoria de evidência (com fonte) estão presentes. Devolve null caso
 * contrário, o que é o que impede uma dica de virar remédio sem proveniência.
 */
export function classificacaoDaDica(dica: string): ClassificacaoDica | null {
  const mecanica = SUGESTOES_MECANICAS[dica]
  const evidencia = CURADORIA_EVIDENCIA[dica]
  if (!mecanica || !evidencia) return null

  const contraindicacoes: string[] = []
  if (evidencia.contraindicacao) contraindicacoes.push(evidencia.contraindicacao)
  // Uma dica contestada precisa dizer QUEM a contesta ao consultor. Se ficasse
  // só na `nota` do arquivo de curadoria, o relatório apresentaria a
  // recomendação como se fosse pacífica.
  if (evidencia.contestadaPor) {
    contraindicacoes.push(
      `Prática contestada na literatura — ${citarFonte(evidencia.contestadaPor)}: `
      + `"${evidencia.contestadaPor.citacao}"`,
    )
  }

  return {
    ...mecanica,
    forcaEvidencia: evidencia.forca,
    contraindicacoes,
    fonte: citarFonte(evidencia),
    nota: evidencia.nota,
  }
}

/** Progresso da curadoria: quantas dicas já têm força de evidência definida. */
export function totalDicasCuradas(): number {
  return Object.keys(CURADORIA_EVIDENCIA).length
}

/**
 * Quantas dicas ficam **sem selo de evidência** — as que têm sugestão mecânica
 * mas nenhuma fonte localizável no corpus.
 *
 * Antes chamava-se `totalDicasAguardandoCuradoria`, e o nome passou a mentir:
 * por decisão de produto (2026-07-26) estas dicas **ficam assim**, não estão
 * numa fila de espera. Ver `DICAS_SEM_FONTE_LOCALIZADA`.
 */
export function totalDicasSemSeloDeEvidencia(): number {
  return Object.keys(SUGESTOES_MECANICAS).filter(d => !CURADORIA_EVIDENCIA[d]).length
}

/**
 * Dicas curadas cuja prática é **contestada** por outra fonte do corpus.
 * Vale a pena olhar: são candidatas a sair de `constants.ts`, não só a receber
 * selo fraco. (Diferente das 8 sem fonte, que já têm decisão: ficam.)
 */
export function dicasContestadas(): string[] {
  return Object.entries(CURADORIA_EVIDENCIA)
    .filter(([, e]) => e.contestadaPor)
    .map(([dica]) => dica)
}

/** Confere que `DICAS_SEM_FONTE_LOCALIZADA` e a curadoria não se sobrepõem. */
export function dicasSemFonteQueForamCuradas(): string[] {
  return DICAS_SEM_FONTE_LOCALIZADA.filter(d => CURADORIA_EVIDENCIA[d])
}
