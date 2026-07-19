// ══════════════════════════════════════════════════════════════════════════════
// SHARED CONSTANTS — FengShui Studio
// ══════════════════════════════════════════════════════════════════════════════

export const CRITERIOS = [
  'Limpeza e organizacao',
  'Iluminacao adequada',
  'Ventilacao e ar fresco',
  'Cores harmonicas',
  'Mobiliario posicionado',
  'Plantas e elementos naturais',
  'Ausencia de objetos quebrados',
  'Fluxo de energia livre',
]

export interface AreaMetaEntry {
  zh: string
  trig: string
  dir: string
  elem: string
  bg: string
  fg: string
  colors: string
  crystals: string
  plants: string
  action: string
  signs: string
}

export const AREA_META: Record<string, AreaMetaEntry> = {
  'Carreira': {
    zh: '坎', trig: "K'an", dir: 'N', elem: 'Água',
    bg: '#1E3D6B', fg: '#C4DCFA',
    colors: 'Preto, azul-marinho, azul escuro',
    crystals: 'Água-marinha, sodalita, ágata azul',
    plants: 'Bambu da sorte, lírio da paz',
    action: 'Espelho na entrada ou setor N. Fonte ou objeto de vidro.',
    signs: 'Estagnação profissional, falta de fluxo e direção',
  },
  'Conhecimento': {
    zh: '艮', trig: 'Ken', dir: 'NE', elem: 'Terra',
    bg: '#5C3D1E', fg: '#F0D5B0',
    colors: 'Azul médio, terra, ocre',
    crystals: 'Ametista, fluorita, sodalita',
    plants: 'Suculentas, plantas compactas',
    action: 'Canto silencioso: assento firme, luz difusa, livros e pedras.',
    signs: 'Dispersão mental, dificuldade de foco',
  },
  'Espiritualidade': {
    zh: '艮', trig: 'Ken', dir: 'NE', elem: 'Terra',
    bg: '#5C3D1E', fg: '#F0D5B0',
    colors: 'Azul médio, roxo, ocre',
    crystals: 'Ametista, fluorita, sodalita',
    plants: 'Suculentas, plantas compactas',
    action: 'Espaço de meditação no NE: altar pessoal, luz suave.',
    signs: 'Dispersão mental, ansiedade, dificuldade de consolidar',
  },
  'Família': {
    zh: '震', trig: 'Chen', dir: 'E', elem: 'Madeira',
    bg: '#1A4D30', fg: '#A8DBC0',
    colors: 'Verde, verde-claro, azul-turquesa',
    crystals: 'Quartzo verde, jade, aventurina',
    plants: 'Ficus, palmeira, bambu',
    action: 'Foto de família em moldura de madeira. Planta viva frondosa.',
    signs: 'Conflitos familiares, falta de apoio',
  },
  'Prosperidade': {
    zh: '巽', trig: 'Sun', dir: 'SE', elem: 'Madeira',
    bg: '#3D1A5E', fg: '#C8A8EB',
    colors: 'Púrpura, roxo, verde, dourado',
    crystals: 'Citrino, pirita, quartzo verde',
    plants: 'Crassula (jade), pothos',
    action: 'Planta frondosa + citrino + fonte de água no SE.',
    signs: 'Ganhos travados, bloqueio financeiro',
  },
  'Centro': {
    zh: '中', trig: 'Tai Chi', dir: 'C', elem: 'Terra',
    bg: '#5E4B1A', fg: '#F0D8A8',
    colors: 'Amarelo, ocre, dourado',
    crystals: 'Citrino, calcita mel, topázio',
    plants: 'Crisântemo amarelo, girassol',
    action: 'Centro SEMPRE limpo e livre. Cristal facetado suspenso.',
    signs: 'Desequilíbrio geral, falta de vitalidade',
  },
  'Centro/Saúde': {
    zh: '中', trig: 'Tai Chi', dir: 'C', elem: 'Terra',
    bg: '#5E4B1A', fg: '#F0D8A8',
    colors: 'Amarelo, ocre, dourado',
    crystals: 'Citrino, calcita mel, topázio',
    plants: 'Crisântemo amarelo, girassol',
    action: 'Centro SEMPRE limpo e livre. Cristal facetado suspenso.',
    signs: 'Desequilíbrio geral, falta de vitalidade',
  },
  'Fama': {
    zh: '離', trig: 'Li', dir: 'S', elem: 'Fogo',
    bg: '#7A1818', fg: '#F5B8B8',
    colors: 'Vermelho, laranja, rosa vibrante',
    crystals: 'Jaspe vermelha, granada, cornalina',
    plants: 'Bromélia vermelha, antúrio',
    action: 'Iluminação forte no Sul + toque vermelho + conquista visível.',
    signs: 'Invisibilidade, baixa autoestima, falta de reconhecimento',
  },
  'Fama/Reputação': {
    zh: '離', trig: 'Li', dir: 'S', elem: 'Fogo',
    bg: '#7A1818', fg: '#F5B8B8',
    colors: 'Vermelho, laranja, rosa vibrante',
    crystals: 'Jaspe vermelha, granada, cornalina',
    plants: 'Bromélia vermelha, antúrio',
    action: 'Iluminação forte no Sul + toque vermelho + conquista visível.',
    signs: 'Invisibilidade, baixa autoestima, falta de reconhecimento',
  },
  'Relacionamentos': {
    zh: '坤', trig: "K'un", dir: 'SW', elem: 'Terra',
    bg: '#5E2D50', fg: '#F0B8DA',
    colors: 'Rosa, branco, terracota',
    crystals: 'Quartzo rosa, pedra da lua, rodocrosita',
    plants: 'Orquídeas, rosas',
    action: 'Dois objetos iguais no SW. Quartzo rosa no quarto do casal.',
    signs: 'Dificuldade em relacionamentos, bloqueio afetivo',
  },
  'Criatividade': {
    zh: '兌', trig: 'Tui', dir: 'W', elem: 'Metal',
    bg: '#3D3D3D', fg: '#D5D5D5',
    colors: 'Branco, prata, cinza claro',
    crystals: 'Cristal branco, calcita, selenita',
    plants: 'Orquídea branca, crisântemo',
    action: 'Objetos circulares de metal no Oeste. Espaço aberto para criar.',
    signs: 'Bloqueio criativo, expressão travada',
  },
  'Filhos': {
    zh: '兌', trig: 'Tui', dir: 'W', elem: 'Metal',
    bg: '#3D3D3D', fg: '#D5D5D5',
    colors: 'Branco, prata, cinza, pastéis',
    crystals: 'Cristal branco, selenita',
    plants: 'Orquídea branca, crisântemo',
    action: 'Objetos circulares metálicos no Oeste. Espaço para criatividade.',
    signs: 'Bloqueio criativo, projetos inacabados',
  },
  'Pessoas Úteis': {
    zh: '乾', trig: "Ch'ien", dir: 'NW', elem: 'Metal',
    bg: '#4A3820', fg: '#D0C0A8',
    colors: 'Cinza, prata, branco, preto',
    crystals: 'Turmalina preta, pirita, olho de tigre',
    plants: 'Plantas resistentes, lótus',
    action: 'Sino de vento metálico no NW + imagem de mentor.',
    signs: 'Falta de apoio, poucas conexões úteis',
  },
  'Pessoas Uteis': {
    zh: '乾', trig: "Ch'ien", dir: 'NW', elem: 'Metal',
    bg: '#4A3820', fg: '#D0C0A8',
    colors: 'Cinza, prata, branco, preto',
    crystals: 'Turmalina preta, pirita, olho de tigre',
    plants: 'Plantas resistentes, lótus',
    action: 'Sino de vento metálico no NW + imagem de mentor.',
    signs: 'Falta de apoio, poucas conexões úteis',
  },
}

