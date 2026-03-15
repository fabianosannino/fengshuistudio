'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '../../src/lib/supabase'

// ══════════════════════════════════════════════════════════════════════════════
// CURES & ACTIVATIONS DATA — 9 Elements × 6 Modalities
// ══════════════════════════════════════════════════════════════════════════════

interface Crystal { nome: string; cor: string; propriedade: string }
interface Plant { icon: string; nome: string; dica: string; posicao: string }
interface Obj { icon: string; nome: string; posicao: string }
interface Mudra { icon: string; nome: string; descricao: string; passos: string[] }
interface Meditation { nome: string; duracao: string; descricao: string; passos: string[] }
interface Mantra { caracteres: string; romanizacao: string; significado: string }

interface ElementData {
  id: string
  nome: string
  gua: string
  elemento: string
  trigramo: string
  corPrimaria: string
  corSecundaria: string
  corTexto: string
  cristais: Crystal[]
  plantas: Plant[]
  objetos: Obj[]
  mudra: Mudra
  meditacao: Meditation
  mantras: Mantra[]
}

const ELEMENTOS: ElementData[] = [
  // ── 1. ÁGUA / CARREIRA ──────────────────────────────────────────────────
  {
    id: 'agua-carreira',
    nome: 'Água',
    gua: 'Carreira',
    elemento: 'Água',
    trigramo: '坎',
    corPrimaria: '#1a1a2e',
    corSecundaria: '#16213e',
    corTexto: '#4FC3F7',
    cristais: [
      { nome: 'Turmalina Negra', cor: '#1a1a1a', propriedade: 'Proteção energética e ancoragem profissional' },
      { nome: 'Água Marinha', cor: '#7EC8E3', propriedade: 'Fluidez na comunicação e clareza de propósito' },
      { nome: 'Lápis Lazúli', cor: '#26619C', propriedade: 'Sabedoria intuitiva e visão estratégica' },
      { nome: 'Obsidiana', cor: '#2C2C2C', propriedade: 'Eliminação de bloqueios e proteção' },
      { nome: 'Sodalita', cor: '#4169E1', propriedade: 'Racionalidade e foco profissional' },
    ],
    plantas: [
      { icon: '🎋', nome: 'Bambu da Sorte', dica: 'Coloque 3 hastes em água limpa', posicao: 'Área Norte do ambiente' },
      { icon: '🌿', nome: 'Jiboia', dica: 'Planta aquática que purifica', posicao: 'Próximo a fontes de água' },
      { icon: '🌱', nome: 'Lírio da Paz', dica: 'Floresce na sombra, símbolo de renovação', posicao: 'Entrada do escritório' },
      { icon: '💧', nome: 'Papiro', dica: 'Planta aquática ancestral', posicao: 'Em vasos com água' },
    ],
    objetos: [
      { icon: '⛲', nome: 'Fonte de Água', posicao: 'Entrada ou área Norte' },
      { icon: '🐢', nome: 'Tartaruga (metal/pedra)', posicao: 'Atrás da mesa de trabalho' },
      { icon: '🪞', nome: 'Espelho Circular', posicao: 'Parede Norte, refletindo abundância' },
      { icon: '🌊', nome: 'Imagem de Água em Movimento', posicao: 'Parede do escritório' },
      { icon: '🔔', nome: 'Sino de Vento Metálico', posicao: 'Janela da área Norte' },
      { icon: '🖼️', nome: 'Quadro com Onda/Rio', posicao: 'Atrás da cadeira principal' },
    ],
    mudra: {
      icon: '🙏', nome: 'Mudra de Fluxo (Varun)',
      descricao: 'Ativa o elemento Água, promovendo fluidez e intuição na carreira.',
      passos: [
        'Sente-se confortavelmente com a coluna ereta',
        'Una a ponta do dedo mínimo com a ponta do polegar em ambas as mãos',
        'Mantenha os outros dedos estendidos e relaxados',
        'Apoie as mãos sobre os joelhos, palmas para cima',
        'Respire profundamente por 5 minutos, visualizando água fluindo',
      ],
    },
    meditacao: {
      nome: 'Meditação do Rio Interior',
      duracao: '15 minutos',
      descricao: 'Conecta com o fluxo natural da carreira e propósito de vida.',
      passos: [
        'Feche os olhos e respire 3 vezes profundamente',
        'Visualize-se às margens de um rio calmo e cristalino',
        'Observe a água fluindo suavemente — ela representa sua carreira',
        'Mergulhe mentalmente no rio e sinta a correnteza te levar',
        'Permita que o rio te leve até um oceano vasto — seu potencial pleno',
        'Agradeça e retorne lentamente, sentindo o fluxo dentro de si',
      ],
    },
    mantras: [
      { caracteres: '水流順暢', romanizacao: 'Shuǐ liú shùnchàng', significado: 'Que a água flua suavemente (fluidez na carreira)' },
      { caracteres: '事業順利', romanizacao: 'Shìyè shùnlì', significado: 'Que a carreira prospere suavemente' },
    ],
  },

  // ── 2. MADEIRA / FAMÍLIA ────────────────────────────────────────────────
  {
    id: 'madeira-familia',
    nome: 'Madeira',
    gua: 'Família / Saúde',
    elemento: 'Madeira',
    trigramo: '震',
    corPrimaria: '#1a2e1a',
    corSecundaria: '#1e3a1e',
    corTexto: '#81C784',
    cristais: [
      { nome: 'Aventurina Verde', cor: '#4CAF50', propriedade: 'Harmonia familiar e cura emocional' },
      { nome: 'Jade', cor: '#00A86B', propriedade: 'Proteção da família e longevidade' },
      { nome: 'Malaquita', cor: '#0BDA51', propriedade: 'Transformação e renovação dos laços' },
      { nome: 'Amazonita', cor: '#00C4B0', propriedade: 'Comunicação harmoniosa na família' },
      { nome: 'Quartzo Verde', cor: '#8FBC8F', propriedade: 'Equilíbrio emocional e saúde' },
    ],
    plantas: [
      { icon: '🪴', nome: 'Espada de São Jorge', dica: 'Proteção e purificação energética', posicao: 'Entrada da casa' },
      { icon: '🌿', nome: 'Samambaia', dica: 'Abundância e fertilidade familiar', posicao: 'Área Leste' },
      { icon: '🎋', nome: 'Bambu Mossô', dica: 'Força e flexibilidade nos relacionamentos', posicao: 'Sala de estar' },
      { icon: '🌱', nome: 'Costela de Adão', dica: 'Crescimento e expansão familiar', posicao: 'Canto da sala' },
    ],
    objetos: [
      { icon: '🖼️', nome: 'Foto de Família Feliz', posicao: 'Parede Leste da sala' },
      { icon: '🪵', nome: 'Objeto em Madeira Natural', posicao: 'Mesa de centro ou aparador' },
      { icon: '🐉', nome: 'Dragão Verde (cerâmica)', posicao: 'Lado esquerdo da entrada' },
      { icon: '🌳', nome: 'Bonsai ou Árvore Miniatura', posicao: 'Área Leste do ambiente' },
      { icon: '🎨', nome: 'Quadro de Paisagem Verde', posicao: 'Parede da sala de jantar' },
      { icon: '🪈', nome: 'Flauta de Bambu', posicao: 'Parede do corredor (diagonal)' },
    ],
    mudra: {
      icon: '🌿', nome: 'Mudra da Árvore (Prithvi)',
      descricao: 'Fortalece os laços familiares e a saúde, ancorando a energia da Madeira.',
      passos: [
        'Sente-se com os pés firmes no chão, coluna ereta',
        'Una a ponta do dedo anelar com a ponta do polegar',
        'Mantenha os demais dedos relaxados e estendidos',
        'Visualize raízes crescendo dos seus pés até o centro da Terra',
        'Respire por 7 minutos, sentindo a força da árvore em você',
      ],
    },
    meditacao: {
      nome: 'Meditação da Árvore Ancestral',
      duracao: '20 minutos',
      descricao: 'Reconecta com a força da linhagem familiar e promove cura geracional.',
      passos: [
        'Sente-se confortavelmente e feche os olhos',
        'Visualize uma grande árvore milenar à sua frente',
        'Caminhe até ela e toque seu tronco — sinta a vida pulsando',
        'Cada raiz representa um ancestral — sinta a conexão profunda',
        'Peça mentalmente cura e harmonia para toda a sua linhagem',
        'Abrace a árvore e sinta a energia verde curando seu coração',
      ],
    },
    mantras: [
      { caracteres: '家和萬事興', romanizacao: 'Jiā hé wàn shì xīng', significado: 'Com harmonia familiar, tudo prospera' },
      { caracteres: '健康長壽', romanizacao: 'Jiànkāng chángshòu', significado: 'Saúde e longevidade' },
    ],
  },

  // ── 3. MADEIRA / PROSPERIDADE ───────────────────────────────────────────
  {
    id: 'madeira-prosperidade',
    nome: 'Madeira',
    gua: 'Prosperidade',
    elemento: 'Madeira',
    trigramo: '巽',
    corPrimaria: '#1a1a2e',
    corSecundaria: '#2d1b69',
    corTexto: '#CE93D8',
    cristais: [
      { nome: 'Citrino', cor: '#FFD700', propriedade: 'Atração de riqueza e sucesso financeiro' },
      { nome: 'Pirita', cor: '#CFB53B', propriedade: 'Prosperidade e abundância material' },
      { nome: 'Olho de Tigre', cor: '#B8860B', propriedade: 'Foco e determinação financeira' },
      { nome: 'Jade Imperial', cor: '#00A86B', propriedade: 'Sorte nos negócios e investimentos' },
      { nome: 'Ametista', cor: '#9B30FF', propriedade: 'Sabedoria nas decisões financeiras' },
    ],
    plantas: [
      { icon: '🪙', nome: 'Árvore da Fortuna (Pachira)', dica: 'Trançar 5 troncos para potencializar', posicao: 'Canto Sudeste' },
      { icon: '💰', nome: 'Planta Jade (Crassula)', dica: 'Folhas como moedas atraem riqueza', posicao: 'Mesa do escritório' },
      { icon: '🌿', nome: 'Manjericão', dica: 'Erva da prosperidade — manter fresca', posicao: 'Cozinha ou janela Sudeste' },
      { icon: '🎋', nome: 'Bambu da Sorte (8 hastes)', dica: '8 é o número da riqueza', posicao: 'Entrada do negócio' },
    ],
    objetos: [
      { icon: '🐸', nome: 'Sapo da Fortuna (Chan Chu)', posicao: 'Olhando para dentro, junto à porta' },
      { icon: '⛵', nome: 'Barco à Vela (com moedas)', posicao: 'Mesa, apontando para dentro' },
      { icon: '🧧', nome: 'Envelope Vermelho com Moedas', posicao: 'Dentro da carteira ou gaveta' },
      { icon: '🏮', nome: 'Lanterna Vermelha', posicao: 'Canto Sudeste do ambiente' },
      { icon: '💎', nome: 'Árvore de Pedras Preciosas', posicao: 'Aparador na área da prosperidade' },
      { icon: '🪙', nome: 'Moedas Chinesas Amarradas', posicao: 'Sob o tapete da entrada (3 moedas)' },
    ],
    mudra: {
      icon: '💰', nome: 'Mudra da Abundância (Kubera)',
      descricao: 'Ativa a energia de prosperidade e manifestação de riqueza.',
      passos: [
        'Sente-se confortavelmente com a coluna ereta',
        'Junte as pontas do polegar, indicador e dedo médio',
        'Dobre o anelar e o mínimo em direção à palma',
        'Faça o mudra com ambas as mãos sobre os joelhos',
        'Respire profundamente por 10 minutos, visualizando moedas de ouro caindo',
      ],
    },
    meditacao: {
      nome: 'Meditação do Cofre Dourado',
      duracao: '15 minutos',
      descricao: 'Reprograma a mentalidade de escassez para abundância ilimitada.',
      passos: [
        'Feche os olhos e respire 5 vezes profundamente',
        'Visualize um cofre dourado brilhante à sua frente',
        'Abra o cofre e veja que ele está cheio de moedas de ouro',
        'Pegue as moedas e sinta a riqueza em suas mãos',
        'O cofre se multiplica — veja cofres infinitos surgindo ao redor',
        'Agradeça pela abundância já presente e futura em sua vida',
      ],
    },
    mantras: [
      { caracteres: '財源廣進', romanizacao: 'Cáiyuán guǎng jìn', significado: 'Que as fontes de riqueza fluam abundantemente' },
      { caracteres: '招財進寶', romanizacao: 'Zhāo cái jìn bǎo', significado: 'Atrair riqueza e tesouros' },
    ],
  },

  // ── 4. FOGO / REPUTAÇÃO ─────────────────────────────────────────────────
  {
    id: 'fogo-reputacao',
    nome: 'Fogo',
    gua: 'Fama / Reputação',
    elemento: 'Fogo',
    trigramo: '離',
    corPrimaria: '#2e1a1a',
    corSecundaria: '#3e1616',
    corTexto: '#EF5350',
    cristais: [
      { nome: 'Granada', cor: '#8B0000', propriedade: 'Paixão e força de expressão pessoal' },
      { nome: 'Cornalina', cor: '#FF6347', propriedade: 'Coragem e visibilidade pública' },
      { nome: 'Rubi', cor: '#E0115F', propriedade: 'Liderança e reconhecimento' },
      { nome: 'Pedra do Sol', cor: '#FF8C00', propriedade: 'Brilho pessoal e carisma' },
      { nome: 'Jaspe Vermelho', cor: '#CC0000', propriedade: 'Vitalidade e força de presença' },
    ],
    plantas: [
      { icon: '🌺', nome: 'Antúrio Vermelho', dica: 'Flor do reconhecimento e fama', posicao: 'Área Sul do ambiente' },
      { icon: '🌹', nome: 'Rosa Vermelha', dica: 'Paixão e expressão do coração', posicao: 'Mesa da sala Sul' },
      { icon: '🌻', nome: 'Girassol', dica: 'Sempre voltado para a luz — visibilidade', posicao: 'Janela Sul' },
      { icon: '🌶️', nome: 'Pimenta Ornamental', dica: 'Ativa o Fogo e afasta negatividade', posicao: 'Cozinha ou varanda Sul' },
    ],
    objetos: [
      { icon: '🕯️', nome: 'Velas Vermelhas (par)', posicao: 'Aparador na área Sul' },
      { icon: '🏆', nome: 'Troféus e Diplomas', posicao: 'Parede Sul do escritório' },
      { icon: '🦅', nome: 'Fênix ou Pássaro Vermelho', posicao: 'Parede Sul, posição elevada' },
      { icon: '☀️', nome: 'Sol Decorativo (metal dourado)', posicao: 'Parede Sul da sala' },
      { icon: '🪔', nome: 'Luminária de Sal Rosa', posicao: 'Mesa lateral na área Sul' },
      { icon: '🔺', nome: 'Pirâmide de Cristal', posicao: 'Mesa de trabalho' },
    ],
    mudra: {
      icon: '🔥', nome: 'Mudra do Fogo (Agni)',
      descricao: 'Acende o fogo interior da reputação e presença magnética.',
      passos: [
        'Sente-se com a coluna ereta e ombros relaxados',
        'Dobre o dedo anelar até tocar a base do polegar',
        'Pressione suavemente o polegar sobre o anelar dobrado',
        'Mantenha os outros dedos estendidos',
        'Pratique por 10 minutos, visualizando uma chama dourada no peito',
      ],
    },
    meditacao: {
      nome: 'Meditação da Chama Interior',
      duracao: '12 minutos',
      descricao: 'Desperta o brilho pessoal e a confiança para ser visto e reconhecido.',
      passos: [
        'Acenda uma vela vermelha à sua frente (opcional)',
        'Feche os olhos e sinta o calor no centro do peito',
        'Visualize uma chama pequena crescendo dentro de você',
        'A chama cresce e se torna um sol brilhante no seu coração',
        'Essa luz se expande e ilumina tudo ao seu redor',
        'Afirme mentalmente: "Eu sou visto, reconhecido e respeitado"',
      ],
    },
    mantras: [
      { caracteres: '名揚四海', romanizacao: 'Míng yáng sì hǎi', significado: 'Que minha fama se espalhe pelos quatro mares' },
      { caracteres: '光明磊落', romanizacao: 'Guāngmíng lěiluò', significado: 'Brilhante e íntegro (caráter luminoso)' },
    ],
  },

  // ── 5. TERRA / AMOR ─────────────────────────────────────────────────────
  {
    id: 'terra-amor',
    nome: 'Terra',
    gua: 'Relacionamentos',
    elemento: 'Terra',
    trigramo: '坤',
    corPrimaria: '#2e1a2e',
    corSecundaria: '#3e1636',
    corTexto: '#F48FB1',
    cristais: [
      { nome: 'Quartzo Rosa', cor: '#FFB6C1', propriedade: 'Amor incondicional e cura do coração' },
      { nome: 'Rodocrosita', cor: '#FF69B4', propriedade: 'Autoamor e atração de parceiro ideal' },
      { nome: 'Kunzita', cor: '#E8ADAA', propriedade: 'Abertura emocional e vulnerabilidade saudável' },
      { nome: 'Morganita', cor: '#FADADD', propriedade: 'Compaixão e romance verdadeiro' },
      { nome: 'Turmalina Rosa', cor: '#FF1493', propriedade: 'Paixão e amor aprofundado' },
    ],
    plantas: [
      { icon: '🌹', nome: 'Rosas (sem espinhos)', dica: 'Remova os espinhos para evitar conflitos', posicao: 'Quarto, lado Sudoeste' },
      { icon: '🌸', nome: 'Orquídea Rosa', dica: 'Elegância e romance refinado', posicao: 'Criado-mudo do casal' },
      { icon: '💐', nome: 'Peônia', dica: 'Flor do romance no Feng Shui', posicao: 'Sala de estar, área Sudoeste' },
      { icon: '🌺', nome: 'Jasmim', dica: 'Aroma que atrai amor e sensualidade', posicao: 'Varanda do quarto' },
    ],
    objetos: [
      { icon: '🦆', nome: 'Par de Patos Mandarim', posicao: 'Criado-mudo do quarto (sempre em par)' },
      { icon: '💕', nome: 'Corações em Quartzo Rosa', posicao: 'Canto Sudoeste do quarto' },
      { icon: '🕯️', nome: 'Velas Rosa (par)', posicao: 'Aparador do quarto' },
      { icon: '🖼️', nome: 'Quadro de Casal (arte, não foto)', posicao: 'Parede Sudoeste do quarto' },
      { icon: '🦋', nome: 'Borboletas Decorativas (par)', posicao: 'Parede do quarto' },
      { icon: '🎀', nome: 'Nó Místico Duplo', posicao: 'Cabeceira da cama' },
    ],
    mudra: {
      icon: '💗', nome: 'Mudra do Lótus (Padma)',
      descricao: 'Abre o coração para dar e receber amor verdadeiro.',
      passos: [
        'Junte as palmas das mãos em frente ao peito (posição de prece)',
        'Mantenha as bases das mãos, os polegares e os mindinhos unidos',
        'Abra os outros dedos como pétalas de uma flor de lótus',
        'Posicione o mudra na altura do coração',
        'Respire suavemente por 10 minutos, sentindo o peito se expandir',
      ],
    },
    meditacao: {
      nome: 'Meditação das Duas Chamas',
      duracao: '15 minutos',
      descricao: 'Harmoniza a energia do relacionamento e atrai ou fortalece o amor.',
      passos: [
        'Sente-se confortavelmente e feche os olhos',
        'Visualize uma chama rosa suave no centro do seu coração',
        'Veja uma segunda chama rosa surgindo à sua frente — seu par',
        'As duas chamas se aproximam lentamente e se fundem em uma só',
        'Sinta o calor e a paz desta união energética',
        'Agradeça pelo amor presente ou que está a caminho',
      ],
    },
    mantras: [
      { caracteres: '愛情美滿', romanizacao: 'Àiqíng měimǎn', significado: 'Que o amor seja pleno e belo' },
      { caracteres: '百年好合', romanizacao: 'Bǎi nián hǎo hé', significado: 'Cem anos de união harmoniosa' },
    ],
  },

  // ── 6. METAL / CRIATIVIDADE ─────────────────────────────────────────────
  {
    id: 'metal-criatividade',
    nome: 'Metal',
    gua: 'Criatividade / Filhos',
    elemento: 'Metal',
    trigramo: '兌',
    corPrimaria: '#2e2a1a',
    corSecundaria: '#3e3616',
    corTexto: '#FFB74D',
    cristais: [
      { nome: 'Calcita Laranja', cor: '#FF8C00', propriedade: 'Criatividade e alegria de viver' },
      { nome: 'Cornalina', cor: '#FF6347', propriedade: 'Expressão artística e fertilidade' },
      { nome: 'Topázio Imperial', cor: '#FFC125', propriedade: 'Inspiração e manifestação criativa' },
      { nome: 'Moonstone (Pedra da Lua)', cor: '#C4AEAD', propriedade: 'Intuição criativa e ciclos femininos' },
      { nome: 'Quartzo Tangerina', cor: '#FF9966', propriedade: 'Entusiasmo e projetos criativos' },
    ],
    plantas: [
      { icon: '🌼', nome: 'Margaridas', dica: 'Pureza e alegria criativa', posicao: 'Área Oeste do ambiente' },
      { icon: '🌸', nome: 'Crisântemo Branco', dica: 'Flor do Metal — pureza e foco', posicao: 'Mesa de trabalho criativo' },
      { icon: '🪻', nome: 'Lavanda', dica: 'Inspira calma criativa e intuição', posicao: 'Quarto das crianças' },
      { icon: '🌿', nome: 'Suculentas em Vaso Metálico', dica: 'Combina Terra e Metal', posicao: 'Estante do ateliê' },
    ],
    objetos: [
      { icon: '🔔', nome: 'Sino de Vento (6 tubos)', posicao: 'Janela Oeste' },
      { icon: '🎨', nome: 'Material de Arte Visível', posicao: 'Estante da área criativa' },
      { icon: '🥁', nome: 'Instrumento Musical', posicao: 'Sala ou área de lazer' },
      { icon: '🖼️', nome: 'Arte das Crianças Emoldurada', posicao: 'Parede Oeste' },
      { icon: '⭐', nome: 'Estrela ou Lua (metal)', posicao: 'Quarto das crianças' },
      { icon: '🪩', nome: 'Esfera de Cristal Facetada', posicao: 'Janela, criando arco-íris' },
    ],
    mudra: {
      icon: '✨', nome: 'Mudra da Criação (Hakini)',
      descricao: 'Estimula o cérebro criativo e a capacidade de inovação.',
      passos: [
        'Junte todas as pontas dos dedos correspondentes (polegar com polegar, etc.)',
        'As mãos formam um "domo" com os dedos se tocando',
        'Posicione na altura do terceiro olho (entre as sobrancelhas)',
        'Olhe levemente para cima com os olhos fechados',
        'Respire por 8 minutos, sentindo ideias fluírem como luz dourada',
      ],
    },
    meditacao: {
      nome: 'Meditação do Ateliê Interior',
      duracao: '15 minutos',
      descricao: 'Acessa o espaço criativo interior onde tudo é possível.',
      passos: [
        'Feche os olhos e imagine uma porta dourada à sua frente',
        'Abra a porta e entre em um ateliê mágico cheio de luz',
        'Veja mesas com tintas, instrumentos, ferramentas — tudo que você precisa',
        'Comece a criar livremente — pinte, esculpa, componha — sem julgamento',
        'Sinta a alegria pura da criação fluindo através de você',
        'Traga essa energia criativa de volta ao abrir os olhos lentamente',
      ],
    },
    mantras: [
      { caracteres: '妙筆生花', romanizacao: 'Miào bǐ shēng huā', significado: 'O pincel mágico faz flores desabrocharem (criatividade florescente)' },
      { caracteres: '心想事成', romanizacao: 'Xīn xiǎng shì chéng', significado: 'Que os desejos do coração se realizem' },
    ],
  },

  // ── 7. METAL / MENTORES ─────────────────────────────────────────────────
  {
    id: 'metal-mentores',
    nome: 'Metal',
    gua: 'Pessoas Úteis',
    elemento: 'Metal',
    trigramo: '乾',
    corPrimaria: '#1a1a2e',
    corSecundaria: '#2a2a3e',
    corTexto: '#B0BEC5',
    cristais: [
      { nome: 'Cristal de Quartzo Transparente', cor: '#F0F0F0', propriedade: 'Clareza e conexão com guias espirituais' },
      { nome: 'Selenita', cor: '#FFFAFA', propriedade: 'Purificação e canal com mentores celestiais' },
      { nome: 'Labradorita', cor: '#6B8E9B', propriedade: 'Proteção e conexão com pessoas certas' },
      { nome: 'Howlita', cor: '#F5F5F5', propriedade: 'Paciência e sabedoria dos mestres' },
      { nome: 'Fluorita', cor: '#7B68EE', propriedade: 'Discernimento e ajuda inesperada' },
    ],
    plantas: [
      { icon: '🌿', nome: 'Alecrim', dica: 'Proteção e clareza mental', posicao: 'Entrada da casa, lado direito' },
      { icon: '🤍', nome: 'Lírio Branco', dica: 'Pureza e conexão espiritual', posicao: 'Área Noroeste' },
      { icon: '🌸', nome: 'Orquídea Branca', dica: 'Elegância e ajuda divina', posicao: 'Escritório, lado Noroeste' },
      { icon: '🍃', nome: 'Arruda', dica: 'Proteção ancestral', posicao: 'Próximo à porta de entrada' },
    ],
    objetos: [
      { icon: '🔔', nome: 'Sino Tibetano', posicao: 'Mesa de meditação ou entrada' },
      { icon: '🧭', nome: 'Bússola ou Globo', posicao: 'Escritório, área Noroeste' },
      { icon: '🙏', nome: 'Imagem de Mentor/Mestre', posicao: 'Parede Noroeste do escritório' },
      { icon: '📿', nome: 'Mala de 108 Contas', posicao: 'Altar pessoal' },
      { icon: '🕊️', nome: 'Pomba ou Anjo (cerâmica)', posicao: 'Entrada da casa' },
      { icon: '⚙️', nome: 'Objeto em Metal Nobre', posicao: 'Aparador na área Noroeste' },
    ],
    mudra: {
      icon: '🙏', nome: 'Mudra da Gratidão (Anjali)',
      descricao: 'Abre o coração para receber orientação e ajuda de mentores e guias.',
      passos: [
        'Junte as palmas das mãos na frente do coração',
        'Pressione suavemente os polegares contra o esterno',
        'Feche os olhos e incline levemente a cabeça',
        'Sinta gratidão por todos que já te ajudaram',
        'Respire por 7 minutos, pedindo mentalmente por guias e mentores',
      ],
    },
    meditacao: {
      nome: 'Meditação do Conselho dos Sábios',
      duracao: '20 minutos',
      descricao: 'Conecta com mentores e guias espirituais para receber orientação.',
      passos: [
        'Feche os olhos e visualize um templo dourado no topo de uma montanha',
        'Suba os degraus e entre no templo — uma mesa redonda te espera',
        'Sentados à mesa estão seus mentores — pessoas reais ou simbólicas',
        'Faça mentalmente uma pergunta importante para sua vida',
        'Ouça com o coração — a resposta pode vir como imagem, palavra ou sentimento',
        'Agradeça aos mentores e desça a montanha com a resposta no coração',
      ],
    },
    mantras: [
      { caracteres: '貴人相助', romanizacao: 'Guìrén xiāng zhù', significado: 'Que pessoas nobres venham em auxílio' },
      { caracteres: '天助自助', romanizacao: 'Tiān zhù zì zhù', significado: 'O Céu ajuda quem se ajuda' },
    ],
  },

  // ── 8. TERRA / SABEDORIA ────────────────────────────────────────────────
  {
    id: 'terra-sabedoria',
    nome: 'Terra',
    gua: 'Espiritualidade',
    elemento: 'Terra',
    trigramo: '艮',
    corPrimaria: '#2e2a1a',
    corSecundaria: '#3e3216',
    corTexto: '#A1887F',
    cristais: [
      { nome: 'Ametista', cor: '#9B59B6', propriedade: 'Sabedoria espiritual e meditação profunda' },
      { nome: 'Lápis Lazúli', cor: '#26619C', propriedade: 'Conhecimento ancestral e verdade interior' },
      { nome: 'Sodalita', cor: '#4169E1', propriedade: 'Estudo, concentração e disciplina mental' },
      { nome: 'Turquesa', cor: '#40E0D0', propriedade: 'Sabedoria xamânica e proteção espiritual' },
      { nome: 'Sugilita', cor: '#8B008B', propriedade: 'Conexão com o Eu Superior e iluminação' },
    ],
    plantas: [
      { icon: '🧘', nome: 'Lótus (em vaso com água)', dica: 'Iluminação e despertar espiritual', posicao: 'Área de meditação' },
      { icon: '🌿', nome: 'Sálvia Branca', dica: 'Purificação e sabedoria ancestral', posicao: 'Altar pessoal' },
      { icon: '🌱', nome: 'Ficus Religiosa (Bodhi)', dica: 'Árvore da iluminação de Buda', posicao: 'Área Nordeste, em vaso grande' },
      { icon: '💜', nome: 'Violeta', dica: 'Transmutação e estudo espiritual', posicao: 'Mesa de estudos' },
    ],
    objetos: [
      { icon: '📚', nome: 'Livros de Sabedoria', posicao: 'Estante na área Nordeste' },
      { icon: '🧘', nome: 'Estátua de Buda ou Sábio', posicao: 'Altar ou nicho elevado' },
      { icon: '🔮', nome: 'Esfera de Cristal', posicao: 'Mesa de estudos' },
      { icon: '🕯️', nome: 'Velas Azuis ou Roxas', posicao: 'Área de meditação' },
      { icon: '📿', nome: 'Mala de Meditação', posicao: 'Altar pessoal' },
      { icon: '🏔️', nome: 'Imagem de Montanha', posicao: 'Parede Nordeste' },
    ],
    mudra: {
      icon: '🧠', nome: 'Mudra do Conhecimento (Gyan)',
      descricao: 'O mudra mais clássico — une sabedoria individual com universal.',
      passos: [
        'Sente-se em posição de meditação confortável',
        'Una a ponta do polegar com a ponta do indicador, formando um círculo',
        'Estenda os outros três dedos relaxados',
        'Apoie as mãos sobre os joelhos, palmas para cima',
        'Medite por 15 minutos, focando na respiração e no terceiro olho',
      ],
    },
    meditacao: {
      nome: 'Meditação da Montanha Sagrada',
      duracao: '20 minutos',
      descricao: 'Conecta com a sabedoria imutável e a paz interior do elemento Terra.',
      passos: [
        'Sente-se firme como uma montanha — coluna ereta, ombros relaxados',
        'Visualize-se sentado no topo de uma montanha sagrada',
        'Nuvens passam ao seu redor, mas você permanece imóvel e sereno',
        'Com cada respiração, absorva a sabedoria milenar da montanha',
        'Sinta o conhecimento ancestral subindo pelas suas raízes até o coração',
        'Abra os olhos lentamente, carregando a serenidade da montanha',
      ],
    },
    mantras: [
      { caracteres: '智慧如海', romanizacao: 'Zhìhuì rú hǎi', significado: 'Sabedoria vasta como o oceano' },
      { caracteres: '博學多聞', romanizacao: 'Bóxué duō wén', significado: 'Amplo conhecimento e vasto aprendizado' },
    ],
  },

  // ── 9. TERRA / CENTRO ───────────────────────────────────────────────────
  {
    id: 'terra-centro',
    nome: 'Terra',
    gua: 'Saúde / Centro',
    elemento: 'Terra',
    trigramo: '中',
    corPrimaria: '#2e2a1a',
    corSecundaria: '#3e3216',
    corTexto: '#FFD54F',
    cristais: [
      { nome: 'Quartzo Transparente', cor: '#F0F0F0', propriedade: 'Equilíbrio geral e amplificação de energia' },
      { nome: 'Citrino Natural', cor: '#E8B830', propriedade: 'Vitalidade e energia do centro' },
      { nome: 'Jaspe Amarelo', cor: '#DAA520', propriedade: 'Estabilidade e nutrição da Terra' },
      { nome: 'Calcita Mel', cor: '#FABA5F', propriedade: 'Digestão energética e equilíbrio' },
      { nome: 'Âmbar', cor: '#FFBF00', propriedade: 'Cura ancestral e vitalidade solar' },
    ],
    plantas: [
      { icon: '🌻', nome: 'Girassol', dica: 'Energia solar e vitalidade central', posicao: 'Centro da casa ou mesa de jantar' },
      { icon: '🌿', nome: 'Hortelã', dica: 'Frescor e renovação da energia vital', posicao: 'Cozinha' },
      { icon: '🌾', nome: 'Trigo ou Grãos em Vaso', dica: 'Nutrição e abundância da Terra', posicao: 'Centro da mesa de jantar' },
      { icon: '💛', nome: 'Cravo Amarelo', dica: 'Proteção e saúde', posicao: 'Centro do ambiente principal' },
    ],
    objetos: [
      { icon: '🏺', nome: 'Vaso de Cerâmica (Terracota)', posicao: 'Centro da casa ou sala' },
      { icon: '🌍', nome: 'Globo Terrestre ou Esfera', posicao: 'Mesa central' },
      { icon: '🟡', nome: 'Tapete Amarelo/Terracota', posicao: 'Centro do ambiente principal' },
      { icon: '🕯️', nome: 'Vela Amarela Grossa', posicao: 'Centro da mesa de jantar' },
      { icon: '🧘', nome: 'Almofada de Meditação', posicao: 'Centro da casa' },
      { icon: '⚖️', nome: 'Símbolo de Equilíbrio', posicao: 'Mesa de centro' },
    ],
    mudra: {
      icon: '⚖️', nome: 'Mudra da Terra (Prithvi)',
      descricao: 'Ancora e estabiliza toda a energia do corpo e do lar.',
      passos: [
        'Sente-se com os dois pés bem apoiados no chão',
        'Una a ponta do anelar com a ponta do polegar em cada mão',
        'Estenda os outros dedos confortavelmente',
        'Sinta o peso do corpo e a conexão com a Terra',
        'Respire por 10 minutos, sentindo-se cada vez mais centrado e estável',
      ],
    },
    meditacao: {
      nome: 'Meditação do Centro Dourado',
      duracao: '15 minutos',
      descricao: 'Equilibra todas as áreas da vida a partir do centro — o Tai Chi do lar.',
      passos: [
        'Sente-se no centro da sua casa (ou imagine-se lá)',
        'Visualize uma esfera dourada brilhante no centro do seu abdômen',
        'A esfera pulsa e envia raios de luz para todas as direções',
        'Cada raio ilumina um setor da sua vida — saúde, amor, carreira...',
        'Sinta todos os setores se equilibrando e harmonizando',
        'A esfera se expande e preenche toda a casa com luz dourada',
      ],
    },
    mantras: [
      { caracteres: '中庸之道', romanizacao: 'Zhōngyōng zhī dào', significado: 'O Caminho do Equilíbrio (Doutrina do Meio)' },
      { caracteres: '身心健康', romanizacao: 'Shēn xīn jiànkāng', significado: 'Saúde do corpo e da mente' },
    ],
  },
]

