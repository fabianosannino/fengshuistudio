'use client'

import { useState, useRef, useEffect } from 'react'
import AppShell from '../components/AppShell'

// ========================
// PLANT DATABASE
// ========================
const PLANT_DATABASE: PlantInfo[] = [
  {
    id: 'tomate',
    nome: 'Tomate',
    nomeCientifico: 'Solanum lycopersicum',
    categoria: 'Hortalica',
    icon: '\uD83C\uDF45',
    phIdeal: '6.0 - 6.8',
    tempIdeal: '20 - 30°C',
    ciclo: '90 - 120 dias',
    nutrientes: { N: 'alto', P: 'medio', K: 'alto' },
    descricao: 'Planta de clima quente, necessita de boa luminosidade e solo rico em materia organica.',
  },
  {
    id: 'alface',
    nome: 'Alface',
    nomeCientifico: 'Lactuca sativa',
    categoria: 'Hortalica',
    icon: '\uD83E\uDD6C',
    phIdeal: '6.0 - 7.0',
    tempIdeal: '15 - 24°C',
    ciclo: '45 - 60 dias',
    nutrientes: { N: 'alto', P: 'baixo', K: 'medio' },
    descricao: 'Prefere clima ameno, solo leve e bem drenado com boa umidade.',
  },
  {
    id: 'milho',
    nome: 'Milho',
    nomeCientifico: 'Zea mays',
    categoria: 'Graos',
    icon: '\uD83C\uDF3D',
    phIdeal: '5.5 - 7.0',
    tempIdeal: '24 - 30°C',
    ciclo: '100 - 150 dias',
    nutrientes: { N: 'muito alto', P: 'medio', K: 'alto' },
    descricao: 'Cultura de grande porte, demanda alta em nitrogenio e boa drenagem.',
  },
  {
    id: 'soja',
    nome: 'Soja',
    nomeCientifico: 'Glycine max',
    categoria: 'Graos',
    icon: '\uD83C\uDF31',
    phIdeal: '6.0 - 6.5',
    tempIdeal: '20 - 30°C',
    ciclo: '100 - 140 dias',
    nutrientes: { N: 'baixo', P: 'alto', K: 'alto' },
    descricao: 'Leguminosa que fixa nitrogenio. Necessita boa calagem e fosforo.',
  },
  {
    id: 'cafe',
    nome: 'Cafe',
    nomeCientifico: 'Coffea arabica',
    categoria: 'Perene',
    icon: '\u2615',
    phIdeal: '5.5 - 6.5',
    tempIdeal: '18 - 24°C',
    ciclo: 'Perene (colheita anual)',
    nutrientes: { N: 'alto', P: 'medio', K: 'alto' },
    descricao: 'Cultura perene de meia sombra, necessita solo profundo e bem drenado.',
  },
  {
    id: 'rosa',
    nome: 'Rosa',
    nomeCientifico: 'Rosa spp.',
    categoria: 'Ornamental',
    icon: '\uD83C\uDF39',
    phIdeal: '6.0 - 6.5',
    tempIdeal: '15 - 28°C',
    ciclo: 'Perene',
    nutrientes: { N: 'medio', P: 'alto', K: 'medio' },
    descricao: 'Planta ornamental que necessita de poda regular e solo rico em fosforo.',
  },
  {
    id: 'orquidea',
    nome: 'Orquidea',
    nomeCientifico: 'Orchidaceae',
    categoria: 'Ornamental',
    icon: '\uD83C\uDF3A',
    phIdeal: '5.5 - 6.5',
    tempIdeal: '18 - 28°C',
    ciclo: 'Perene',
    nutrientes: { N: 'baixo', P: 'medio', K: 'baixo' },
    descricao: 'Epifita que necessita de substrato arejado e adubacao leve e frequente.',
  },
  {
    id: 'eucalipto',
    nome: 'Eucalipto',
    nomeCientifico: 'Eucalyptus spp.',
    categoria: 'Florestal',
    icon: '\uD83C\uDF33',
    phIdeal: '5.0 - 6.0',
    tempIdeal: '18 - 30°C',
    ciclo: '5 - 7 anos (corte)',
    nutrientes: { N: 'medio', P: 'alto', K: 'alto' },
    descricao: 'Arvore de rapido crescimento, alta demanda de fosforo na fase inicial.',
  },
  {
    id: 'morango',
    nome: 'Morango',
    nomeCientifico: 'Fragaria x ananassa',
    categoria: 'Fruta',
    icon: '\uD83C\uDF53',
    phIdeal: '5.5 - 6.5',
    tempIdeal: '13 - 26°C',
    ciclo: '60 - 90 dias (producao)',
    nutrientes: { N: 'medio', P: 'alto', K: 'alto' },
    descricao: 'Fruta de clima temperado, necessita solo acido e rico em materia organica.',
  },
  {
    id: 'cana',
    nome: 'Cana-de-acucar',
    nomeCientifico: 'Saccharum officinarum',
    categoria: 'Industrial',
    icon: '\uD83C\uDF3E',
    phIdeal: '5.5 - 6.5',
    tempIdeal: '25 - 35°C',
    ciclo: '12 - 18 meses',
    nutrientes: { N: 'alto', P: 'medio', K: 'muito alto' },
    descricao: 'Cultura tropical de grande porte, alta demanda de potassio.',
  },
  {
    id: 'pimentao',
    nome: 'Pimentao',
    nomeCientifico: 'Capsicum annuum',
    categoria: 'Hortalica',
    icon: '\uD83C\uDF36\uFE0F',
    phIdeal: '5.5 - 6.8',
    tempIdeal: '21 - 30°C',
    ciclo: '90 - 120 dias',
    nutrientes: { N: 'medio', P: 'medio', K: 'alto' },
    descricao: 'Sensivel ao frio, necessita solo fertil e boa irrigacao.',
  },
  {
    id: 'manga',
    nome: 'Manga',
    nomeCientifico: 'Mangifera indica',
    categoria: 'Fruta',
    icon: '\uD83E\uDD6D',
    phIdeal: '5.5 - 7.0',
    tempIdeal: '24 - 30°C',
    ciclo: 'Perene (colheita anual)',
    nutrientes: { N: 'medio', P: 'medio', K: 'alto' },
    descricao: 'Arvore tropical de grande porte que produz melhor em climas quentes e secos.',
  },
]

