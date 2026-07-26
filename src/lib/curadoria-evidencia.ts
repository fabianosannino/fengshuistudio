/**
 * Curadoria de `forcaEvidencia` das dicas de texto livre — **com proveniência
 * obrigatória**.
 *
 * ─── POR QUE ESTE ARQUIVO EXISTE ──────────────────────────────────────────
 *
 * A ADR 0015 deixou `CURADORIA_EVIDENCIA` vazia de propósito: atribuir força
 * de evidência a uma recomendação de Feng Shui é julgamento de literatura, e
 * chutar poria selo de autoridade clássica em conselho possivelmente moderno,
 * num relatório que vai para cliente pagante.
 *
 * A lacuna agora está preenchida a partir de um corpus real (`docs/Books`), e
 * o **tipo força a proveniência**: não existe classificação sem fonte nomeada,
 * localizador e citação literal. Não é possível acrescentar um palpite aqui
 * sem escrever de onde ele veio.
 *
 * ─── O QUE CADA TIER SIGNIFICA (e o que NÃO significa) ────────────────────
 *
 * - `consenso-classico` — a prática tem **âncora explícita** num construto
 *   clássico nomeado (ciclo Wu Xing, Ba Guá do Céu Posterior/trigramas,
 *   Sheng/Shar Chi, Escola das Formas) **e** aparece em mais de uma fonte
 *   independente do corpus, sem contradição encontrada.
 * - `variante-de-escola` — a prática é atribuível a uma convenção de escola
 *   (Oito Aspirações, BTB, simbolismo), ou as fontes divergem sobre ela, ou a
 *   fonte sustenta o princípio mas não o detalhe que a dica acrescenta.
 * - `tradicao-popular` — aparece na literatura consultada mas sem âncora
 *   clássica localizável; tipicamente prática moderna ocidental.
 *
 * **Limite honesto e importante:** `consenso-classico` aqui significa
 * "consenso nas fontes deste corpus", que é majoritariamente literatura
 * popular/introdutória ocidental (ver `tier` em `FONTES_CURADORIA`). NÃO
 * significa verificação contra fonte primária chinesa. Nenhuma obra do corpus
 * é edição crítica de texto clássico. Ver ADR 0017.
 *
 * ─── COMO CONFERIR ────────────────────────────────────────────────────────
 *
 * Toda `citacao` foi copiada do texto extraído, não digitada de memória. Para
 * reconferir da fonte:
 *
 *     python3 scripts/citacoes/extrair-corpus.py
 *     python3 scripts/citacoes/verificar-citacoes.py
 *
 * O segundo falha apontando qualquer citação que não exista mais na fonte.
 */

import type { ForcaEvidencia } from './sintese-metodos'

/** Obras do corpus que têm camada de texto utilizável. */
export type FonteId =
  | 'too-dicionario'
  | 'erlewine-arte'
  | 'yap-wfh'
  | 'tchikovani-casa'
  | 'williams-iniciantes'
  | 'alba-iniciantes'
  | 'morawa-riqueza'

export interface Fonte {
  autor: string
  titulo: string
  ano: number
  editora?: string
  /**
   * Quão perto do cânone clássico a obra está — **declaração de escopo, não
   * medição**. Serve para o leitor calibrar quanto peso dar a um
   * `consenso-classico` sustentado só por obras `popular`.
   *
   * - `referencia`: obra de consulta ampla, de autora amplamente citada.
   * - `linhagem-classica`: autor que pratica e ensina Feng Shui clássico.
   * - `popular`: manual introdutório / de mercado.
   */
  tier: 'referencia' | 'linhagem-classica' | 'popular'
  /** Nome do arquivo em `docs/Books` (prefixo suficiente para localizar). */
  arquivo: string
}

export const FONTES_CURADORIA: Record<FonteId, Fonte> = {
  'too-dicionario': {
    autor: 'Lillian Too', titulo: 'The Feng Shui Dictionary', ano: 2013,
    editora: 'HarperCollins', tier: 'referencia',
    arquivo: 'Feng Shui Dictionary -- Lillian Too',
  },
  'erlewine-arte': {
    autor: 'Michael Erlewine', titulo: 'The Art of Feng Shui', ano: 2007,
    editora: 'StarTypes.com', tier: 'popular',
    arquivo: 'The Art of Feng Shui -- Erlewine, Michael',
  },
  'yap-wfh': {
    autor: 'Joey Yap', titulo: 'Work From Home Feng Shui Guide', ano: 2020,
    tier: 'linhagem-classica',
    arquivo: 'feng-1.pdf',
  },
  'tchikovani-casa': {
    autor: 'Nicolas Tchikovani', titulo: 'The Feng Shui House Book', ano: 2020,
    tier: 'popular',
    arquivo: 'THE FENG SHUI HOUSE BOOK',
  },
  'williams-iniciantes': {
    autor: 'Susannah L. Williams', titulo: 'Feng Shui For Beginners (2ª ed.)', ano: 2012,
    tier: 'popular',
    arquivo: 'Feng Shui For Beginners_ How To Awaken',
  },
  'alba-iniciantes': {
    autor: 'Virginia Alba', titulo: 'Feng Shui Book For Beginners', ano: 2021,
    tier: 'popular',
    arquivo: 'Feng Shui Book For Beginners',
  },
  'morawa-riqueza': {
    autor: 'Bonnie Morawa', titulo: 'Feng Shui for Attracting Wealth and Abundance', ano: 2015,
    tier: 'popular',
    arquivo: 'Feng Shui for attracting wealth',
  },
}