export const SETOR_DICAS: Record<string, string[]> = {
  'Carreira':       ['Adicione elemento água: aquário, fonte ou imagem de rio','Use tons pretos, azul escuro e ondulados','Coloque espelho estrategicamente para ampliar o espaço','Mantenha o caminho até a porta livre','Adicione cristais negros como obsidiana'],
  'Conhecimento':   ['Crie espaço de estudo ou leitura tranquilo','Use tons azul-escuro, verde e preto','Adicione livros, mapas ou objetos de aprendizado','Iluminação focada e direta para concentração','Elimine distrações e eletrônicos desnecessários'],
  'Espiritualidade':['Crie um espaço de meditação ou altar pessoal','Use tons roxo, azul escuro e branco','Adicione objetos sagrados e significativos','Iluminação suave com velas ou luz indireta','Mantenha silêncio e tranquilidade neste setor'],
  'Família':        ['Use tons verdes e azuis para harmonia familiar','Coloque fotos da família em momentos felizes','Adicione plantas de madeira como bambu da sorte','Mantenha a área livre de objetos de conflito','Use madeira natural na decoração'],
  'Prosperidade':   ['Adicione plantas saudáveis e viçosas','Use tons roxo, verde e dourado','Coloque símbolos de abundância como moedas ou peixes','Mantenha este setor sempre limpo e iluminado','Ative com fonte de água pequena ou aquário'],
  'Centro':         ['Adicione cristais amarelos ou cerâmicas','Mantenha sempre limpo — centro irradia para todos os setores','Use tons terrosos: amarelo, ocre, marrom','Este setor influencia todos os demais','Coloque uma tigela de cristal ou pedras naturais'],
  'Centro/Saúde':   ['Adicione cristais amarelos ou cerâmicas','Mantenha sempre limpo — centro irradia para todos os setores','Use tons terrosos: amarelo, ocre, marrom','Este setor influencia todos os demais','Coloque uma tigela de cristal ou pedras naturais'],
  'Pessoas Uteis':  ['Adicione objetos metálicos e brancos','Use tons cinza, prata e branco','Coloque imagens de mentores ou pessoas admiradas','Mantenha uma lista de contatos importantes visível','Adicione sinos ou móbiles metálicos'],
  'Pessoas Úteis':  ['Adicione objetos metálicos e brancos','Use tons cinza, prata e branco','Coloque imagens de mentores ou pessoas admiradas','Mantenha uma lista de contatos importantes visível','Adicione sinos ou móbiles metálicos'],
  'Filhos':         ['Use tons brancos, cinza e pastéis','Adicione elementos metálicos e circulares','Exponha projetos criativos e expressão artística','Adicione cristais brancos como selenita','Crie espaço para brincadeira e criatividade'],
  'Criatividade':   ['Adicione elementos brancos e metálicos','Use tons brancos, cinza e pastéis','Coloque objetos circulares ou em arco','Exponha trabalhos criativos e projetos em andamento','Adicione cristais brancos como selenita'],
  'Relacionamentos':['Use tons rosa, vermelho e branco em pares','Coloque objetos em duplas: velas, porta-retratos','Adicione cristais de quartzo rosa','Exponha fotos felizes com pessoas amadas','Remova imagens de solidão ou objetos únicos'],
  'Fama':           ['Adicione elementos de fogo: velas ou luz vermelha','Use tons vermelhos e laranja na decoração','Exponha diplomas, prêmios e reconhecimentos','Adicione objetos triangulares ou em forma de chama','Coloque imagens de animais com força e presença'],
  'Fama/Reputação': ['Adicione elementos de fogo: velas ou luz vermelha','Use tons vermelhos e laranja na decoração','Exponha diplomas, prêmios e reconhecimentos','Adicione objetos triangulares ou em forma de chama','Coloque imagens de animais com força e presença'],
}