// ========================
// REGIONS DATABASE
// ========================
const REGIOES = [
  { id: 'norte', nome: 'Norte', estados: 'AM, PA, AC, RO, RR, AP, TO', clima: 'Equatorial', soloTipico: 'Latossolo Amarelo', caracteristicas: 'Alta pluviosidade, temperatura elevada, solo acido' },
  { id: 'nordeste', nome: 'Nordeste', estados: 'MA, PI, CE, RN, PB, PE, AL, SE, BA', clima: 'Tropical / Semiarido', soloTipico: 'Latossolo Vermelho / Neossolo', caracteristicas: 'Irregular pluviosidade, alta evaporacao, solos variados' },
  { id: 'centro-oeste', nome: 'Centro-Oeste', estados: 'MT, MS, GO, DF', clima: 'Tropical', soloTipico: 'Latossolo Vermelho', caracteristicas: 'Cerrado predominante, solo acido com aluminio toxico' },
  { id: 'sudeste', nome: 'Sudeste', estados: 'SP, RJ, MG, ES', clima: 'Tropical / Subtropical', soloTipico: 'Latossolo Vermelho-Amarelo', caracteristicas: 'Diversidade climatica, solos medios a ferteis' },
  { id: 'sul', nome: 'Sul', estados: 'PR, SC, RS', clima: 'Subtropical', soloTipico: 'Latossolo Vermelho / Nitossolo', caracteristicas: 'Clima temperado, geadas, solos mais ferteis' },
]

// ========================
// SOIL TYPES
// ========================
const TIPOS_SOLO = [
  { id: 'arenoso', nome: 'Arenoso', descricao: 'Leve, drena rapido, pouca retencao de nutrientes', correcao: 'Adicionar materia organica e argila', icon: '\uD83C\uDFD6\uFE0F' },
  { id: 'argiloso', nome: 'Argiloso', descricao: 'Pesado, retencao de agua, compactacao', correcao: 'Adicionar areia e materia organica para aerar', icon: '\uD83E\uDDF1' },
  { id: 'siltoso', nome: 'Siltoso', descricao: 'Intermediario, boa retencao, erosao facil', correcao: 'Cobertura vegetal e materia organica', icon: '\uD83C\uDF3E' },
  { id: 'humoso', nome: 'Humoso / Organico', descricao: 'Rico em materia organica, escuro, fertil', correcao: 'Geralmente nao necessita grande correcao', icon: '\uD83C\uDF31' },
  { id: 'latossolo', nome: 'Latossolo (Cerrado)', descricao: 'Profundo, acido, pobre em nutrientes, bem drenado', correcao: 'Calagem + fosfatagem + adubacao completa', icon: '\uD83D\uDFE5' },
]

// ========================
// PRODUCTION TYPES
// ========================
const TIPOS_PRODUCAO = [
  { id: 'vaso', nome: 'Vaso / Jardineira', descricao: 'Cultivo domestico em recipientes', icon: '\uD83E\uDEB4', escala: 'Micro' },
  { id: 'horta', nome: 'Horta Domestica', descricao: 'Canteiros pequenos em residencias', icon: '\uD83C\uDFE1', escala: 'Pequena' },
  { id: 'estufa', nome: 'Estufa / Viveiro', descricao: 'Ambiente controlado para producao de mudas', icon: '\uD83C\uDFED', escala: 'Media' },
  { id: 'pequena', nome: 'Pequena Propriedade', descricao: 'Ate 4 modulos fiscais - agricultura familiar', icon: '\uD83C\uDF3E', escala: 'Pequena-Media' },
  { id: 'media', nome: 'Media Propriedade', descricao: 'Producao comercial regional', icon: '\uD83D\uDE9C', escala: 'Media-Grande' },
  { id: 'larga', nome: 'Larga Escala', descricao: 'Agronegocio - producao em grande escala', icon: '\uD83C\uDF3D', escala: 'Grande' },
]

// ========================
// PROBLEMS DATABASE
// ========================
const PROBLEMAS = [
  { id: 'pragas_insetos', nome: 'Pragas (Insetos)', descricao: 'Pulgoes, cochonilhas, lagartas, acaros', icon: '\uD83D\uDC1B', categoria: 'biologico' },
  { id: 'fungos', nome: 'Fungos / Doencas', descricao: 'Oidio, ferrugem, manchas foliares', icon: '\uD83C\uDF44', categoria: 'biologico' },
  { id: 'deficiencia_n', nome: 'Deficiencia de Nitrogenio', descricao: 'Folhas amareladas, crescimento lento', icon: '\uD83C\uDF43', categoria: 'nutricional' },
  { id: 'deficiencia_p', nome: 'Deficiencia de Fosforo', descricao: 'Folhas arroxeadas, raiz fraca', icon: '\uD83C\uDF42', categoria: 'nutricional' },
  { id: 'deficiencia_k', nome: 'Deficiencia de Potassio', descricao: 'Bordas das folhas queimadas', icon: '\uD83C\uDF41', categoria: 'nutricional' },
  { id: 'solo_acido', nome: 'Solo Acido', descricao: 'pH baixo, toxidez por aluminio', icon: '\u26A0\uFE0F', categoria: 'solo' },
  { id: 'compactacao', nome: 'Solo Compactado', descricao: 'Dificuldade de drenagem e raizes', icon: '\uD83E\uDDF1', categoria: 'solo' },
  { id: 'excesso_agua', nome: 'Excesso de Agua', descricao: 'Encharcamento, raizes apodrecendo', icon: '\uD83D\uDCA7', categoria: 'manejo' },
  { id: 'seca', nome: 'Estresse Hidrico (Seca)', descricao: 'Murcha, folhas enrolando', icon: '\u2600\uFE0F', categoria: 'manejo' },
  { id: 'nenhum', nome: 'Nenhum Problema', descricao: 'Planta saudavel, apenas busca otimizacao', icon: '\u2705', categoria: 'nenhum' },
]

// ========================
// TYPES
// ========================
interface PlantInfo {
  id: string
  nome: string
  nomeCientifico: string
  categoria: string
  icon: string
  phIdeal: string
  tempIdeal: string
  ciclo: string
  nutrientes: { N: string; P: string; K: string }
  descricao: string
}

interface Resultado {
  planta: PlantInfo
  regiao: typeof REGIOES[0]
  solo: typeof TIPOS_SOLO[0]
  producao: typeof TIPOS_PRODUCAO[0]
  problemas: typeof PROBLEMAS[0][]
  adubos: AduboRecomendado[]
  tubete: TubeteRecomendado
  correcoesSolo: string[]
  manejo: string[]
}

interface AduboRecomendado {
  nome: string
  tipo: string
  npk: string
  aplicacao: string
  dosagem: string
  frequencia: string
  icon: string
}

interface TubeteRecomendado {
  tamanho: string
  volume: string
  substrato: string
  aduboBase: string
  tempoMuda: string
  instrucoes: string[]
}