/** Referência a um trecho localizável de uma obra do corpus. */
export interface Referencia {
  fonte: FonteId
  /** Verbete, capítulo ou página — o suficiente para achar na obra. */
  local: string
  /** Trecho **literal** da obra. Copiado, nunca parafraseado. */
  citacao: string
}

export interface EntradaCuradoria extends Referencia {
  forca: ForcaEvidencia
  /**
   * Ressalva que a MESMA leitura revelou. Vira `Remedio.contraindicacoes` —
   * é o motivo principal de a curadoria valer a pena: várias dessas dicas têm
   * contraindicação documentada que o app não mostrava.
   */
  contraindicacao?: string
  /**
   * Fonte que **contradiz** a dica. Quando presente, `forca` nunca é
   * `consenso-classico` — não existe consenso sobre algo contestado.
   */
  contestadaPor?: Referencia
  /**
   * Onde a dica vai além do que a fonte sustenta (número inventado, cor que
   * não fecha com o ciclo, setor diferente). Fica visível em vez de sumir.
   */
  nota?: string
}

/**
 * `forcaEvidencia` por dica, com proveniência. Chave = texto exato da dica em
 * `constants.ts` (fragilidade registrada na ADR 0015, coberta por teste).
 *
 * **68 das 76 dicas acionáveis.** As 8 restantes estão em
 * `DICAS_SEM_FONTE_LOCALIZADA` — nenhuma obra do corpus as enuncia, e inventar
 * uma citação seria exatamente o que este arquivo existe para impedir.
 */