export const CRITERIO_DICAS: Record<number, string[]> = {
  0: ['Faça limpeza profunda e reorganize completamente este setor','Descarte objetos desnecessários — desordem bloqueia fluxo de energia','Elimine poeira e sujeira acumulada nos cantos e sob móveis'],
  1: ['Aumente iluminação com luminárias adicionais ou spots direcionados','Substitua lâmpadas fracas ou queimadas por equivalentes mais potentes','Adicione espelhos estratégicos para refletir e ampliar a luz natural'],
  2: ['Abra janelas diariamente para renovar o ar pelo menos 15 minutos','Adicione plantas purificadoras como espada-de-são-jorge ou lírio-da-paz','Considere um purificador de ar ou difusor de óleos essenciais'],
  3: ['Introduza a cor dominante do elemento deste setor na decoração','Substitua cores dissonantes por tons neutros ou do elemento correto','Use almofadas, quadros ou tapetes nas cores indicadas para ativação'],
  4: ['Reposicione o móvel principal para ficar de costas para parede sólida','Afaste móveis de cantos mortos e garanta passagem de pelo menos 60cm','Remova móveis que bloqueiam portas, janelas ou o fluxo de circulação'],
  5: ['Adicione uma planta saudável e viçosa com folhas arredondadas','Substitua plantas murchas ou secas — plantas doentes geram energia negativa','Coloque um vaso com terra ou elemento natural representando o ciclo vital'],
  6: ['Remova imediatamente objetos quebrados, lascados ou sem funcionalidade','Conserte ou substitua itens danificados — simbolizam situações inacabadas','Verifique equipamentos elétricos com mau funcionamento e conserte-os'],
  7: ['Reorganize a disposição dos móveis para criar fluxo em curvas suaves','Elimine corredores longos e estreitos usando plantas ou biombos','Certifique-se que a porta principal abre completamente sem obstruções'],
}

export const LOSHU_ORDER = [
  'Prosperidade', 'Fama', 'Relacionamentos',
  'Família', 'Centro', 'Criatividade',
  'Conhecimento', 'Carreira', 'Pessoas Úteis',
]

export const RODA_AREAS = [
  { key: 'carreira', label: 'Carreira', gua: 'Carreira' },
  { key: 'espiritualidade', label: 'Espiritualidade', gua: 'Espiritualidade' },
  { key: 'familia', label: 'Família / Saúde', gua: 'Família' },
  { key: 'prosperidade', label: 'Prosperidade', gua: 'Prosperidade' },
  { key: 'fama', label: 'Fama / Reputação', gua: 'Fama' },
  { key: 'relacionamentos', label: 'Relacionamentos', gua: 'Relacionamentos' },
  { key: 'criatividade', label: 'Criatividade / Filhos', gua: 'Criatividade' },
  { key: 'pessoas_uteis', label: 'Pessoas Úteis', gua: 'Pessoas Úteis' },
  { key: 'saude_centro', label: 'Saúde / Centro', gua: 'Centro' },
]