// ========================
// RECOMMENDATION ENGINE
// ========================
function gerarRecomendacao(
  planta: PlantInfo,
  regiao: typeof REGIOES[0],
  solo: typeof TIPOS_SOLO[0],
  producao: typeof TIPOS_PRODUCAO[0],
  problemasSelecionados: typeof PROBLEMAS[0][]
): Resultado {
  const adubos: AduboRecomendado[] = []

  // Base fertilizer based on plant needs
  if (planta.nutrientes.N === 'alto' || planta.nutrientes.N === 'muito alto') {
    adubos.push({
      nome: 'Ureia',
      tipo: 'Mineral - Nitrogenado',
      npk: '45-00-00',
      aplicacao: 'Cobertura parcelada',
      dosagem: producao.id === 'vaso' ? '1-2g por litro de agua' : producao.id === 'larga' ? '150-200 kg/ha' : '50-100 g/m2',
      frequencia: 'A cada 30-45 dias',
      icon: '\uD83E\uDDEA',
    })
  }

  if (planta.nutrientes.P === 'alto') {
    adubos.push({
      nome: 'Superfosfato Simples',
      tipo: 'Mineral - Fosfatado',
      npk: '00-18-00 (+20% Ca, 12% S)',
      aplicacao: 'Plantio (misturado ao solo)',
      dosagem: producao.id === 'vaso' ? '5g por vaso' : producao.id === 'larga' ? '300-500 kg/ha' : '100-150 g/m2',
      frequencia: 'No plantio',
      icon: '\uD83E\uDDEA',
    })
  }

  if (planta.nutrientes.K === 'alto' || planta.nutrientes.K === 'muito alto') {
    adubos.push({
      nome: 'Cloreto de Potassio (KCl)',
      tipo: 'Mineral - Potassico',
      npk: '00-00-60',
      aplicacao: 'Cobertura',
      dosagem: producao.id === 'vaso' ? '1g por litro de agua' : producao.id === 'larga' ? '100-200 kg/ha' : '30-60 g/m2',
      frequencia: 'A cada 45-60 dias',
      icon: '\uD83E\uDDEA',
    })
  }

  // NPK formula based on plant type
  if (planta.categoria === 'Hortalica') {
    adubos.push({
      nome: 'NPK 10-10-10',
      tipo: 'Mineral - Formulado',
      npk: '10-10-10',
      aplicacao: 'Plantio e cobertura',
      dosagem: producao.id === 'vaso' ? '3-5g por vaso' : '100-200 g/m2',
      frequencia: 'A cada 20-30 dias',
      icon: '\uD83C\uDF3F',
    })
  } else if (planta.categoria === 'Fruta') {
    adubos.push({
      nome: 'NPK 04-14-08',
      tipo: 'Mineral - Formulado',
      npk: '04-14-08',
      aplicacao: 'Cova de plantio e cobertura',
      dosagem: producao.id === 'vaso' ? '5-10g por vaso' : '200-400 g/planta',
      frequencia: 'A cada 60-90 dias',
      icon: '\uD83C\uDF3F',
    })
  } else if (planta.categoria === 'Ornamental') {
    adubos.push({
      nome: 'NPK 10-10-10 (diluido)',
      tipo: 'Mineral - Formulado',
      npk: '10-10-10',
      aplicacao: 'Fertirrigacao diluida',
      dosagem: '2g por litro de agua',
      frequencia: 'A cada 15-20 dias na primavera/verao',
      icon: '\uD83C\uDF3F',
    })
  } else if (planta.categoria === 'Florestal') {
    adubos.push({
      nome: 'NPK 06-30-06',
      tipo: 'Mineral - Formulado',
      npk: '06-30-06',
      aplicacao: 'Cova de plantio',
      dosagem: '100-150 g/cova',
      frequencia: 'No plantio + cobertura aos 90 dias',
      icon: '\uD83C\uDF3F',
    })
  } else {
    adubos.push({
      nome: 'NPK 20-05-20',
      tipo: 'Mineral - Formulado',
      npk: '20-05-20',
      aplicacao: 'Cobertura',
      dosagem: producao.id === 'larga' ? '200-400 kg/ha' : '100-150 g/m2',
      frequencia: 'Parcelado conforme ciclo',
      icon: '\uD83C\uDF3F',
    })
  }

  // Organic option
  adubos.push({
    nome: 'Composto Organico / Humus',
    tipo: 'Organico',
    npk: 'Variavel (~2-1-1)',
    aplicacao: 'Misturado ao solo antes do plantio',
    dosagem: producao.id === 'vaso' ? '30% do volume do substrato' : producao.id === 'larga' ? '10-20 ton/ha' : '3-5 kg/m2',
    frequencia: 'A cada novo plantio',
    icon: '\uD83E\uDEB1',
  })

  // Problem-specific additions
  const problemaIds = problemasSelecionados.map(p => p.id)

  if (problemaIds.includes('deficiencia_n')) {
    adubos.push({
      nome: 'Sulfato de Amonio',
      tipo: 'Corretivo - Nitrogenado',
      npk: '21-00-00 (+24% S)',
      aplicacao: 'Cobertura de emergencia',
      dosagem: producao.id === 'vaso' ? '1g/L agua' : '30-50 g/m2',
      frequencia: 'Aplicacao imediata + repetir em 15 dias',
      icon: '\uD83D\uDCA1',
    })
  }

  if (problemaIds.includes('deficiencia_p')) {
    adubos.push({
      nome: 'Fosfato Natural Reativo',
      tipo: 'Corretivo - Fosfatado',
      npk: '00-28-00',
      aplicacao: 'Incorporado ao solo',
      dosagem: producao.id === 'larga' ? '500-1000 kg/ha' : '150-200 g/m2',
      frequencia: 'Aplicacao unica corretiva',
      icon: '\uD83D\uDCA1',
    })
  }

  if (problemaIds.includes('deficiencia_k')) {
    adubos.push({
      nome: 'Sulfato de Potassio',
      tipo: 'Corretivo - Potassico',
      npk: '00-00-50 (+18% S)',
      aplicacao: 'Cobertura',
      dosagem: producao.id === 'vaso' ? '2g/L agua' : '40-80 g/m2',
      frequencia: 'A cada 30 dias ate corrigir',
      icon: '\uD83D\uDCA1',
    })
  }

  // Soil corrections
  const correcoesSolo: string[] = []

  if (solo.id === 'arenoso') {
    correcoesSolo.push('Incorporar materia organica (composto, humus) para melhorar retencao de agua e nutrientes')
    correcoesSolo.push('Aplicar cobertura morta (mulching) para reduzir evaporacao')
    correcoesSolo.push('Parcelar mais a adubacao para evitar lixiviacao')
  }
  if (solo.id === 'argiloso') {
    correcoesSolo.push('Adicionar areia grossa e materia organica para melhorar drenagem')
    correcoesSolo.push('Evitar trafego excessivo sobre o solo para prevenir compactacao')
    correcoesSolo.push('Usar gesso agricola para melhorar estrutura em profundidade')
  }
  if (solo.id === 'latossolo' || problemaIds.includes('solo_acido')) {
    correcoesSolo.push('Realizar calagem com calcario dolomitico (PRNT > 80%) - 2 a 4 ton/ha')
    correcoesSolo.push('Aplicar fosfatagem corretiva antes do plantio')
    correcoesSolo.push('Monitorar saturacao por bases (V%) - alvo 60-70% para maioria das culturas')
  }
  if (problemaIds.includes('compactacao')) {
    correcoesSolo.push('Realizar subsolagem ou escarificacao mecanica')
    correcoesSolo.push('Plantar adubos verdes (crotalaria, nabo forrageiro) para descompactar biologicamente')
  }
  if (problemaIds.includes('excesso_agua')) {
    correcoesSolo.push('Melhorar sistema de drenagem - construir canais ou usar vasos com furos')
    correcoesSolo.push('Elevar canteiros para facilitar escoamento')
  }

  if (correcoesSolo.length === 0) {
    correcoesSolo.push('Solo adequado para a cultura. Manter adubacao de manutencao regular.')
  }

  // Management tips
  const manejo: string[] = []

  if (problemaIds.includes('pragas_insetos')) {
    manejo.push('Aplicar oleo de Neem como inseticida natural preventivo')
    manejo.push('Promover presenca de inimigos naturais (joaninhas, crisopideos)')
    manejo.push('Inspecionar plantas regularmente para deteccao precoce')
  }
  if (problemaIds.includes('fungos')) {
    manejo.push('Aplicar calda bordalesa (sulfato de cobre + cal) como fungicida preventivo')
    manejo.push('Melhorar circulacao de ar entre plantas (espacamento adequado)')
    manejo.push('Evitar molhar as folhas durante irrigacao - preferir gotejamento')
  }
  if (problemaIds.includes('seca')) {
    manejo.push('Implementar irrigacao por gotejamento para eficiencia hidrica')
    manejo.push('Aplicar cobertura morta (palha, casca) para reter umidade')
    manejo.push('Irrigar nas primeiras horas da manha ou final da tarde')
  }

  if (manejo.length === 0) {
    manejo.push('Manter irrigacao regular conforme necessidade da cultura')
    manejo.push('Monitorar pragas e doencas preventivamente')
    manejo.push('Realizar analise de solo periodicamente')
  }

  // Tubete recommendation
  let tubeteTamanho = '120 cm3'
  let tubeteVolume = '120 ml'
  let tubeteSubstrato = 'Substrato comercial + vermiculita (70/30)'
  let tubeteAdubo = `NPK de liberacao lenta 14-14-14 (Osmocote ou similar) - 3g por tubete`
  let tubeteTempoMuda = '30-45 dias'

  if (planta.categoria === 'Florestal') {
    tubeteTamanho = '180 cm3'
    tubeteVolume = '180 ml'
    tubeteAdubo = 'NPK 06-30-06 liberacao lenta - 4g por tubete + fosfato natural na base'
    tubeteTempoMuda = '90-120 dias'
  } else if (planta.categoria === 'Fruta' || planta.categoria === 'Perene') {
    tubeteTamanho = '280 cm3'
    tubeteVolume = '280 ml'
    tubeteSubstrato = 'Substrato comercial + casca de pinus + vermiculita (50/30/20)'
    tubeteAdubo = 'NPK 15-09-12 liberacao controlada - 5g por tubete'
    tubeteTempoMuda = '60-90 dias'
  } else if (planta.categoria === 'Ornamental') {
    tubeteTamanho = '55 cm3'
    tubeteVolume = '55 ml'
    tubeteSubstrato = 'Substrato leve + perlita (80/20)'
    tubeteAdubo = 'NPK 10-10-10 liberacao lenta - 2g por tubete'
    tubeteTempoMuda = '30-60 dias'
  } else if (planta.categoria === 'Hortalica') {
    tubeteTamanho = '50 cm3'
    tubeteVolume = '50 ml'
    tubeteSubstrato = 'Substrato organico + vermiculita (70/30)'
    tubeteAdubo = 'NPK 10-10-10 liberacao lenta - 1.5g por tubete + humus de minhoca'
    tubeteTempoMuda = '15-25 dias'
  }

  const tubete: TubeteRecomendado = {
    tamanho: tubeteTamanho,
    volume: tubeteVolume,
    substrato: tubeteSubstrato,
    aduboBase: tubeteAdubo,
    tempoMuda: tubeteTempoMuda,
    instrucoes: [
      `Usar tubete de polpa moldada tamanho ${tubeteTamanho}`,
      `Preencher com: ${tubeteSubstrato}`,
      `Adicionar adubo: ${tubeteAdubo}`,
      'Semear ou transplantar a muda no centro do tubete',
      `Manter em viveiro/estufa por ${tubeteTempoMuda} antes do transplante para o terreno`,
      'Irrigar diariamente mantendo o substrato umido (nao encharcado)',
      'O tubete de polpa moldada se degrada naturalmente no solo apos o transplante',
      'Transplantar quando a muda apresentar 3-4 folhas verdadeiras (hortalicas) ou 20-30 cm de altura (arboreas)',
    ],
  }

  return {
    planta,
    regiao,
    solo,
    producao,
    problemas: problemasSelecionados,
    adubos,
    tubete,
    correcoesSolo,
    manejo,
  }
}