export const CURADORIA_EVIDENCIA: Record<string, EntradaCuradoria> = {
  // ══ Carreira (Norte / Água) ═══════════════════════════════════════════
  'Adicione elemento água: aquário, fonte ou imagem de rio': {
    forca: 'consenso-classico',
    fonte: 'too-dicionario', local: 'verbete "Arrowana"',
    citacao: 'The aquarium is best kept in the north corner since this is the water corner.',
    contraindicacao: 'Não posicione o aquário à direita da porta de entrada (visto de dentro para fora): Too registra essa posição como causadora de infidelidade.',
  },
  'Use tons pretos, azul escuro e ondulados': {
    forca: 'consenso-classico',
    fonte: 'williams-iniciantes', local: 'tabela dos Cinco Elementos, p. 27',
    citacao: 'WATER Direction : north Shapes : irregular, curvy, wavy Color : black, blue',
  },
  'Coloque espelho estrategicamente para ampliar o espaço': {
    forca: 'tradicao-popular',
    fonte: 'too-dicionario', local: 'verbete "Bedrooms"',
    citacao: 'The inclusion of mirrors is one of the most common mistakes in modern bedroom interior design. Mirrors are frequently used to create a sense of space.',
    contestadaPor: {
      fonte: 'erlewine-arte', local: 'Entranceway: Mirrors, p. 269',
      citacao: 'Some feel that the addition of the mirror helps to magnify the incoming Qi, but most experts would not recommend it.',
    },
    contraindicacao: 'Duas fontes desaconselham espelho com a finalidade de ampliar espaço; em quarto, Too classifica a prática como erro comum.',
    nota: 'Distinta da dica de critério «espelhos para refletir luz natural», que Alba endossa. Espelho-para-luz tem apoio; espelho-para-espaço, não.',
  },
  'Mantenha o caminho até a porta livre': {
    forca: 'consenso-classico',
    fonte: 'erlewine-arte', local: 'Entranceway: Pillar in Hallway, p. 273',
    citacao: 'blocked by a pillar or object just inside the front entranceway. This is considered very bad Sha Qi, and should be avoided.',
  },
  'Adicione cristais negros como obsidiana': {
    forca: 'tradicao-popular',
    fonte: 'morawa-riqueza', local: 'Gems and crystals in feng shui',
    citacao: 'Gems and crystals are powerful symbols of our earthly desires and they are powerful activators.',
    contestadaPor: {
      fonte: 'alba-iniciantes', local: 'House areas — The North',
      citacao: 'avoid placing materials that represent the earth such as clay and rocks.',
    },
    nota: 'Cristal é remédio de TERRA (Erlewine, p. 483: "Crystals of all kinds belong to the Earth element"), e Terra controla Água no ciclo Wu Xing. A dica põe objeto de Terra no setor de Água — contraria o ciclo, além de Alba desaconselhar materiais de terra no Norte. A cor preta confere; o material, não.',
  },

  // ══ Conhecimento (Nordeste) ═══════════════════════════════════════════
  'Crie espaço de estudo ou leitura tranquilo': {
    forca: 'variante-de-escola',
    fonte: 'alba-iniciantes', local: 'House areas — The Northeast',
    citacao: 'The Northeast is for enhancing spirituality, meditation, and inner travel; it also helps intellectual growth, reading and knowledge.',
    nota: 'A associação Nordeste↔estudo é convenção das Oito Aspirações. Too a chama "education luck" no mesmo sentido; nenhuma fonte a deriva do ciclo Wu Xing.',
  },
  'Use tons azul-escuro, verde e preto': {
    forca: 'variante-de-escola',
    fonte: 'alba-iniciantes', local: 'Feng Shui Bedroom Colors — zona da sabedoria',
    citacao: 'colors should be blue. The color blue is for calm, blessings and invites contemplation',
    nota: 'O Nordeste é setor de TERRA (amarelo/marrom na tabela de Williams, p. 28). Azul é Água e verde é Madeira — a paleta vem da convenção de escola, não do elemento do setor.',
  },
  'Adicione livros, mapas ou objetos de aprendizado': {
    forca: 'variante-de-escola',
    fonte: 'alba-iniciantes', local: 'House areas — The Northeast',
    citacao: 'Libraries are also best suited for this place, as well as piles of books and objects that represent wisdom and',
    contraindicacao: 'Evite estantes abertas: Too — "These represent knives cutting into you and are bad Feng Shui. If you have exposed bookshelves in your office or study," recomenda fechá-las com portas.',
  },
  'Iluminação focada e direta para concentração': {
    forca: 'variante-de-escola',
    fonte: 'too-dicionario', local: 'verbete "Lights"',
    citacao: 'cause Chi energy to rise. They can solve problems of missing corners, excessively Yin corners,',
    nota: 'Luz como fonte de Yang é clássico; «focada e direta para concentração» é enquadramento ergonômico moderno, ausente das fontes.',
  },
  'Elimine distrações e eletrônicos desnecessários': {
    forca: 'tradicao-popular',
    fonte: 'williams-iniciantes', local: 'Children Rooms',
    citacao: 'electric appliances (avoid putting the television or computers in children rooms',
    contestadaPor: {
      fonte: 'too-dicionario', local: 'verbete "Computers"',
      citacao: 'Computers do not cause bad Feng Shui. When placed in the west or northwest they can become energizers in these corners.',
    },
    nota: 'Too trata eletrônicos como neutros ou até energizadores. A restrição que a dica faz é de foco/atenção, não de Feng Shui.',
  },

  // ══ Espiritualidade ═══════════════════════════════════════════════════
  'Crie um espaço de meditação ou altar pessoal': {
    forca: 'variante-de-escola',
    fonte: 'too-dicionario', local: 'verbete "Altar"',
    citacao: 'altar be placed in the northwest section of the house or living room, since this sector represents the Chien trigram',
    nota: 'DIVERGÊNCIA DE SETOR: Too põe o altar no NOROESTE (trigrama Chien); Alba põe espiritualidade no NORDESTE, que é o setor usado pelo app. As duas leituras existem na literatura.',
  },
  'Use tons roxo, azul escuro e branco': {
    forca: 'tradicao-popular',
    fonte: 'williams-iniciantes', local: 'tabela dos Cinco Elementos, p. 27',
    citacao: 'FIRE Direction : south Shapes : pointy, starlike, toothed, triangular, piramidal, zig-zag Color : red, purple',
    nota: 'A paleta mistura três elementos: roxo é Fogo, azul escuro é Água, branco é Metal. Não corresponde a nenhum setor único do Ba Guá — é combinação de mercado.',
  },
  'Adicione objetos sagrados e significativos': {
    forca: 'variante-de-escola',
    fonte: 'alba-iniciantes', local: 'House areas — The Northeast',
    citacao: 'objects that symbolize spirituality. Libraries are also best suited for this place,',
  },
  'Iluminação suave com velas ou luz indireta': {
    forca: 'variante-de-escola',
    fonte: 'tchikovani-casa', local: 'Feng Shui of a Bathroom in the Center of a Home',
    citacao: 'levels of light by using a dimmer switch, lighting candles, or using faux candles. The goal is to avoid always ha',
  },
  'Mantenha silêncio e tranquilidade neste setor': {
    forca: 'variante-de-escola',
    fonte: 'too-dicionario', local: 'verbete "Quiet Areas"',
    citacao: 'peace and quiet, where Yin Chi is to be preferred to too much Yang Chi',
    nota: 'O equilíbrio Yin/Yang é clássico, mas Too o enuncia para o QUARTO, não para um setor do Ba Guá. Aplicar a um setor é extensão do app.',
  },

  // ══ Família (Leste / Madeira) ═════════════════════════════════════════
  'Use tons verdes e azuis para harmonia familiar': {
    forca: 'consenso-classico',
    fonte: 'williams-iniciantes', local: 'tabela dos Cinco Elementos, p. 28',
    citacao: 'WOOD Direction : east/southeast Shapes : tall, thin, vertical Color : green',
    nota: 'Verde é o elemento do setor. Azul é Água, que GERA Madeira no ciclo Sheng — coerente por nutrição, não por identidade.',
  },
  'Adicione plantas de madeira como bambu da sorte': {
    forca: 'consenso-classico',
    fonte: 'too-dicionario', local: 'verbete "Bamboo"',
    citacao: 'An excellent Feng Shui plant signifying longevity.',
    contraindicacao: 'Não em quarto de casal: Too — plantas no quarto de um casal e eles "will quarrel frequently".',
  },
  'Use madeira natural na decoração': {
    forca: 'consenso-classico',
    fonte: 'erlewine-arte', local: 'Wood Remedies, p. 486',
    citacao: 'wood of any kind will do, including finished wood such as found in furniture and wood objects of all kin',
  },

  // ══ Prosperidade (Sudeste / Madeira) ══════════════════════════════════
  'Adicione plantas saudáveis e viçosas': {
    forca: 'consenso-classico',
    fonte: 'erlewine-arte', local: 'Wood Remedies, p. 486',
    citacao: 'Wood is as easy as adding an indoor plant or two, some fresh flowers, or something from the garden to display',
    contraindicacao: 'Não em quarto de casal (Too) nem plantas espinhosas (Too: cactos "should not be placed in the home").',
  },
  'Use tons roxo, verde e dourado': {
    forca: 'variante-de-escola',
    fonte: 'williams-iniciantes', local: 'tabela dos Cinco Elementos, p. 28',
    citacao: 'WOOD Direction : east/southeast Shapes : tall, thin, vertical Color : green',
    nota: 'Só o verde fecha com o elemento do Sudeste. Roxo é Fogo e dourado é Metal — e Metal CORTA Madeira no ciclo de controle. Roxo/dourado para riqueza é convenção das Oito Aspirações, não Wu Xing.',
  },
  'Coloque símbolos de abundância como moedas ou peixes': {
    forca: 'variante-de-escola',
    fonte: 'too-dicionario', local: 'verbete "Coins"',
    citacao: 'superb for activating Feng Shui for wealth. Authentic old Chinese coins can be used as Feng Shui coins.',
    nota: 'Feng Shui simbólico: a eficácia atribuída vem do símbolo, não de cálculo de direção ou elemento.',
  },
  'Mantenha este setor sempre limpo e iluminado': {
    forca: 'consenso-classico',
    fonte: 'yap-wfh', local: 'Step 3 — Observe and Activate, p. 15',
    citacao: 'Space is clear, clean and vibrant',
  },
  'Ative com fonte de água pequena ou aquário': {
    forca: 'consenso-classico',
    fonte: 'too-dicionario', local: 'verbete "Aquarium"',
    citacao: 'activate the wealth sector of the office (the southeast corner) by introducing a water feature.',
    contraindicacao: 'Não à direita da porta de entrada, visto de dentro para fora (Too).',
  },

  // ══ Centro / Saúde (Terra) ════════════════════════════════════════════
  'Adicione cristais amarelos ou cerâmicas': {
    forca: 'consenso-classico',
    fonte: 'erlewine-arte', local: 'Earth Remedies, p. 480–481',
    citacao: 'earthen pottery, clay objects, tiles, and all kinds of ceramics',
    nota: 'Erlewine confirma também a cor: "Earth colors of all shades of yellow, the darker the better, so ochre and deep clay-colors".',
  },
  'Mantenha sempre limpo — centro irradia para todos os setores': {
    forca: 'consenso-classico',
    fonte: 'alba-iniciantes', local: 'House areas — zona tai chi',
    citacao: 'tai chi zone at its center and should always be kept clear and clean',
  },
  'Use tons terrosos: amarelo, ocre, marrom': {
    forca: 'consenso-classico',
    fonte: 'williams-iniciantes', local: 'tabela dos Cinco Elementos, p. 28',
    citacao: 'EARTH Direction : southwest/center (of your home)/northeast Shapes : short, flat, wide, rectangular, horizontal Colors : yellow, brown',
  },
  'Coloque uma tigela de cristal ou pedras naturais': {
    forca: 'variante-de-escola',
    fonte: 'erlewine-arte', local: 'Earth Remedies, p. 480',
    citacao: 'Not just crystals, but rocks, fossils and stones. The pebbles you gather at the beach on vacat',
    nota: 'A pedra como remédio de Terra tem apoio; a forma "tigela" é escolha decorativa, não regra de fonte.',
  },

  // ══ Pessoas Úteis (Noroeste / Metal) ══════════════════════════════════
  'Adicione objetos metálicos e brancos': {
    forca: 'consenso-classico',
    fonte: 'williams-iniciantes', local: 'tabela dos Cinco Elementos, p. 29',
    citacao: 'METAL Direction : west/northwest',
    nota: 'A mesma entrada dá cores ("white, golden, silver") e materiais ("stainless steel, brass, silver, bronze, copper, iron").',
  },
  'Use tons cinza, prata e branco': {
    forca: 'consenso-classico',
    fonte: 'alba-iniciantes', local: 'Feng Shui Bedroom Colors — zona de ajuda/amizade',
    citacao: 'gray and silver because it is the color of the connection.',
    nota: 'Concorda com a tabela de Williams (p. 29), que dá Metal = "white, golden, silver".',
  },
  'Coloque imagens de mentores ou pessoas admiradas': {
    forca: 'consenso-classico',
    fonte: 'too-dicionario', local: 'verbete "Offices" — arte de escritório',
    citacao: 'painting of a leader in the northwest creates exceptionally good mentor luck',
  },
  'Adicione sinos ou móbiles metálicos': {
    forca: 'consenso-classico',
    fonte: 'erlewine-arte', local: 'Wind Chimes, p. 497',
    citacao: 'favorite Chinese Metal remedies is a set of tubular metal wind chimes, usually with an odd number of hollow cyl',
  },

  // ══ Filhos / Criatividade (Oeste / Metal) ═════════════════════════════
  'Use tons brancos, cinza e pastéis': {
    forca: 'consenso-classico',
    fonte: 'alba-iniciantes', local: 'Feng Shui Bedroom Colors — zona da criatividade',
    citacao: 'creativity zone is best suited to whites. This is the zone of childhood or of bringing out the child in us.',
    nota: 'Pastéis não aparecem nas fontes; branco/cinza sim (Williams, p. 29).',
  },
  'Adicione elementos metálicos e circulares': {
    forca: 'consenso-classico',
    fonte: 'erlewine-arte', local: 'The Metal Environment, p. 415',
    citacao: 'elemental form for Metal is circular, in particular the arch and dome shape.',
  },
  'Adicione cristais brancos como selenita': {
    forca: 'tradicao-popular',
    fonte: 'morawa-riqueza', local: 'Choose gem colors by your wish',
    citacao: 'white crystals bring luck with children, creativity, and helpful people and mentors',
    nota: 'Correspondência cor-de-cristal↔área da vida é prática moderna; nenhuma fonte a deriva de trigrama ou ciclo.',
  },
  'Crie espaço para brincadeira e criatividade': {
    forca: 'variante-de-escola',
    fonte: 'tchikovani-casa', local: 'How to Create Good Feng Shui in Your Garden',
    citacao: 'west feng shui area is recommended, as it is connected to the energy of children and creativity.',
  },
  'Adicione elementos brancos e metálicos': {
    forca: 'consenso-classico',
    fonte: 'williams-iniciantes', local: 'tabela dos Cinco Elementos, p. 29',
    citacao: 'METAL Direction : west/northwest',
  },
  'Coloque objetos circulares ou em arco': {
    forca: 'consenso-classico',
    fonte: 'erlewine-arte', local: 'The Metal Environment, p. 415',
    citacao: 'elemental form for Metal is circular, in particular the arch and dome shape.',
  },

  // ══ Relacionamentos (Sudoeste / Terra) ════════════════════════════════
  'Use tons rosa, vermelho e branco em pares': {
    forca: 'variante-de-escola',
    fonte: 'alba-iniciantes', local: 'Feng Shui Bedroom Colors — zona de associação',
    citacao: 'Lavish the room with rose.',
    nota: 'O Sudoeste é TERRA (amarelo/marrom). Rosa/vermelho entram pelo Fogo, que GERA Terra — Too registra essa combinação no verbete "Chandeliers": luz (Fogo) + cristal (Terra) no sudoeste traz sorte no amor. Coerente pelo ciclo Sheng, não pela cor do setor.',
  },
  'Coloque objetos em duplas: velas, porta-retratos': {
    forca: 'variante-de-escola',
    fonte: 'williams-iniciantes', local: 'Bedroom',
    citacao: 'Objects in pairs, such as pictures, candles and lamps simbolize intimacy.',
  },
  'Adicione cristais de quartzo rosa': {
    forca: 'tradicao-popular',
    fonte: 'morawa-riqueza', local: 'Gems and crystals in feng shui',
    citacao: 'rose quartz heart. Keep your focus on this intention until you see it come to fruition',
  },
  'Exponha fotos felizes com pessoas amadas': {
    forca: 'tradicao-popular',
    fonte: 'williams-iniciantes', local: 'What Do People Accept With Most Difficulty?',
    citacao: 'picture of himself and his partner on the lower shelf, that can easily mean that their relationship is not so great.',
    nota: 'SUSTENTAÇÃO PARCIAL: a fonte lê a ALTURA da foto como sintoma da relação; não recomenda expor fotos felizes como cura. Classificada popular por isso.',
  },

  // ══ Fama / Reputação (Sul / Fogo) ═════════════════════════════════════
  'Adicione elementos de fogo: velas ou luz vermelha': {
    forca: 'consenso-classico',
    fonte: 'erlewine-arte', local: 'Fire Remedies, p. 474',
    citacao: 'Fire is one of the easier remedies to add to a room, like a candle or one of those candles carefully protected,',
    // Sem referência a arquivo aqui: esta string é IMPRESSA no relatório do
    // cliente. O gancho com o cálculo da Estrela 5 está na ADR 0017.
    contraindicacao: 'Não onde estiver a Estrela 5 anual (Wu Huang): Morawa — "no fires, flames, candles or red objects here".',
  },
  'Use tons vermelhos e laranja na decoração': {
    forca: 'consenso-classico',
    fonte: 'williams-iniciantes', local: 'tabela dos Cinco Elementos, p. 27',
    citacao: 'FIRE Direction : south Shapes : pointy, starlike, toothed, triangular, piramidal, zig-zag Color : red, purple',
    nota: 'Vermelho confere. Laranja não aparece em nenhuma fonte do corpus — nas tabelas, o segundo tom do Fogo é o roxo.',
  },
  'Adicione objetos triangulares ou em forma de chama': {
    forca: 'consenso-classico',
    fonte: 'williams-iniciantes', local: 'tabela dos Cinco Elementos, p. 27',
    citacao: 'FIRE Direction : south Shapes : pointy, starlike, toothed, triangular, piramidal, zig-zag',
    contraindicacao: 'Nunca em quarto: Too — "arrows and triangles: these represent the fire element, which is very bad for the bedroom", e simbolizam flechas envenenadas apontadas para quem dorme.',
  },
  'Coloque imagens de animais com força e presença': {
    forca: 'variante-de-escola',
    fonte: 'too-dicionario', local: 'verbete "Horses"',
    citacao: 'picture of horses in the south side of the living room because the element of the horse is fire, which coincides with th',
    contraindicacao: 'Uma imagem de animal por vez (Williams: "one piece of an animal at a time"); e Too alerta que no sul o cavalo pode trazer Yang em excesso.',
  },

  // ══ Critério 0: Limpeza e organização ═════════════════════════════════
  'Faça limpeza profunda e reorganize completamente este setor': {
    forca: 'consenso-classico',
    fonte: 'tchikovani-casa', local: 'Where Do You Begin?',
    citacao: "you need to clear your clutter. It's the first key to allowing good energy flow, and you cannot continue with",
  },
  'Descarte objetos desnecessários — desordem bloqueia fluxo de energia': {
    forca: 'consenso-classico',
    fonte: 'morawa-riqueza', local: 'How does clutter affect you',
    citacao: 'Decluttering helps to remove blockages from your life that stop the flow of energy to you and everything you enjoy.',
  },
  'Elimine poeira e sujeira acumulada nos cantos e sob móveis': {
    forca: 'variante-de-escola',
    fonte: 'yap-wfh', local: 'Step 3 — Observe and Activate, p. 15',
    citacao: 'Space is clear, clean and vibrant',
    nota: 'As fontes tratam de desordem e limpeza em geral; nenhuma singulariza poeira em cantos ou sob móveis.',
  },

  // ══ Critério 1: Iluminação ════════════════════════════════════════════
  'Aumente iluminação com luminárias adicionais ou spots direcionados': {
    forca: 'consenso-classico',
    fonte: 'too-dicionario', local: 'verbete "Lights"',
    citacao: 'cause Chi energy to rise. They can solve problems of missing corners, excessively Yin corners,',
  },
  'Substitua lâmpadas fracas ou queimadas por equivalentes mais potentes': {
    forca: 'variante-de-escola',
    fonte: 'too-dicionario', local: 'verbete "Lights"',
    citacao: 'cause Chi energy to rise. They can solve problems of missing corners, excessively Yin corners,',
    nota: 'Luz como Yang é clássico; lâmpada QUEIMADA especificamente não é tratada por nenhuma fonte do corpus.',
  },
  'Adicione espelhos estratégicos para refletir e ampliar a luz natural': {
    forca: 'variante-de-escola',
    fonte: 'alba-iniciantes', local: 'Feng Shui Life Mirror',
    citacao: 'illuminate the darkest corners and spots.',
    nota: 'Espelho-para-LUZ tem apoio (Alba; e Erlewine usa prismas no peitoril "so that morning or evening Sun could reflect light around the room"). Espelho-para-ESPAÇO é contestado — ver a dica de Carreira.',
  },

  // ══ Critério 2: Ventilação ════════════════════════════════════════════
  'Abra janelas diariamente para renovar o ar pelo menos 15 minutos': {
    forca: 'variante-de-escola',
    fonte: 'yap-wfh', local: 'Step 3 — Observe and Activate, p. 15',
    citacao: 'There’s circulation of air • It’s not void or stuffed like a store room and is roomy',
    nota: 'Os «15 minutos» são precisão do app, não da fonte. Nenhuma obra do corpus dá duração — Yap pede circulação de ar, sem quantificar.',
  },
  'Adicione plantas purificadoras como espada-de-são-jorge ou lírio-da-paz': {
    forca: 'tradicao-popular',
    fonte: 'tchikovani-casa', local: 'Feng Shui of a Bathroom in the Center of a Home',
    citacao: 'Air purifying plants (if you have good light levels in your bathroom) or an aromatherapy diffuser wi',
    nota: 'As espécies nomeadas vêm da literatura de qualidade do ar, não do Feng Shui. Contraindicação de Too vale igual: nada de planta em quarto de casal.',
  },
  'Considere um purificador de ar ou difusor de óleos essenciais': {
    forca: 'tradicao-popular',
    fonte: 'tchikovani-casa', local: 'Feng Shui of a Bathroom in the Center of a Home',
    citacao: 'Air purifying plants (if you have good light levels in your bathroom) or an aromatherapy diffuser wi',
  },

  // ══ Critério 3: Cores ═════════════════════════════════════════════════
  'Introduza a cor dominante do elemento deste setor na decoração': {
    forca: 'consenso-classico',
    fonte: 'too-dicionario', local: 'lista de antídotos ("Antidotes")',
    citacao: 'colors to correct element imbalance.',
  },
  'Substitua cores dissonantes por tons neutros ou do elemento correto': {
    forca: 'consenso-classico',
    fonte: 'too-dicionario', local: 'lista de antídotos ("Antidotes")',
    citacao: 'colors to correct element imbalance.',
  },
  'Use almofadas, quadros ou tapetes nas cores indicadas para ativação': {
    forca: 'consenso-classico',
    fonte: 'williams-iniciantes', local: 'tabela dos Cinco Elementos, p. 27–29',
    citacao: 'WATER Direction : north Shapes : irregular, curvy, wavy Color : black, blue',
    nota: 'A tabela dá a coluna de cores dos cinco elementos; o suporte é para a cor, não para o objeto (almofada/tapete é veículo).',
  },

  // ══ Critério 4: Mobiliário ════════════════════════════════════════════
  'Reposicione o móvel principal para ficar de costas para parede sólida': {
    forca: 'consenso-classico',
    fonte: 'williams-iniciantes', local: 'Bedroom, p. 30',
    citacao: 'wall behind your headboard! Good sleep is important for your healt',
    nota: 'A mesma obra dá o lado do assento: "Try not to sit with your back facing the door, or the side door." Morawa concorda ("sleep on a solid wall"). É a regra do apoio nas costas (Tartaruga Negra), que o app também aplica em `posicionamento-mobiliario.ts`.',
  },
  'Afaste móveis de cantos mortos e garanta passagem de pelo menos 60cm': {
    forca: 'variante-de-escola',
    fonte: 'erlewine-arte', local: 'exemplo do hall de entrada',
    citacao: 'choked the entryway. I had always been vaguely aware that this entryway made me feel a little uncom',
    nota: 'Os 60cm são do app: nenhuma fonte do corpus dá medida de passagem. O princípio (não estrangular a circulação) tem apoio.',
  },
  'Remova móveis que bloqueiam portas, janelas ou o fluxo de circulação': {
    forca: 'consenso-classico',
    fonte: 'erlewine-arte', local: 'Entranceway: Pillar in Hallway, p. 273',
    citacao: 'blocked by a pillar or object just inside the front entranceway. This is considered very bad Sha Qi, and should be avoided.',
  },

  // ══ Critério 5: Plantas ═══════════════════════════════════════════════
  'Adicione uma planta saudável e viçosa com folhas arredondadas': {
    forca: 'consenso-classico',
    fonte: 'williams-iniciantes', local: 'Plants',
    citacao: 'oval shaped leaves are Feng Shui favorites.',
    contraindicacao: 'Nada de espinhos: Too — "Cacti and any other types of prickly plants create tiny slivers of poisonous energy". E nenhuma planta em quarto de casal (Too).',
  },
  'Substitua plantas murchas ou secas — plantas doentes geram energia negativa': {
    forca: 'consenso-classico',
    fonte: 'williams-iniciantes', local: 'Plants',
    citacao: 'withered and dead leaves have negative effect on the chi-energy. Plants must be healthy,',
  },
  'Coloque um vaso com terra ou elemento natural representando o ciclo vital': {
    forca: 'variante-de-escola',
    fonte: 'erlewine-arte', local: 'Earth Remedies, p. 480',
    citacao: 'Not just crystals, but rocks, fossils and stones. The pebbles you gather at the beach on vacat',
    nota: 'A leitura "ciclo vital" é do app; a fonte trata o material como remédio do elemento Terra, sem essa simbologia.',
  },

  // ══ Critério 6: Objetos quebrados ═════════════════════════════════════
  'Remova imediatamente objetos quebrados, lascados ou sem funcionalidade': {
    forca: 'variante-de-escola',
    fonte: 'williams-iniciantes', local: 'Cleaning Out The Mess',
    citacao: 'everything that is broken.',
    nota: 'A regra aparece em duas obras (Williams, Morawa), mas como conselho de organização moderna — nenhuma a ancora em Sheng/Shar Chi ou Wu Xing.',
  },
  'Conserte ou substitua itens danificados — simbolizam situações inacabadas': {
    forca: 'variante-de-escola',
    fonte: 'williams-iniciantes', local: 'Cleaning Out The Mess',
    citacao: 'everything that is broken.',
    nota: 'A leitura simbólica ("situações inacabadas") não aparece em nenhuma fonte do corpus — é acréscimo do app.',
  },

  // ══ Critério 7: Fluxo de energia ══════════════════════════════════════
  'Reorganize a disposição dos móveis para criar fluxo em curvas suaves': {
    forca: 'consenso-classico',
    fonte: 'erlewine-arte', local: 'Qi flow, p. 534',
    citacao: 'Straight lines speed up the movement of Qi and curves and spirals slow it down.',
    nota: 'Too diz o mesmo ao definir Sheng Chi: as linhas de energia auspiciosas devem "meander gently through the home and accumulate and settle".',
  },
  'Elimine corredores longos e estreitos usando plantas ou biombos': {
    forca: 'consenso-classico',
    fonte: 'too-dicionario', local: 'verbete "Corridors" / "Bamboo"',
    citacao: 'counter a long corridor is to block the room it hits by using a screen or divider of some sort;',
    nota: 'Too recomenda BIOMBO/divisória e diz explicitamente que bambu, flautas e sinos de vento "can only do so much". Planta não aparece como remédio de corredor em nenhuma fonte — o biombo da dica tem apoio, a planta não.',
  },
  'Certifique-se que a porta principal abre completamente sem obstruções': {
    forca: 'consenso-classico',
    fonte: 'too-dicionario', local: 'verbete "Foyers"',
    citacao: 'door opens onto space and that the entrance is not cramped.',
  },
}