// ══════════════════════════════════════════════════════════════════════════════
// PAGE COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

function CurasPageContent() {
  const searchParams = useSearchParams()
  const consultaId = searchParams.get('consultaId')
  const [setores, setSetores] = useState<any[]>([])
  const [activeSection, setActiveSection] = useState(ELEMENTOS[0].id)
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // Load consultation sectors if consultaId provided
  useEffect(() => {
    if (!consultaId) return
    supabase
      .from('setores_bagua')
      .select('*')
      .eq('consulta_id', consultaId)
      .order('numero')
      .then(({ data }) => { if (data) setSetores(data) })
  }, [consultaId])

  // Scroll spy
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id)
          }
        }
      },
      { rootMargin: '-100px 0px -60% 0px', threshold: 0.1 }
    )
    Object.values(sectionRefs.current).forEach(el => { if (el) observer.observe(el) })
    return () => observer.disconnect()
  }, [])

  function scrollTo(id: string) {
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Find sector score for a guá name
  function findScore(guaName: string): number | null {
    const mappings: Record<string, string[]> = {
      'Carreira': ['Carreira'],
      'Família / Saúde': ['Família', 'Família/Saúde'],
      'Prosperidade': ['Prosperidade'],
      'Fama / Reputação': ['Fama', 'Fama/Reputação'],
      'Relacionamentos': ['Relacionamentos', 'Amor'],
      'Criatividade / Filhos': ['Criatividade', 'Filhos'],
      'Pessoas Úteis': ['Pessoas Úteis', 'Pessoas Uteis', 'Mentores'],
      'Espiritualidade': ['Espiritualidade', 'Conhecimento', 'Sabedoria'],
      'Saúde / Centro': ['Centro', 'Centro/Saúde', 'Saúde'],
    }
    const names = mappings[guaName] || [guaName]
    const setor = setores.find(s => names.some(n => s.nome === n))
    return setor?.score_percentual ?? null
  }

  function scoreLevel(score: number): { label: string; cor: string; bg: string } {
    if (score >= 70) return { label: 'Equilibrado', cor: '#15803D', bg: 'rgba(21,128,61,0.15)' }
    if (score >= 40) return { label: 'Atenção', cor: '#D97706', bg: 'rgba(217,119,6,0.15)' }
    return { label: 'Urgente', cor: '#DC2626', bg: 'rgba(220,38,38,0.15)' }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#e0e0e0', fontFamily: "'Inter', sans-serif" }}>

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        padding: '40px 24px 30px', textAlign: 'center',
        borderBottom: '2px solid #b8860b'
      }}>
        <p style={{ fontSize: '14px', color: '#b8860b', letterSpacing: '4px', margin: '0 0 8px 0', textTransform: 'uppercase' }}>
          治 · Curas & Ativações
        </p>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#f4e4bc', margin: '0 0 8px 0' }}>
          Guia Completo de Harmonização
        </h1>
        <p style={{ fontSize: '14px', color: '#b0b0b0', margin: 0, maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto' }}>
          Cristais, plantas, objetos, mudras, meditações e mantras organizados por elemento e Guá do Ba Guá
        </p>
        {consultaId && setores.length > 0 && (
          <div style={{
            marginTop: '16px', padding: '10px 20px', background: 'rgba(184,134,11,0.15)',
            borderRadius: '8px', display: 'inline-block', border: '1px solid rgba(184,134,11,0.3)'
          }}>
            <span style={{ color: '#b8860b', fontSize: '12px' }}>
              Vinculado à consulta — setores prioritários destacados
            </span>
          </div>
        )}
      </div>

      {/* ── NAVIGATION ──────────────────────────────────────────────────── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(10,10,15,0.95)', backdropFilter: 'blur(10px)',
        borderBottom: '1px solid #222', padding: '10px 24px',
        display: 'flex', gap: '6px', overflowX: 'auto',
        justifyContent: 'center', flexWrap: 'wrap'
      }}>
        {ELEMENTOS.map(el => {
          const isActive = activeSection === el.id
          const score = findScore(el.gua)
          const isPriority = score !== null && score < 40
          return (
            <button key={el.id} onClick={() => scrollTo(el.id)} style={{
              padding: '8px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer',
              fontSize: '12px', fontWeight: isActive ? 'bold' : 'normal',
              background: isActive ? el.corPrimaria : 'transparent',
              color: isActive ? el.corTexto : '#888',
              outline: isPriority ? '2px solid #DC2626' : isActive ? `1px solid ${el.corTexto}40` : 'none',
              transition: 'all 0.2s', whiteSpace: 'nowrap',
              display: 'flex', alignItems: 'center', gap: '6px'
            }}>
              <span>{el.trigramo}</span>
              <span>{el.gua}</span>
              {score !== null && (
                <span style={{
                  fontSize: '10px', padding: '1px 6px', borderRadius: '10px',
                  background: scoreLevel(score).bg, color: scoreLevel(score).cor, fontWeight: 'bold'
                }}>{score}%</span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── CONTENT ─────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px 20px' }}>
        {ELEMENTOS.map(el => {
          const score = findScore(el.gua)
          const level = score !== null ? scoreLevel(score) : null
          return (
            <div
              key={el.id}
              id={el.id}
              ref={r => { sectionRefs.current[el.id] = r }}
              style={{ marginBottom: '48px', scrollMarginTop: '70px' }}
            >
              {/* Section Header */}
              <div style={{
                background: `linear-gradient(135deg, ${el.corPrimaria}, ${el.corSecundaria})`,
                borderRadius: '12px 12px 0 0', padding: '20px 24px',
                borderBottom: `2px solid ${el.corTexto}40`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '28px', color: el.corTexto }}>{el.trigramo}</span>
                    <h2 style={{ fontSize: '22px', fontWeight: 'bold', color: el.corTexto, margin: 0 }}>
                      {el.gua}
                    </h2>
                  </div>
                  <p style={{ fontSize: '13px', color: '#999', margin: 0 }}>
                    Elemento: {el.elemento} · Trigramo: {el.trigramo}
                  </p>
                </div>
                {level && (
                  <div style={{
                    padding: '8px 16px', borderRadius: '20px',
                    background: level.bg, border: `1px solid ${level.cor}40`
                  }}>
                    <span style={{ fontSize: '12px', color: level.cor, fontWeight: 'bold' }}>
                      Score: {score}% — {level.label}
                    </span>
                  </div>
                )}
              </div>

              <div style={{
                background: '#111118', borderRadius: '0 0 12px 12px',
                padding: '24px', border: `1px solid #222`, borderTop: 'none'
              }}>
                {/* ── CRISTAIS ──────────────────────────────────────────── */}
                <div style={{ marginBottom: '28px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: '#f4e4bc', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>💎</span> Cristais
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                    {el.cristais.map(c => (
                      <div key={c.nome} style={{
                        background: '#1a1a25', borderRadius: '10px', padding: '14px',
                        border: '1px solid #2a2a3a', display: 'flex', gap: '10px', alignItems: 'flex-start'
                      }}>
                        <div style={{
                          width: '28px', height: '28px', borderRadius: '50%',
                          background: c.cor, flexShrink: 0, border: '2px solid #333',
                          boxShadow: `0 0 8px ${c.cor}40`
                        }} />
                        <div>
                          <p style={{ fontSize: '13px', fontWeight: 'bold', color: '#e0e0e0', margin: '0 0 2px 0' }}>{c.nome}</p>
                          <p style={{ fontSize: '11px', color: '#888', margin: 0 }}>{c.propriedade}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── PLANTAS ───────────────────────────────────────────── */}
                <div style={{ marginBottom: '28px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: '#f4e4bc', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>🌿</span> Plantas
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px' }}>
                    {el.plantas.map(p => (
                      <div key={p.nome} style={{
                        background: '#1a1a25', borderRadius: '10px', padding: '14px',
                        border: '1px solid #2a2a3a'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                          <span style={{ fontSize: '20px' }}>{p.icon}</span>
                          <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#e0e0e0' }}>{p.nome}</span>
                        </div>
                        <p style={{ fontSize: '11px', color: '#aaa', margin: '0 0 4px 0' }}>{p.dica}</p>
                        <p style={{ fontSize: '10px', color: '#666', margin: 0 }}>📍 {p.posicao}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── OBJETOS ──────────────────────────────────────────── */}
                <div style={{ marginBottom: '28px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: '#f4e4bc', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>🏺</span> Objetos & Curas
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                    {el.objetos.map(o => (
                      <div key={o.nome} style={{
                        background: '#1a1a25', borderRadius: '10px', padding: '12px',
                        border: '1px solid #2a2a3a', display: 'flex', gap: '10px', alignItems: 'center'
                      }}>
                        <span style={{ fontSize: '22px' }}>{o.icon}</span>
                        <div>
                          <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#e0e0e0', margin: '0 0 2px 0' }}>{o.nome}</p>
                          <p style={{ fontSize: '10px', color: '#777', margin: 0 }}>📍 {o.posicao}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── MUDRA & MEDITAÇÃO (side by side) ─────────────────── */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '28px' }}>
                  {/* Mudra */}
                  <div style={{
                    background: `linear-gradient(135deg, ${el.corPrimaria}, #1a1a2e)`,
                    borderRadius: '12px', padding: '20px',
                    border: `1px solid ${el.corTexto}20`
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                      <span style={{ fontSize: '24px' }}>{el.mudra.icon}</span>
                      <h4 style={{ fontSize: '14px', fontWeight: 'bold', color: el.corTexto, margin: 0 }}>
                        {el.mudra.nome}
                      </h4>
                    </div>
                    <p style={{ fontSize: '12px', color: '#aaa', margin: '0 0 12px 0' }}>{el.mudra.descricao}</p>
                    <ol style={{ margin: 0, paddingLeft: '18px' }}>
                      {el.mudra.passos.map((p, i) => (
                        <li key={i} style={{ fontSize: '11px', color: '#ccc', marginBottom: '6px', lineHeight: '1.4' }}>{p}</li>
                      ))}
                    </ol>
                  </div>

                  {/* Meditação */}
                  <div style={{
                    background: `linear-gradient(135deg, ${el.corSecundaria}, #1a1a2e)`,
                    borderRadius: '12px', padding: '20px',
                    border: `1px solid ${el.corTexto}20`
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '24px' }}>🧘</span>
                      <h4 style={{ fontSize: '14px', fontWeight: 'bold', color: el.corTexto, margin: 0 }}>
                        {el.meditacao.nome}
                      </h4>
                    </div>
                    <p style={{ fontSize: '11px', color: '#888', margin: '0 0 8px 0' }}>Duração: {el.meditacao.duracao}</p>
                    <p style={{ fontSize: '12px', color: '#aaa', margin: '0 0 12px 0' }}>{el.meditacao.descricao}</p>
                    <ol style={{ margin: 0, paddingLeft: '18px' }}>
                      {el.meditacao.passos.map((p, i) => (
                        <li key={i} style={{ fontSize: '11px', color: '#ccc', marginBottom: '6px', lineHeight: '1.4' }}>{p}</li>
                      ))}
                    </ol>
                  </div>
                </div>

                {/* ── MANTRAS ──────────────────────────────────────────── */}
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: '#f4e4bc', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>🕉️</span> Mantras
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    {el.mantras.map((m, i) => (
                      <div key={i} style={{
                        background: `linear-gradient(135deg, ${el.corPrimaria}, #0a0a15)`,
                        borderRadius: '12px', padding: '20px', textAlign: 'center',
                        border: `1px solid ${el.corTexto}20`
                      }}>
                        <p style={{ fontSize: '28px', color: el.corTexto, fontWeight: 'bold', margin: '0 0 6px 0', letterSpacing: '4px' }}>
                          {m.caracteres}
                        </p>
                        <p style={{ fontSize: '13px', color: '#ccc', margin: '0 0 4px 0', fontStyle: 'italic' }}>
                          {m.romanizacao}
                        </p>
                        <p style={{ fontSize: '11px', color: '#888', margin: 0 }}>
                          {m.significado}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <div style={{
        textAlign: 'center', padding: '30px 24px',
        borderTop: '1px solid #222', color: '#555', fontSize: '12px'
      }}>
        <p style={{ margin: '0 0 4px 0' }}>風水 · FengShui Studio — Curas & Ativações</p>
        <p style={{ margin: 0 }}>Baseado na escola do Chapéu Negro (Black Hat Sect)</p>
      </div>
    </div>
  )
}

export default function CurasPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#b8860b', fontSize: '16px' }}>Carregando Curas & Ativações...</p>
      </div>
    }>
      <CurasPageContent />
    </Suspense>
  )
}