// ========================
// MAIN COMPONENT
// ========================
export default function PlantasPage() {
  const [step, setStep] = useState(0)
  const [plantaSelecionada, setPlantaSelecionada] = useState<PlantInfo | null>(null)
  const [regiaoSelecionada, setRegiaoSelecionada] = useState<typeof REGIOES[0] | null>(null)
  const [soloSelecionado, setSoloSelecionado] = useState<typeof TIPOS_SOLO[0] | null>(null)
  const [producaoSelecionada, setProducaoSelecionada] = useState<typeof TIPOS_PRODUCAO[0] | null>(null)
  const [problemasSelecionados, setProblemasSelecionados] = useState<typeof PROBLEMAS[0][]>([])
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [busca, setBusca] = useState('')
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [identificando, setIdentificando] = useState(false)
  const [geolocalizando, setGeolocalizando] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [darkMode, setDarkMode] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('fengshui-dark')
    if (saved === 'true') setDarkMode(true)
  }, [])

  const t = {
    bg: darkMode ? '#0f172a' : '#F9FAFB',
    card: darkMode ? '#1e293b' : '#ffffff',
    text: darkMode ? '#e2e8f0' : '#111827',
    textSoft: darkMode ? '#94a3b8' : '#6B7280',
    border: darkMode ? '#334155' : '#E5E7EB',
    accent: '#16a34a',
    accentLight: darkMode ? 'rgba(22, 163, 74, 0.15)' : 'rgba(22, 163, 74, 0.08)',
    accentBorder: darkMode ? 'rgba(22, 163, 74, 0.4)' : 'rgba(22, 163, 74, 0.25)',
  }

  const STEPS = [
    'Identificar Planta',
    'Regiao',
    'Tipo de Solo',
    'Tipo de Producao',
    'Problemas',
    'Resultado',
  ]

  function handleFotoCaptura(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => {
      setFotoPreview(reader.result as string)
      setIdentificando(true)
      // Simulate AI identification
      setTimeout(() => {
        setIdentificando(false)
      }, 2000)
    }
    reader.readAsDataURL(file)
  }

  function handleGeolocalizar() {
    setGeolocalizando(true)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude
          // Simple region detection based on latitude
          let regiao
          if (lat < -5) {
            if (lat > -15) regiao = REGIOES.find(r => r.id === 'nordeste')
            else if (lat > -20) regiao = REGIOES.find(r => r.id === 'centro-oeste')
            else if (lat > -24) regiao = REGIOES.find(r => r.id === 'sudeste')
            else regiao = REGIOES.find(r => r.id === 'sul')
          } else {
            regiao = REGIOES.find(r => r.id === 'norte')
          }
          if (regiao) setRegiaoSelecionada(regiao)
          setGeolocalizando(false)
        },
        () => {
          setGeolocalizando(false)
          alert('Nao foi possivel obter sua localizacao. Selecione manualmente.')
        }
      )
    } else {
      setGeolocalizando(false)
      alert('Geolocalizacao nao suportada neste navegador.')
    }
  }

  function toggleProblema(problema: typeof PROBLEMAS[0]) {
    if (problema.id === 'nenhum') {
      setProblemasSelecionados([problema])
      return
    }
    setProblemasSelecionados(prev => {
      const filtered = prev.filter(p => p.id !== 'nenhum')
      const exists = filtered.find(p => p.id === problema.id)
      if (exists) return filtered.filter(p => p.id !== problema.id)
      return [...filtered, problema]
    })
  }

  function gerarResultado() {
    if (!plantaSelecionada || !regiaoSelecionada || !soloSelecionado || !producaoSelecionada) return
    const probs = problemasSelecionados.length === 0 ? [PROBLEMAS[PROBLEMAS.length - 1]] : problemasSelecionados
    const res = gerarRecomendacao(plantaSelecionada, regiaoSelecionada, soloSelecionado, producaoSelecionada, probs)
    setResultado(res)
    setStep(5)
  }

  function resetar() {
    setStep(0)
    setPlantaSelecionada(null)
    setRegiaoSelecionada(null)
    setSoloSelecionado(null)
    setProducaoSelecionada(null)
    setProblemasSelecionados([])
    setResultado(null)
    setFotoPreview(null)
    setBusca('')
  }

  const canAdvance = () => {
    switch (step) {
      case 0: return !!plantaSelecionada
      case 1: return !!regiaoSelecionada
      case 2: return !!soloSelecionado
      case 3: return !!producaoSelecionada
      case 4: return true
      default: return false
    }
  }

  function handleNext() {
    if (step === 4) {
      gerarResultado()
    } else if (canAdvance()) {
      setStep(step + 1)
    }
  }

  const plantasFiltradas = PLANT_DATABASE.filter(p =>
    p.nome.toLowerCase().includes(busca.toLowerCase()) ||
    p.categoria.toLowerCase().includes(busca.toLowerCase()) ||
    p.nomeCientifico.toLowerCase().includes(busca.toLowerCase())
  )

  // ========================
  // STYLES
  // ========================
  const cardStyle: React.CSSProperties = {
    background: t.card,
    borderRadius: '16px',
    padding: '24px',
    border: `1px solid ${t.border}`,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  }

  const btnPrimary: React.CSSProperties = {
    background: 'linear-gradient(135deg, #16a34a, #15803d)',
    color: '#fff',
    border: 'none',
    padding: '14px 36px',
    borderRadius: '12px',
    fontSize: '15px',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'Arial, sans-serif',
    transition: 'all 0.2s ease',
  }

  const btnSecondary: React.CSSProperties = {
    background: 'transparent',
    color: t.textSoft,
    border: `1px solid ${t.border}`,
    padding: '14px 36px',
    borderRadius: '12px',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'Arial, sans-serif',
    transition: 'all 0.2s ease',
  }

  const selectableCard = (selected: boolean): React.CSSProperties => ({
    background: selected ? t.accentLight : t.card,
    borderRadius: '14px',
    padding: '18px',
    border: `2px solid ${selected ? '#16a34a' : t.border}`,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    position: 'relative',
  })

  return (
    <AppShell currentPage="plantas">
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <span style={{ fontSize: '32px' }}>{'\uD83C\uDF31'}</span>
            <h1 style={{ color: t.text, fontSize: '28px', fontWeight: 800, margin: 0 }}>AgroAdubo</h1>
          </div>
          <p style={{ color: t.textSoft, fontSize: '15px', margin: 0 }}>
            Avaliacao inteligente de plantas e recomendacao de adubos e tubetes de polpa moldada
          </p>
        </div>

        {/* Progress Steps */}
        {step < 5 && (
          <div style={{ ...cardStyle, marginBottom: '24px', padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {STEPS.slice(0, 5).map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    background: i === step ? '#16a34a' : i < step ? '#86efac' : (darkMode ? '#334155' : '#f1f5f9'),
                    color: i === step ? '#fff' : i < step ? '#15803d' : t.textSoft,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '13px', fontWeight: 700, transition: 'all 0.3s ease',
                    flexShrink: 0,
                  }}>
                    {i < step ? '\u2713' : i + 1}
                  </div>
                  <span style={{
                    color: i === step ? t.text : t.textSoft,
                    fontSize: '13px', fontWeight: i === step ? 700 : 400,
                    display: 'none',
                  }} className="step-label">{s}</span>
                  {i < 4 && (
                    <div style={{
                      width: '24px', height: '2px',
                      background: i < step ? '#86efac' : (darkMode ? '#334155' : '#e5e7eb'),
                      borderRadius: '1px',
                    }} />
                  )}
                </div>
              ))}
              <span style={{ color: t.text, fontSize: '14px', fontWeight: 600, marginLeft: '12px' }}>
                {STEPS[step]}
              </span>
            </div>
          </div>
        )}

        {/* ======================== STEP 0: Plant Identification ======================== */}
        {step === 0 && (
          <div style={cardStyle}>
            <h2 style={{ color: t.text, fontSize: '20px', fontWeight: 700, marginBottom: '6px' }}>
              {'\uD83D\uDCF7'} Identificar Planta
            </h2>
            <p style={{ color: t.textSoft, fontSize: '14px', marginBottom: '24px' }}>
              Tire uma foto da planta ou selecione na lista abaixo
            </p>

            {/* Photo Capture */}
            <div style={{
              border: `2px dashed ${t.border}`,
              borderRadius: '14px',
              padding: '32px',
              textAlign: 'center',
              marginBottom: '24px',
              background: darkMode ? 'rgba(255,255,255,0.02)' : '#fafafa',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFotoCaptura}
                style={{ display: 'none' }}
              />
              {fotoPreview ? (
                <div>
                  <img
                    src={fotoPreview}
                    alt="Foto da planta"
                    style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: '12px', marginBottom: '12px', objectFit: 'cover' }}
                  />
                  {identificando ? (
                    <p style={{ color: '#16a34a', fontWeight: 600, fontSize: '14px' }}>
                      {'\uD83D\uDD0D'} Analisando imagem...
                    </p>
                  ) : (
                    <p style={{ color: t.textSoft, fontSize: '14px' }}>
                      Foto capturada! Selecione a planta identificada abaixo ou tire outra foto.
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>{'\uD83D\uDCF1'}</div>
                  <p style={{ color: t.text, fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>
                    Toque para tirar uma foto
                  </p>
                  <p style={{ color: t.textSoft, fontSize: '13px' }}>
                    ou use a galeria do seu dispositivo
                  </p>
                </div>
              )}
            </div>

            {/* Search */}
            <div style={{ position: 'relative', marginBottom: '20px' }}>
              <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px' }}>{'\uD83D\uDD0D'}</span>
              <input
                type="text"
                placeholder="Buscar planta pelo nome, categoria..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
                style={{
                  width: '100%',
                  padding: '14px 14px 14px 42px',
                  borderRadius: '12px',
                  border: `1px solid ${t.border}`,
                  background: darkMode ? '#0f172a' : '#fff',
                  color: t.text,
                  fontSize: '15px',
                  fontFamily: 'Arial, sans-serif',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Plant Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '12px' }}>
              {plantasFiltradas.map(planta => (
                <div
                  key={planta.id}
                  onClick={() => setPlantaSelecionada(planta)}
                  style={selectableCard(plantaSelecionada?.id === planta.id)}
                >
                  {plantaSelecionada?.id === planta.id && (
                    <div style={{ position: 'absolute', top: '8px', right: '8px', width: '22px', height: '22px', borderRadius: '50%', background: '#16a34a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700 }}>{'\u2713'}</div>
                  )}
                  <div style={{ fontSize: '36px', marginBottom: '8px' }}>{planta.icon}</div>
                  <p style={{ color: t.text, fontSize: '15px', fontWeight: 700, margin: '0 0 2px 0' }}>{planta.nome}</p>
                  <p style={{ color: t.textSoft, fontSize: '11px', margin: '0 0 4px 0', fontStyle: 'italic' }}>{planta.nomeCientifico}</p>
                  <span style={{
                    display: 'inline-block',
                    background: darkMode ? 'rgba(134,239,172,0.15)' : '#f0fdf4',
                    color: '#16a34a',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 600,
                  }}>{planta.categoria}</span>
                </div>
              ))}
            </div>

            {plantaSelecionada && (
              <div style={{
                marginTop: '20px',
                padding: '16px',
                borderRadius: '12px',
                background: darkMode ? 'rgba(22, 163, 74, 0.1)' : '#f0fdf4',
                border: '1px solid rgba(22, 163, 74, 0.2)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '24px' }}>{plantaSelecionada.icon}</span>
                  <div>
                    <p style={{ color: t.text, fontWeight: 700, fontSize: '16px', margin: 0 }}>{plantaSelecionada.nome}</p>
                    <p style={{ color: t.textSoft, fontSize: '12px', margin: 0 }}>{plantaSelecionada.nomeCientifico}</p>
                  </div>
                </div>
                <p style={{ color: t.textSoft, fontSize: '13px', lineHeight: 1.6, margin: '0 0 8px 0' }}>{plantaSelecionada.descricao}</p>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  <span style={{ color: t.textSoft, fontSize: '12px' }}>pH: <strong style={{ color: t.text }}>{plantaSelecionada.phIdeal}</strong></span>
                  <span style={{ color: t.textSoft, fontSize: '12px' }}>Temp: <strong style={{ color: t.text }}>{plantaSelecionada.tempIdeal}</strong></span>
                  <span style={{ color: t.textSoft, fontSize: '12px' }}>Ciclo: <strong style={{ color: t.text }}>{plantaSelecionada.ciclo}</strong></span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================== STEP 1: Region ======================== */}
        {step === 1 && (
          <div style={cardStyle}>
            <h2 style={{ color: t.text, fontSize: '20px', fontWeight: 700, marginBottom: '6px' }}>
              {'\uD83D\uDCCD'} Regiao / Localizacao
            </h2>
            <p style={{ color: t.textSoft, fontSize: '14px', marginBottom: '24px' }}>
              Informe sua regiao para sugestoes de solo e clima adequadas
            </p>

            <button
              onClick={handleGeolocalizar}
              disabled={geolocalizando}
              style={{
                ...btnPrimary,
                width: '100%',
                marginBottom: '20px',
                opacity: geolocalizando ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <span>{geolocalizando ? '\u23F3' : '\uD83D\uDCCD'}</span>
              {geolocalizando ? 'Detectando localizacao...' : 'Usar minha localizacao automaticamente'}
            </button>

            <div style={{ textAlign: 'center', color: t.textSoft, fontSize: '13px', marginBottom: '20px' }}>ou selecione manualmente</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {REGIOES.map(regiao => (
                <div
                  key={regiao.id}
                  onClick={() => setRegiaoSelecionada(regiao)}
                  style={selectableCard(regiaoSelecionada?.id === regiao.id)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ color: t.text, fontSize: '16px', fontWeight: 700, margin: '0 0 4px 0' }}>{regiao.nome}</p>
                      <p style={{ color: t.textSoft, fontSize: '13px', margin: '0 0 4px 0' }}>{regiao.estados}</p>
                      <p style={{ color: t.textSoft, fontSize: '12px', margin: '0 0 4px 0' }}>Clima: <strong style={{ color: t.text }}>{regiao.clima}</strong></p>
                      <p style={{ color: t.textSoft, fontSize: '12px', margin: 0 }}>Solo tipico: <strong style={{ color: t.text }}>{regiao.soloTipico}</strong></p>
                    </div>
                    {regiaoSelecionada?.id === regiao.id && (
                      <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#16a34a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, flexShrink: 0 }}>{'\u2713'}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {regiaoSelecionada && (
              <div style={{
                marginTop: '16px', padding: '14px', borderRadius: '10px',
                background: darkMode ? 'rgba(22, 163, 74, 0.1)' : '#f0fdf4',
                border: '1px solid rgba(22, 163, 74, 0.2)',
              }}>
                <p style={{ color: t.textSoft, fontSize: '13px', margin: 0, lineHeight: 1.6 }}>
                  {'\u2139\uFE0F'} <strong style={{ color: t.text }}>{regiaoSelecionada.nome}:</strong> {regiaoSelecionada.caracteristicas}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ======================== STEP 2: Soil Type ======================== */}
        {step === 2 && (
          <div style={cardStyle}>
            <h2 style={{ color: t.text, fontSize: '20px', fontWeight: 700, marginBottom: '6px' }}>
              {'\uD83E\uDEA8'} Tipo de Solo
            </h2>
            <p style={{ color: t.textSoft, fontSize: '14px', marginBottom: '8px' }}>
              Selecione o tipo de solo predominante na sua area
            </p>
            {regiaoSelecionada && (
              <p style={{
                color: '#16a34a', fontSize: '13px', marginBottom: '24px',
                background: darkMode ? 'rgba(22, 163, 74, 0.1)' : '#f0fdf4',
                padding: '10px 14px', borderRadius: '8px',
                border: '1px solid rgba(22, 163, 74, 0.15)',
              }}>
                {'\uD83D\uDCA1'} Solo tipico da regiao <strong>{regiaoSelecionada.nome}</strong>: {regiaoSelecionada.soloTipico}
              </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {TIPOS_SOLO.map(solo => (
                <div
                  key={solo.id}
                  onClick={() => setSoloSelecionado(solo)}
                  style={selectableCard(soloSelecionado?.id === solo.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <span style={{ fontSize: '28px', flexShrink: 0 }}>{solo.icon}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ color: t.text, fontSize: '16px', fontWeight: 700, margin: '0 0 4px 0' }}>{solo.nome}</p>
                      <p style={{ color: t.textSoft, fontSize: '13px', margin: '0 0 4px 0' }}>{solo.descricao}</p>
                      <p style={{ color: t.textSoft, fontSize: '12px', margin: 0 }}>
                        Correcao: <span style={{ color: '#d97706' }}>{solo.correcao}</span>
                      </p>
                    </div>
                    {soloSelecionado?.id === solo.id && (
                      <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#16a34a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, flexShrink: 0 }}>{'\u2713'}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ======================== STEP 3: Production Type ======================== */}
        {step === 3 && (
          <div style={cardStyle}>
            <h2 style={{ color: t.text, fontSize: '20px', fontWeight: 700, marginBottom: '6px' }}>
              {'\uD83C\uDFE1'} Tipo de Producao
            </h2>
            <p style={{ color: t.textSoft, fontSize: '14px', marginBottom: '24px' }}>
              Informe o tipo e escala da sua producao
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
              {TIPOS_PRODUCAO.map(prod => (
                <div
                  key={prod.id}
                  onClick={() => setProducaoSelecionada(prod)}
                  style={selectableCard(producaoSelecionada?.id === prod.id)}
                >
                  {producaoSelecionada?.id === prod.id && (
                    <div style={{ position: 'absolute', top: '8px', right: '8px', width: '22px', height: '22px', borderRadius: '50%', background: '#16a34a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700 }}>{'\u2713'}</div>
                  )}
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>{prod.icon}</div>
                  <p style={{ color: t.text, fontSize: '15px', fontWeight: 700, margin: '0 0 4px 0' }}>{prod.nome}</p>
                  <p style={{ color: t.textSoft, fontSize: '12px', margin: '0 0 6px 0' }}>{prod.descricao}</p>
                  <span style={{
                    display: 'inline-block',
                    background: darkMode ? 'rgba(59,130,246,0.15)' : '#eff6ff',
                    color: '#3b82f6',
                    padding: '2px 8px', borderRadius: '6px',
                    fontSize: '11px', fontWeight: 600,
                  }}>Escala: {prod.escala}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ======================== STEP 4: Problems ======================== */}
        {step === 4 && (
          <div style={cardStyle}>
            <h2 style={{ color: t.text, fontSize: '20px', fontWeight: 700, marginBottom: '6px' }}>
              {'\u26A0\uFE0F'} Problemas Identificados
            </h2>
            <p style={{ color: t.textSoft, fontSize: '14px', marginBottom: '24px' }}>
              Selecione os problemas que voce observa na planta ou no solo (pode selecionar varios)
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
              {PROBLEMAS.map(prob => {
                const selected = problemasSelecionados.some(p => p.id === prob.id)
                return (
                  <div
                    key={prob.id}
                    onClick={() => toggleProblema(prob)}
                    style={selectableCard(selected)}
                  >
                    {selected && (
                      <div style={{ position: 'absolute', top: '8px', right: '8px', width: '22px', height: '22px', borderRadius: '50%', background: '#16a34a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700 }}>{'\u2713'}</div>
                    )}
                    <div style={{ fontSize: '28px', marginBottom: '8px' }}>{prob.icon}</div>
                    <p style={{ color: t.text, fontSize: '14px', fontWeight: 700, margin: '0 0 4px 0' }}>{prob.nome}</p>
                    <p style={{ color: t.textSoft, fontSize: '12px', margin: 0 }}>{prob.descricao}</p>
                  </div>
                )
              })}
            </div>

            {problemasSelecionados.length > 0 && problemasSelecionados[0].id !== 'nenhum' && (
              <div style={{
                marginTop: '16px', padding: '14px', borderRadius: '10px',
                background: darkMode ? 'rgba(234, 179, 8, 0.1)' : '#fefce8',
                border: '1px solid rgba(234, 179, 8, 0.2)',
              }}>
                <p style={{ color: '#a16207', fontSize: '13px', margin: 0, fontWeight: 600 }}>
                  {problemasSelecionados.length} problema(s) selecionado(s) - recomendacoes corretivas serao incluidas no resultado
                </p>
              </div>
            )}
          </div>
        )}

        {/* ======================== STEP 5: Results ======================== */}
        {step === 5 && resultado && (
          <div>
            {/* Result Header */}
            <div style={{
              ...cardStyle,
              background: 'linear-gradient(135deg, #16a34a, #15803d)',
              border: 'none',
              marginBottom: '20px',
              color: '#fff',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '48px' }}>{resultado.planta.icon}</span>
                <div style={{ flex: 1 }}>
                  <h2 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 4px 0' }}>Recomendacao Completa</h2>
                  <p style={{ fontSize: '16px', opacity: 0.9, margin: '0 0 8px 0' }}>
                    {resultado.planta.nome} ({resultado.planta.nomeCientifico})
                  </p>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <span style={{ background: 'rgba(255,255,255,0.2)', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 }}>
                      {'\uD83D\uDCCD'} {resultado.regiao.nome}
                    </span>
                    <span style={{ background: 'rgba(255,255,255,0.2)', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 }}>
                      {resultado.solo.icon} {resultado.solo.nome}
                    </span>
                    <span style={{ background: 'rgba(255,255,255,0.2)', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 }}>
                      {resultado.producao.icon} {resultado.producao.nome}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Tubete Recommendation - HIGHLIGHT */}
            <div style={{
              ...cardStyle,
              marginBottom: '20px',
              border: '2px solid #16a34a',
              background: darkMode ? 'rgba(22, 163, 74, 0.08)' : '#f0fdf4',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '12px',
                  background: '#16a34a', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '24px',
                }}>{'\uD83C\uDF31'}</div>
                <div>
                  <h3 style={{ color: t.text, fontSize: '18px', fontWeight: 800, margin: 0 }}>Tubete de Polpa Moldada</h3>
                  <p style={{ color: '#16a34a', fontSize: '13px', fontWeight: 600, margin: 0 }}>Recomendacao personalizada para fase inicial</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                {[
                  { label: 'Tamanho', value: resultado.tubete.tamanho },
                  { label: 'Volume', value: resultado.tubete.volume },
                  { label: 'Tempo Muda', value: resultado.tubete.tempoMuda },
                ].map((item, i) => (
                  <div key={i} style={{
                    background: darkMode ? 'rgba(255,255,255,0.05)' : '#fff',
                    borderRadius: '10px', padding: '14px',
                    border: `1px solid ${t.border}`,
                  }}>
                    <p style={{ color: t.textSoft, fontSize: '12px', margin: '0 0 4px 0', fontWeight: 600 }}>{item.label}</p>
                    <p style={{ color: t.text, fontSize: '16px', fontWeight: 700, margin: 0 }}>{item.value}</p>
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: '16px' }}>
                <p style={{ color: t.textSoft, fontSize: '13px', fontWeight: 600, margin: '0 0 6px 0' }}>Substrato:</p>
                <p style={{ color: t.text, fontSize: '14px', margin: 0 }}>{resultado.tubete.substrato}</p>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <p style={{ color: t.textSoft, fontSize: '13px', fontWeight: 600, margin: '0 0 6px 0' }}>Adubo Base do Tubete:</p>
                <p style={{ color: t.text, fontSize: '14px', margin: 0, fontWeight: 600 }}>{resultado.tubete.aduboBase}</p>
              </div>

              <div>
                <p style={{ color: t.textSoft, fontSize: '13px', fontWeight: 600, margin: '0 0 10px 0' }}>Instrucoes de Uso:</p>
                <ol style={{ margin: 0, paddingLeft: '20px' }}>
                  {resultado.tubete.instrucoes.map((inst, i) => (
                    <li key={i} style={{ color: t.text, fontSize: '13px', lineHeight: 1.8, marginBottom: '4px' }}>{inst}</li>
                  ))}
                </ol>
              </div>
            </div>

            {/* Fertilizer Recommendations */}
            <div style={{ ...cardStyle, marginBottom: '20px' }}>
              <h3 style={{ color: t.text, fontSize: '18px', fontWeight: 700, margin: '0 0 16px 0' }}>
                {'\uD83E\uDDEA'} Adubos Recomendados
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {resultado.adubos.map((adubo, i) => (
                  <div key={i} style={{
                    borderRadius: '12px', padding: '16px',
                    border: `1px solid ${t.border}`,
                    background: darkMode ? 'rgba(255,255,255,0.03)' : '#fafafa',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                      <span style={{ fontSize: '20px' }}>{adubo.icon}</span>
                      <div style={{ flex: 1 }}>
                        <p style={{ color: t.text, fontSize: '15px', fontWeight: 700, margin: 0 }}>{adubo.nome}</p>
                        <p style={{ color: t.textSoft, fontSize: '12px', margin: 0 }}>{adubo.tipo}</p>
                      </div>
                      <span style={{
                        background: darkMode ? 'rgba(22, 163, 74, 0.15)' : '#f0fdf4',
                        color: '#16a34a', padding: '4px 12px', borderRadius: '8px',
                        fontSize: '13px', fontWeight: 700,
                      }}>NPK {adubo.npk}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px' }}>
                      <div>
                        <span style={{ color: t.textSoft, fontSize: '11px', fontWeight: 600 }}>Aplicacao</span>
                        <p style={{ color: t.text, fontSize: '13px', margin: '2px 0 0 0' }}>{adubo.aplicacao}</p>
                      </div>
                      <div>
                        <span style={{ color: t.textSoft, fontSize: '11px', fontWeight: 600 }}>Dosagem</span>
                        <p style={{ color: t.text, fontSize: '13px', margin: '2px 0 0 0', fontWeight: 600 }}>{adubo.dosagem}</p>
                      </div>
                      <div>
                        <span style={{ color: t.textSoft, fontSize: '11px', fontWeight: 600 }}>Frequencia</span>
                        <p style={{ color: t.text, fontSize: '13px', margin: '2px 0 0 0' }}>{adubo.frequencia}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Soil Corrections */}
            <div style={{ ...cardStyle, marginBottom: '20px' }}>
              <h3 style={{ color: t.text, fontSize: '18px', fontWeight: 700, margin: '0 0 16px 0' }}>
                {'\uD83E\uDEA8'} Correcoes de Solo
              </h3>
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                {resultado.correcoesSolo.map((correcao, i) => (
                  <li key={i} style={{ color: t.text, fontSize: '14px', lineHeight: 1.8, marginBottom: '6px' }}>
                    {correcao}
                  </li>
                ))}
              </ul>
            </div>

            {/* Management Tips */}
            <div style={{ ...cardStyle, marginBottom: '20px' }}>
              <h3 style={{ color: t.text, fontSize: '18px', fontWeight: 700, margin: '0 0 16px 0' }}>
                {'\uD83C\uDF3F'} Manejo e Cuidados
              </h3>
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                {resultado.manejo.map((tip, i) => (
                  <li key={i} style={{ color: t.text, fontSize: '14px', lineHeight: 1.8, marginBottom: '6px' }}>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>

            {/* Plant Info Summary */}
            <div style={{ ...cardStyle, marginBottom: '20px' }}>
              <h3 style={{ color: t.text, fontSize: '18px', fontWeight: 700, margin: '0 0 16px 0' }}>
                {'\uD83D\uDCCB'} Resumo da Planta
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '14px' }}>
                {[
                  { label: 'pH Ideal', value: resultado.planta.phIdeal },
                  { label: 'Temperatura', value: resultado.planta.tempIdeal },
                  { label: 'Ciclo', value: resultado.planta.ciclo },
                  { label: 'Nitrogenio (N)', value: resultado.planta.nutrientes.N },
                  { label: 'Fosforo (P)', value: resultado.planta.nutrientes.P },
                  { label: 'Potassio (K)', value: resultado.planta.nutrientes.K },
                ].map((item, i) => (
                  <div key={i} style={{
                    background: darkMode ? 'rgba(255,255,255,0.03)' : '#fafafa',
                    borderRadius: '10px', padding: '14px',
                    border: `1px solid ${t.border}`,
                  }}>
                    <p style={{ color: t.textSoft, fontSize: '12px', margin: '0 0 4px 0', fontWeight: 600 }}>{item.label}</p>
                    <p style={{ color: t.text, fontSize: '15px', fontWeight: 700, margin: 0 }}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* New Assessment Button */}
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <button onClick={resetar} style={btnPrimary}>
                {'\uD83D\uDD04'} Nova Avaliacao
              </button>
            </div>
          </div>
        )}

        {/* ======================== NAVIGATION BUTTONS ======================== */}
        {step < 5 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px', gap: '12px' }}>
            <button
              onClick={() => setStep(Math.max(0, step - 1))}
              disabled={step === 0}
              style={{ ...btnSecondary, opacity: step === 0 ? 0.4 : 1 }}
            >
              {'\u2190'} Voltar
            </button>
            <button
              onClick={handleNext}
              disabled={!canAdvance() && step !== 4}
              style={{
                ...btnPrimary,
                opacity: (!canAdvance() && step !== 4) ? 0.5 : 1,
              }}
            >
              {step === 4 ? '\uD83D\uDD0D Gerar Recomendacao' : 'Proximo \u2192'}
            </button>
          </div>
        )}
      </div>

      <style>{`
        @media (min-width: 768px) {
          .step-label { display: inline !important; }
        }
      `}</style>
    </AppShell>
  )
}
