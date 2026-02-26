import { TubeteFormulation } from './types'

// Receitas de Fertilizacao On-Delivery
// Vincula o tubete de polpa Tamoios ao mix de nutrientes Yara impregnado na polpa

export const TUBETE_FORMULATIONS: TubeteFormulation[] = [
  // --- Hortalicas ---
  {
    id: 'receita-hortalica',
    culturaAlvo: 'Hortalicas em geral',
    categoriaPlanta: 'Hortalica',
    biomassaTipo: 'Polpa moldada de fibra de cana - Tamoios',
    nutrientesImpregnados: ['yara-mila-hortifruti'],
    receitaYara: 'YaraMila Hortifruti 12-11-18 impregnado na polpa (1.5g/tubete)',
    liberacaoDias: 30,
    porosidade: 'Alta - aeracao para raizes finas e superficiais',
    tamanhoTubete: '50 cm3',
    volumeTubete: '50 ml',
  },
  // --- Ornamentais ---
  {
    id: 'receita-ornamental',
    culturaAlvo: 'Flores e ornamentais',
    categoriaPlanta: 'Ornamental',
    biomassaTipo: 'Polpa moldada de fibra de cana - Tamoios',
    nutrientesImpregnados: ['yara-mila-acima'],
    receitaYara: 'YaraMila Acima 16-16-16 impregnado na polpa (2g/tubete)',
    liberacaoDias: 45,
    porosidade: 'Alta - substrato leve para raizes delicadas',
    tamanhoTubete: '55 cm3',
    volumeTubete: '55 ml',
  },
  // --- Cafe ---
  {
    id: 'receita-cafe',
    culturaAlvo: 'Cafe (Arabica e Robusta)',
    categoriaPlanta: 'Perene',
    biomassaTipo: 'Polpa moldada de fibra de cana - Tamoios',
    nutrientesImpregnados: ['yara-mila-coffee'],
    receitaYara: 'YaraMila Coffee 20-05-20 impregnado na polpa (5g/tubete)',
    liberacaoDias: 120,
    porosidade: 'Media - equilibrio entre retencao e aeracao',
    tamanhoTubete: '280 cm3',
    volumeTubete: '280 ml',
  },
  // --- Eucalipto / Florestais ---
  {
    id: 'receita-eucalipto',
    culturaAlvo: 'Eucalipto e florestais',
    categoriaPlanta: 'Florestal',
    biomassaTipo: 'Polpa moldada de fibra de cana - Tamoios',
    nutrientesImpregnados: ['yara-basa-graos'],
    receitaYara: 'YaraBasa 04-30-16 impregnado na polpa (4g/tubete)',
    liberacaoDias: 150,
    porosidade: 'Media-alta - raiz pivotante profunda',
    tamanhoTubete: '180 cm3',
    volumeTubete: '180 ml',
  },
  // --- Frutas perenes ---
  {
    id: 'receita-fruta',
    culturaAlvo: 'Frutiferas perenes',
    categoriaPlanta: 'Fruta',
    biomassaTipo: 'Polpa moldada de fibra de cana - Tamoios',
    nutrientesImpregnados: ['yara-mila-hortifruti'],
    receitaYara: 'YaraMila Hortifruti 12-11-18 impregnado na polpa (5g/tubete)',
    liberacaoDias: 90,
    porosidade: 'Media - sistema radicular vigoroso',
    tamanhoTubete: '280 cm3',
    volumeTubete: '280 ml',
  },
  // --- Ervas e medicinais ---
  {
    id: 'receita-erva',
    culturaAlvo: 'Ervas aromaticas e medicinais',
    categoriaPlanta: 'Erva',
    biomassaTipo: 'Polpa moldada de fibra de cana - Tamoios',
    nutrientesImpregnados: ['yara-mila-acima'],
    receitaYara: 'YaraMila Acima 16-16-16 impregnado na polpa (1g/tubete)',
    liberacaoDias: 25,
    porosidade: 'Alta - substrato leve e drenante',
    tamanhoTubete: '40 cm3',
    volumeTubete: '40 ml',
  },
  // --- Graos ---
  {
    id: 'receita-graos',
    culturaAlvo: 'Graos e cereais (mudas iniciais)',
    categoriaPlanta: 'Graos',
    biomassaTipo: 'Polpa moldada de fibra de cana - Tamoios',
    nutrientesImpregnados: ['yara-basa-graos'],
    receitaYara: 'YaraBasa 04-30-16 impregnado na polpa (3g/tubete)',
    liberacaoDias: 30,
    porosidade: 'Media - sustentacao para crescimento rapido',
    tamanhoTubete: '120 cm3',
    volumeTubete: '120 ml',
  },
  // --- Industriais ---
  {
    id: 'receita-industrial',
    culturaAlvo: 'Culturas industriais',
    categoriaPlanta: 'Industrial',
    biomassaTipo: 'Polpa moldada de fibra de cana - Tamoios',
    nutrientesImpregnados: ['yara-basa-nitro'],
    receitaYara: 'YaraBasa 23-00-21 impregnado na polpa (3g/tubete)',
    liberacaoDias: 45,
    porosidade: 'Media - estrutura robusta',
    tamanhoTubete: '120 cm3',
    volumeTubete: '120 ml',
  },
]

// Peso medio de um tubete plastico convencional (gramas) - para calculo ESG
export const PESO_TUBETE_PLASTICO_G = 12

// Peso medio de um tubete Tamoios (gramas) - biodegradavel
export const PESO_TUBETE_TAMOIOS_G = 8

export function getFormulationByCategory(categoria: string): TubeteFormulation | undefined {
  return TUBETE_FORMULATIONS.find(f => f.categoriaPlanta === categoria)
}

export function calcPlasticoEvitado(quantidadeMudas: number): number {
  // kg de plastico evitado ao usar Tamoios em vez de plastico convencional
  return (quantidadeMudas * PESO_TUBETE_PLASTICO_G) / 1000
}

export function calcReducaoCO2(): number {
  // Reducao percentual de CO2 do Tamoios vs plastico (dado da empresa)
  return 53
}