/**
 * Dicas acionáveis para as quais **nenhuma obra do corpus tem enunciado
 * localizável**. Ficam sem `forcaEvidencia` de propósito: continuam aparecendo
 * no relatório como texto (comportamento honesto), mas não viram `Remedio`.
 *
 * Não é "não pesquisei" — é "pesquisei e não achou". Todas foram buscadas por
 * termo no corpus inteiro (foto/quadro/retrato, prêmio/diploma/troféu,
 * lista/contato, projeto/obra criativa, conflito, equipamento elétrico).
 *
 * ─── DECISÃO DE PRODUTO (2026-07-26): ESTAS 8 FICAM ──────────────────────
 *
 * O proprietário decidiu que continuam no catálogo. **Isto não é uma lista de
 * pendências** — é um estado estável e deliberado: dica que o consultor aplica
 * por prática, sem respaldo de literatura localizado, e que por isso não recebe
 * selo de evidência nem entra no Plano de Ação.
 *
 * Consequência para quem mexer aqui: **não "limpe" esta lista** presumindo que
 * é trabalho inacabado, e não force uma classificação para zerá-la. Se algum
 * dia aparecer a fonte, mova a dica para `CURADORIA_EVIDENCIA` — mas a ausência
 * de fonte é um resultado publicado, não um bug.
 */
export const DICAS_SEM_FONTE_LOCALIZADA: readonly string[] = [
  'Coloque fotos da família em momentos felizes',
  'Mantenha a área livre de objetos de conflito',
  'Mantenha uma lista de contatos importantes visível',
  'Exponha projetos criativos e expressão artística',
  'Exponha trabalhos criativos e projetos em andamento',
  'Remova imagens de solidão ou objetos únicos',
  'Exponha diplomas, prêmios e reconhecimentos',
  'Verifique equipamentos elétricos com mau funcionamento e conserte-os',
]

/** Formata a proveniência para exibição ao consultor. */
export function citarFonte(ref: Referencia): string {
  const f = FONTES_CURADORIA[ref.fonte]
  return `${f.autor}, ${f.titulo} (${f.ano}), ${ref.local}`
}
