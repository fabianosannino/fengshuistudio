import { Product } from './types'

// Catalogo de produtos reais - Yara e Tamoios
// Mapeamento SKU para substituir nomes genericos no motor de recomendacao

export const PRODUCTS: Product[] = [
  // === YARA - Fertilizantes de Cobertura ===
  {
    id: 'yara-vera-ureia',
    brand: 'Yara',
    linha: 'YaraVera',
    nome: 'YaraVera Ureia',
    category: 'Fertilizante',
    composicao: { N: 45 },
    embalagens: ['Saco 50kg', 'Big Bag 1000kg'],
    esgScore: -0.12,
    diferencial: 'Produto de baixa volatilidade e alta eficiencia ambiental. Tecnologia de protecao contra perdas por volatilizacao.',
  },
  {
    id: 'yara-vera-amidas',
    brand: 'Yara',
    linha: 'YaraVera',
    nome: 'YaraVera Amidas',
    category: 'Fertilizante',
    composicao: { N: 39, S: 5.5 },
    embalagens: ['Saco 50kg', 'Big Bag 1000kg'],
    esgScore: -0.15,
    diferencial: 'Ureia com enxofre, maior eficiencia nitrogenada e menor impacto ambiental.',
  },

  // === YARA - Formulacoes NPK (Cafe e Hortifruti) ===
  {
    id: 'yara-mila-coffee',
    brand: 'Yara',
    linha: 'YaraMila',
    nome: 'YaraMila Coffee',
    category: 'Fertilizante',
    composicao: { N: 20, P: 5, K: 20, S: 3, B: 0.2, Zn: 0.3 },
    embalagens: ['Saco 25kg', 'Saco 50kg'],
    esgScore: -0.18,
    diferencial: 'Formulacao especifica para cafe com micronutrientes essenciais. Granulado de alta uniformidade.',
  },
  {
    id: 'yara-mila-hortifruti',
    brand: 'Yara',
    linha: 'YaraMila',
    nome: 'YaraMila Hortifruti',
    category: 'Fertilizante',
    composicao: { N: 12, P: 11, K: 18, Ca: 3, Mg: 2 },
    embalagens: ['Saco 25kg', 'Saco 50kg'],
    esgScore: -0.16,
    diferencial: 'Formulacao balanceada para hortalicas e frutiferas. Calcio e magnesio para qualidade dos frutos.',
  },
  {
    id: 'yara-mila-acima',
    brand: 'Yara',
    linha: 'YaraMila',
    nome: 'YaraMila Acima 16-16-16',
    category: 'Fertilizante',
    composicao: { N: 16, P: 16, K: 16 },
    embalagens: ['Saco 25kg', 'Saco 50kg'],
    esgScore: -0.14,
    diferencial: 'Formulacao equilibrada para uso geral. Cada granulo contem todos os nutrientes.',
  },

  // === YARA - Formulacoes NPK (Graos) ===
  {
    id: 'yara-basa-graos',
    brand: 'Yara',
    linha: 'YaraBasa',
    nome: 'YaraBasa 04-30-16',
    category: 'Fertilizante',
    composicao: { N: 4, P: 30, K: 16 },
    embalagens: ['Saco 50kg', 'Big Bag 1000kg'],
    esgScore: -0.20,
    diferencial: 'Alta concentracao de fosforo para arranque de graos. Ideal para plantio direto.',
  },
  {
    id: 'yara-basa-nitro',
    brand: 'Yara',
    linha: 'YaraBasa',
    nome: 'YaraBasa 23-00-21',
    category: 'Fertilizante',
    composicao: { N: 23, K: 21 },
    embalagens: ['Saco 50kg', 'Big Bag 1000kg'],
    esgScore: -0.17,
    diferencial: 'Cobertura NK para graos. Sem fosforo para solos ja corrigidos.',
  },

  // === YARA - Foliares e Bioestimulantes ===
  {
    id: 'yara-vita-bortrac',
    brand: 'Yara',
    linha: 'YaraVita',
    nome: 'YaraVita Bortrac',
    category: 'Fertilizante',
    composicao: { B: 15 },
    embalagens: ['Frasco 1L', 'Galao 5L'],
    esgScore: -0.05,
    diferencial: 'Boro liquido de alta concentracao para correcao de deficiencias em florescimento e frutificacao.',
  },
  {
    id: 'yara-vita-zintrac',
    brand: 'Yara',
    linha: 'YaraVita',
    nome: 'YaraVita Zintrac',
    category: 'Fertilizante',
    composicao: { Zn: 70 },
    embalagens: ['Frasco 1L', 'Galao 5L'],
    esgScore: -0.05,
    diferencial: 'Zinco concentrado para correcao de deficiencias em cereais e hortalicas.',
  },
  {
    id: 'yara-vita-mantrac',
    brand: 'Yara',
    linha: 'YaraVita',
    nome: 'YaraVita MnTrac',
    category: 'Fertilizante',
    composicao: { Mn: 50 },
    embalagens: ['Frasco 1L', 'Galao 5L'],
    esgScore: -0.05,
    diferencial: 'Manganes liquido para correcao foliar em soja e cereais.',
  },
  {
    id: 'yara-amplix-launch',
    brand: 'Yara',
    linha: 'YaraAmplix',
    nome: 'YaraAmplix Launch',
    category: 'Bioestimulante',
    composicao: {},
    embalagens: ['Frasco 1L', 'Galao 5L', 'Galao 20L'],
    esgScore: -0.08,
    diferencial: 'Bioestimulante que melhora a tolerancia ao estresse hidrico e termico. Ativa defesas naturais da planta.',
  },

  // === YARA - Corretivos ===
  {
    id: 'yara-super-simples',
    brand: 'Yara',
    linha: 'YaraBasa',
    nome: 'Superfosfato Simples Yara',
    category: 'Corretivo',
    composicao: { P: 18, Ca: 18, S: 10 },
    embalagens: ['Saco 50kg', 'Big Bag 1000kg'],
    esgScore: -0.10,
    diferencial: 'Fosforo com calcio e enxofre. Dupla funcao: nutricao e correcao.',
  },

  // === TAMOIOS - Tubetes de Polpa Moldada ===
  {
    id: 'tamoios-bio-40',
    brand: 'Tamoios',
    linha: 'Tamoios Bio',
    nome: 'Tubete Bio Tamoios 40 cm3',
    category: 'Tubete',
    composicao: {},
    embalagens: ['Bandeja 176un', 'Pallet'],
    esgScore: -0.53,
    diferencial: 'Polpa moldada biodegradavel com tecnologia de Poda Aerea Natural. Spin-off USP, biomassa brasileira.',
  },
  {
    id: 'tamoios-bio-50',
    brand: 'Tamoios',
    linha: 'Tamoios Bio',
    nome: 'Tubete Bio Tamoios 50 cm3',
    category: 'Tubete',
    composicao: {},
    embalagens: ['Bandeja 176un', 'Pallet'],
    esgScore: -0.53,
    diferencial: 'Polpa moldada biodegradavel com tecnologia de Poda Aerea Natural. Spin-off USP, biomassa brasileira.',
  },
  {
    id: 'tamoios-bio-55',
    brand: 'Tamoios',
    linha: 'Tamoios Bio',
    nome: 'Tubete Bio Tamoios 55 cm3',
    category: 'Tubete',
    composicao: {},
    embalagens: ['Bandeja 176un', 'Pallet'],
    esgScore: -0.53,
    diferencial: 'Polpa moldada biodegradavel com tecnologia de Poda Aerea Natural. Spin-off USP, biomassa brasileira.',
  },
  {
    id: 'tamoios-bio-120',
    brand: 'Tamoios',
    linha: 'Tamoios Bio',
    nome: 'Tubete Bio Tamoios 120 cm3',
    category: 'Tubete',
    composicao: {},
    embalagens: ['Bandeja 96un', 'Pallet'],
    esgScore: -0.53,
    diferencial: 'Polpa moldada biodegradavel com tecnologia de Poda Aerea Natural. Spin-off USP, biomassa brasileira.',
  },
  {
    id: 'tamoios-bio-180',
    brand: 'Tamoios',
    linha: 'Tamoios Bio',
    nome: 'Tubete Bio Tamoios 180 cm3',
    category: 'Tubete',
    composicao: {},
    embalagens: ['Bandeja 54un', 'Pallet'],
    esgScore: -0.53,
    diferencial: 'Polpa moldada biodegradavel com tecnologia de Poda Aerea Natural. Spin-off USP, biomassa brasileira.',
  },
  {
    id: 'tamoios-bio-280',
    brand: 'Tamoios',
    linha: 'Tamoios Bio',
    nome: 'Tubete Bio Tamoios 280 cm3',
    category: 'Tubete',
    composicao: {},
    embalagens: ['Bandeja 40un', 'Pallet'],
    esgScore: -0.53,
    diferencial: 'Polpa moldada biodegradavel com tecnologia de Poda Aerea Natural. Spin-off USP, biomassa brasileira.',
  },

  // === Genericos (fallback) ===
  {
    id: 'gen-cloreto-potassio',
    brand: 'Generico',
    linha: 'KCl',
    nome: 'Cloreto de Potassio (KCl)',
    category: 'Fertilizante',
    composicao: { K: 60 },
    embalagens: ['Saco 50kg', 'Big Bag 1000kg'],
    esgScore: 0,
    diferencial: '',
  },
  {
    id: 'gen-sulfato-amonio',
    brand: 'Generico',
    linha: 'SA',
    nome: 'Sulfato de Amonio',
    category: 'Fertilizante',
    composicao: { N: 21, S: 24 },
    embalagens: ['Saco 50kg'],
    esgScore: 0,
    diferencial: '',
  },
  {
    id: 'gen-fosfato-natural',
    brand: 'Generico',
    linha: 'FNR',
    nome: 'Fosfato Natural Reativo',
    category: 'Corretivo',
    composicao: { P: 28 },
    embalagens: ['Saco 50kg', 'Big Bag 1000kg'],
    esgScore: 0,
    diferencial: '',
  },
  {
    id: 'gen-sulfato-potassio',
    brand: 'Generico',
    linha: 'SOP',
    nome: 'Sulfato de Potassio',
    category: 'Fertilizante',
    composicao: { K: 50, S: 17 },
    embalagens: ['Saco 25kg', 'Saco 50kg'],
    esgScore: 0,
    diferencial: '',
  },
  {
    id: 'gen-calcario',
    brand: 'Generico',
    linha: 'Calcario',
    nome: 'Calcario Dolomitico (PRNT > 80%)',
    category: 'Corretivo',
    composicao: { Ca: 28, Mg: 12 },
    embalagens: ['Saco 50kg', 'Big Bag 1000kg', 'A granel'],
    esgScore: 0,
    diferencial: '',
  },
  {
    id: 'gen-gesso',
    brand: 'Generico',
    linha: 'Gesso',
    nome: 'Gesso Agricola',
    category: 'Corretivo',
    composicao: { Ca: 17, S: 13 },
    embalagens: ['Saco 50kg', 'Big Bag 1000kg', 'A granel'],
    esgScore: 0,
    diferencial: '',
  },
  {
    id: 'gen-composto-organico',
    brand: 'Generico',
    linha: 'Organico',
    nome: 'Composto Organico / Humus de Minhoca',
    category: 'Fertilizante',
    composicao: { N: 2, P: 1, K: 1 },
    embalagens: ['Saco 5kg', 'Saco 25kg', 'A granel'],
    esgScore: -0.30,
    diferencial: '',
  },
]

// Mapeamento: nome generico -> SKU real
// Usado pelo recommendation-engine para substituir nomes genericos
export const SKU_MAP: Record<string, string> = {
  'Ureia': 'yara-vera-ureia',
  'NPK 10-10-10': 'yara-mila-acima',
  'NPK 04-14-08': 'yara-mila-hortifruti',
  'NPK 06-30-06': 'yara-basa-graos',
  'NPK 20-10-20': 'yara-mila-coffee',
  'NPK 14-14-14': 'yara-mila-acima',
  'Superfosfato Simples': 'yara-super-simples',
  'Sulfato de Amonio': 'gen-sulfato-amonio',
  'Fosfato Natural Reativo': 'gen-fosfato-natural',
  'Sulfato de Potassio': 'gen-sulfato-potassio',
  'Cloreto de Potassio': 'gen-cloreto-potassio',
  'Calcario Dolomitico': 'gen-calcario',
  'Gesso Agricola': 'gen-gesso',
  'Composto Organico': 'gen-composto-organico',
}

// Mapeamento: categoria de planta -> produto Yara recomendado
export const CATEGORY_PRODUCT_MAP: Record<string, string> = {
  'Hortalica': 'yara-mila-hortifruti',
  'Fruta': 'yara-mila-hortifruti',
  'Perene': 'yara-mila-coffee',
  'Ornamental': 'yara-mila-acima',
  'Florestal': 'yara-basa-graos',
  'Erva': 'yara-mila-acima',
  'Graos': 'yara-basa-graos',
  'Industrial': 'yara-basa-nitro',
}

// Mapeamento: escala de producao -> embalagens sugeridas
export const PACKAGING_BY_SCALE: Record<string, string[]> = {
  'Micro': ['Saco 5kg', 'Frasco 1L'],
  'Pequena': ['Saco 25kg', 'Frasco 1L', 'Galao 5L'],
  'Media': ['Saco 25kg', 'Saco 50kg', 'Galao 5L'],
  'Pequena-Media': ['Saco 25kg', 'Saco 50kg', 'Galao 5L'],
  'Media-Grande': ['Saco 50kg', 'Big Bag 1000kg', 'Galao 20L'],
  'Grande': ['Big Bag 1000kg', 'Galao 20L', 'A granel', 'Pallet'],
}

export function getProductById(id: string): Product | undefined {
  return PRODUCTS.find(p => p.id === id)
}

export function getProductsByBrand(brand: 'Yara' | 'Tamoios' | 'Generico'): Product[] {
  return PRODUCTS.filter(p => p.brand === brand)
}

export function getPackagingForScale(escala: string): string[] {
  return PACKAGING_BY_SCALE[escala] || PACKAGING_BY_SCALE['Media']
}
