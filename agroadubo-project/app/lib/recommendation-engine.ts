import { PlantInfo, RegiaoInfo, SoloInfo, ProducaoInfo, ProblemaInfo, AduboRecomendado, TubeteRecomendado, Resultado, ESGMetrics } from './types'
import { getProductById, SKU_MAP, CATEGORY_PRODUCT_MAP, getPackagingForScale } from './products'
import { getFormulationByCategory, calcPlasticoEvitado, calcReducaoCO2 } from './tubete-formulations'

// Helper: enriquecer adubo com dados do produto real (Yara)
function enriquecerAdubo(adubo: AduboRecomendado, skuKey: string, escala: string): AduboRecomendado {
  const skuId = SKU_MAP[skuKey]
  if (!skuId) return adubo

  const product = getProductById(skuId)
  if (!product) return adubo

  const embalagens = getPackagingForScale(escala)
  const embalagensFiltradas = product.embalagens.filter(e => embalagens.includes(e))

  return {
    ...adubo,
    nome: product.nome,
    brand: product.brand,
    linha: product.linha,
    sku: product.id,
    embalagens: embalagensFiltradas.length > 0 ? embalagensFiltradas : product.embalagens,
    diferencial: product.diferencial,
  }
}

export function gerarRecomendacao(
  planta: PlantInfo,
  regiao: RegiaoInfo,
  solo: SoloInfo,
  producao: ProducaoInfo,
  problemasSelecionados: ProblemaInfo[]
): Resultado {
  const adubos: AduboRecomendado[] = []
  const escala = producao.escala

  // === Fertilizantes base conforme necessidade da planta ===

  if (planta.nutrientes.N === 'alto' || planta.nutrientes.N === 'muito alto') {
    adubos.push(enriquecerAdubo({
      nome: 'Ureia',
      tipo: 'Mineral - Nitrogenado',
      npk: '45-00-00',
      aplicacao: 'Cobertura parcelada',
      dosagem: producao.id === 'vaso' ? '1-2g por litro de agua' : producao.id === 'larga' ? '150-200 kg/ha' : '50-100 g/m2',
      frequencia: 'A cada 30-45 dias',
      icon: '\uD83E\uDDEA',
    }, 'Ureia', escala))
  }

  if (planta.nutrientes.P === 'alto') {
    adubos.push(enriquecerAdubo({
      nome: 'Superfosfato Simples',
      tipo: 'Mineral - Fosfatado',
      npk: '00-18-00 (+20% Ca, 12% S)',
      aplicacao: 'Plantio (misturado ao solo)',
      dosagem: producao.id === 'vaso' ? '5g por vaso' : producao.id === 'larga' ? '300-500 kg/ha' : '100-150 g/m2',
      frequencia: 'No plantio',
      icon: '\uD83E\uDDEA',
    }, 'Superfosfato Simples', escala))
  }

  if (planta.nutrientes.K === 'alto' || planta.nutrientes.K === 'muito alto') {
    adubos.push(enriquecerAdubo({
      nome: 'Cloreto de Potassio (KCl)',
      tipo: 'Mineral - Potassico',
      npk: '00-00-60',
      aplicacao: 'Cobertura',
      dosagem: producao.id === 'vaso' ? '1g por litro de agua' : producao.id === 'larga' ? '100-200 kg/ha' : '30-60 g/m2',
      frequencia: 'A cada 45-60 dias',
      icon: '\uD83E\uDDEA',
    }, 'Cloreto de Potassio', escala))
  }

  // === Formulacao NPK por categoria - mapeada para produto Yara ===

  const categoryProductId = CATEGORY_PRODUCT_MAP[planta.categoria]
  const categoryProduct = categoryProductId ? getProductById(categoryProductId) : null

  if (planta.categoria === 'Hortalica') {
    const adubo: AduboRecomendado = {
      nome: categoryProduct?.nome || 'NPK 10-10-10',
      tipo: 'Mineral - Formulado',
      npk: categoryProduct ? `${categoryProduct.composicao.N || 0}-${categoryProduct.composicao.P || 0}-${categoryProduct.composicao.K || 0}` : '10-10-10',
      aplicacao: 'Plantio e cobertura',
      dosagem: producao.id === 'vaso' ? '3-5g por vaso' : '100-200 g/m2',
      frequencia: 'A cada 20-30 dias',
      icon: '\uD83C\uDF3F',
      brand: categoryProduct?.brand,
      linha: categoryProduct?.linha,
      sku: categoryProduct?.id,
      embalagens: categoryProduct?.embalagens,
      diferencial: categoryProduct?.diferencial,
    }
    adubos.push(adubo)
  } else if (planta.categoria === 'Fruta') {
    const adubo: AduboRecomendado = {
      nome: categoryProduct?.nome || 'NPK 04-14-08',
      tipo: 'Mineral - Formulado',
      npk: categoryProduct ? `${categoryProduct.composicao.N || 0}-${categoryProduct.composicao.P || 0}-${categoryProduct.composicao.K || 0}` : '04-14-08',
      aplicacao: 'Cova de plantio e cobertura',
      dosagem: producao.id === 'vaso' ? '5-10g por vaso' : '200-400 g/planta',
      frequencia: 'A cada 60-90 dias',
      icon: '\uD83C\uDF3F',
      brand: categoryProduct?.brand,
      linha: categoryProduct?.linha,
      sku: categoryProduct?.id,
      embalagens: categoryProduct?.embalagens,
      diferencial: categoryProduct?.diferencial,
    }
    adubos.push(adubo)
  } else if (planta.categoria === 'Perene') {
    const adubo: AduboRecomendado = {
      nome: categoryProduct?.nome || 'NPK 20-05-20',
      tipo: 'Mineral - Formulado',
      npk: categoryProduct ? `${categoryProduct.composicao.N || 0}-${categoryProduct.composicao.P || 0}-${categoryProduct.composicao.K || 0}` : '20-05-20',
      aplicacao: 'Cobertura parcelada',
      dosagem: producao.id === 'vaso' ? '5-10g por vaso' : producao.id === 'larga' ? '200-400 kg/ha' : '100-150 g/planta',
      frequencia: 'A cada 60-90 dias',
      icon: '\uD83C\uDF3F',
      brand: categoryProduct?.brand,
      linha: categoryProduct?.linha,
      sku: categoryProduct?.id,
      embalagens: categoryProduct?.embalagens,
      diferencial: categoryProduct?.diferencial,
    }
    adubos.push(adubo)
  } else if (planta.categoria === 'Ornamental') {
    const adubo: AduboRecomendado = {
      nome: categoryProduct?.nome || 'NPK 10-10-10',
      tipo: 'Mineral - Formulado',
      npk: categoryProduct ? `${categoryProduct.composicao.N || 0}-${categoryProduct.composicao.P || 0}-${categoryProduct.composicao.K || 0}` : '10-10-10',
      aplicacao: 'Fertirrigacao diluida',
      dosagem: '2g por litro de agua',
      frequencia: 'A cada 15-20 dias na primavera/verao',
      icon: '\uD83C\uDF3F',
      brand: categoryProduct?.brand,
      linha: categoryProduct?.linha,
      sku: categoryProduct?.id,
      embalagens: categoryProduct?.embalagens,
      diferencial: categoryProduct?.diferencial,
    }
    adubos.push(adubo)
  } else if (planta.categoria === 'Florestal') {
    const adubo: AduboRecomendado = {
      nome: categoryProduct?.nome || 'NPK 06-30-06',
      tipo: 'Mineral - Formulado',
      npk: categoryProduct ? `${categoryProduct.composicao.N || 0}-${categoryProduct.composicao.P || 0}-${categoryProduct.composicao.K || 0}` : '06-30-06',
      aplicacao: 'Cova de plantio',
      dosagem: '100-150 g/cova',
      frequencia: 'No plantio + cobertura aos 90 dias',
      icon: '\uD83C\uDF3F',
      brand: categoryProduct?.brand,
      linha: categoryProduct?.linha,
      sku: categoryProduct?.id,
      embalagens: categoryProduct?.embalagens,
      diferencial: categoryProduct?.diferencial,
    }
    adubos.push(adubo)
  } else if (planta.categoria === 'Erva') {
    const adubo: AduboRecomendado = {
      nome: categoryProduct?.nome || 'NPK 10-10-10',
      tipo: 'Mineral - Formulado',
      npk: categoryProduct ? `${categoryProduct.composicao.N || 0}-${categoryProduct.composicao.P || 0}-${categoryProduct.composicao.K || 0}` : '10-10-10',
      aplicacao: 'Fertirrigacao leve',
      dosagem: producao.id === 'vaso' ? '1-2g por litro de agua' : '50-80 g/m2',
      frequencia: 'A cada 30 dias na primavera/verao',
      icon: '\uD83C\uDF3F',
      brand: categoryProduct?.brand,
      linha: categoryProduct?.linha,
      sku: categoryProduct?.id,
      embalagens: categoryProduct?.embalagens,
      diferencial: categoryProduct?.diferencial,
    }
    adubos.push(adubo)
  } else if (planta.categoria === 'Industrial') {
    const adubo: AduboRecomendado = {
      nome: categoryProduct?.nome || 'NPK 20-10-20',
      tipo: 'Mineral - Formulado',
      npk: categoryProduct ? `${categoryProduct.composicao.N || 0}-${categoryProduct.composicao.P || 0}-${categoryProduct.composicao.K || 0}` : '20-10-20',
      aplicacao: 'Plantio e cobertura parcelada',
      dosagem: producao.id === 'larga' ? '300-500 kg/ha' : '150-200 g/m2',
      frequencia: 'Parcelado em 3-4 aplicacoes no ciclo',
      icon: '\uD83C\uDF3F',
      brand: categoryProduct?.brand,
      linha: categoryProduct?.linha,
      sku: categoryProduct?.id,
      embalagens: categoryProduct?.embalagens,
      diferencial: categoryProduct?.diferencial,
    }
    adubos.push(adubo)
  } else {
    // Graos ou default
    const adubo: AduboRecomendado = {
      nome: categoryProduct?.nome || 'NPK 20-05-20',
      tipo: 'Mineral - Formulado',
      npk: categoryProduct ? `${categoryProduct.composicao.N || 0}-${categoryProduct.composicao.P || 0}-${categoryProduct.composicao.K || 0}` : '20-05-20',
      aplicacao: 'Cobertura',
      dosagem: producao.id === 'larga' ? '200-400 kg/ha' : '100-150 g/m2',
      frequencia: 'Parcelado conforme ciclo',
      icon: '\uD83C\uDF3F',
      brand: categoryProduct?.brand,
      linha: categoryProduct?.linha,
      sku: categoryProduct?.id,
      embalagens: categoryProduct?.embalagens,
      diferencial: categoryProduct?.diferencial,
    }
    adubos.push(adubo)
  }

  // === Opcao organica ===
  // Solo humoso ja e rico em materia organica - reduzir carga organica e priorizar mineral
  if (solo.id === 'humoso') {
    adubos.push(enriquecerAdubo({
      nome: 'Composto Organico / Humus',
      tipo: 'Organico',
      npk: 'Variavel (~2-1-1)',
      aplicacao: 'Complementar - solo ja rico em materia organica',
      dosagem: producao.id === 'vaso' ? '15% do volume do substrato' : producao.id === 'larga' ? '5-10 ton/ha' : '1-2 kg/m2',
      frequencia: 'Somente se necessario apos analise',
      icon: '\uD83E\uDEB1',
    }, 'Composto Organico', escala))
  } else {
    adubos.push(enriquecerAdubo({
      nome: 'Composto Organico / Humus',
      tipo: 'Organico',
      npk: 'Variavel (~2-1-1)',
      aplicacao: 'Misturado ao solo antes do plantio',
      dosagem: producao.id === 'vaso' ? '30% do volume do substrato' : producao.id === 'larga' ? '10-20 ton/ha' : '3-5 kg/m2',
      frequencia: 'A cada novo plantio',
      icon: '\uD83E\uDEB1',
    }, 'Composto Organico', escala))
  }

  // === Aditivos por problema selecionado ===
  const problemaIds = problemasSelecionados.map(p => p.id)

  if (problemaIds.includes('deficiencia_n')) {
    adubos.push(enriquecerAdubo({
      nome: 'Sulfato de Amonio',
      tipo: 'Corretivo - Nitrogenado',
      npk: '21-00-00 (+24% S)',
      aplicacao: 'Cobertura de emergencia',
      dosagem: producao.id === 'vaso' ? '1g/L agua' : '30-50 g/m2',
      frequencia: 'Aplicacao imediata + repetir em 15 dias',
      icon: '\uD83D\uDCA1',
    }, 'Sulfato de Amonio', escala))
  }

  if (problemaIds.includes('deficiencia_p')) {
    adubos.push(enriquecerAdubo({
      nome: 'Fosfato Natural Reativo',
      tipo: 'Corretivo - Fosfatado',
      npk: '00-28-00',
      aplicacao: 'Incorporado ao solo',
      dosagem: producao.id === 'larga' ? '500-1000 kg/ha' : '150-200 g/m2',
      frequencia: 'Aplicacao unica corretiva',
      icon: '\uD83D\uDCA1',
    }, 'Fosfato Natural Reativo', escala))
  }

  if (problemaIds.includes('deficiencia_k')) {
    adubos.push(enriquecerAdubo({
      nome: 'Sulfato de Potassio',
      tipo: 'Corretivo - Potassico',
      npk: '00-00-50 (+18% S)',
      aplicacao: 'Cobertura',
      dosagem: producao.id === 'vaso' ? '2g/L agua' : '40-80 g/m2',
      frequencia: 'A cada 30 dias ate corrigir',
      icon: '\uD83D\uDCA1',
    }, 'Sulfato de Potassio', escala))
  }

  // Estresse hidrico -> YaraAmplix
  if (problemaIds.includes('seca')) {
    const amplix = getProductById('yara-amplix-launch')
    if (amplix) {
      adubos.push({
        nome: amplix.nome,
        tipo: 'Bioestimulante - Anti-estresse',
        npk: '-',
        aplicacao: 'Pulverizacao foliar preventiva e curativa',
        dosagem: producao.id === 'vaso' ? '2ml/L agua' : producao.id === 'larga' ? '1-2 L/ha' : '5ml/L agua',
        frequencia: 'A cada 15-20 dias em periodos de seca',
        icon: '\uD83D\uDCA7',
        brand: amplix.brand,
        linha: amplix.linha,
        sku: amplix.id,
        embalagens: amplix.embalagens,
        diferencial: amplix.diferencial,
      })
    }
  }

  // Deficiencia de micronutrientes -> YaraVita
  if (problemaIds.includes('deficiencia_micro')) {
    const vitaBortrac = getProductById('yara-vita-bortrac')
    const vitaZintrac = getProductById('yara-vita-zintrac')
    const vitaMntrac = getProductById('yara-vita-mantrac')

    if (vitaBortrac) {
      adubos.push({
        nome: vitaBortrac.nome,
        tipo: 'Foliar - Micronutriente (Boro)',
        npk: '-',
        aplicacao: 'Pulverizacao foliar no florescimento',
        dosagem: producao.id === 'larga' ? '1-1.5 L/ha' : '2-3 ml/L agua',
        frequencia: 'Pre-florescimento e enchimento de graos',
        icon: '\uD83D\uDD2C',
        brand: vitaBortrac.brand,
        linha: vitaBortrac.linha,
        sku: vitaBortrac.id,
        embalagens: vitaBortrac.embalagens,
        diferencial: vitaBortrac.diferencial,
      })
    }
    if (vitaZintrac) {
      adubos.push({
        nome: vitaZintrac.nome,
        tipo: 'Foliar - Micronutriente (Zinco)',
        npk: '-',
        aplicacao: 'Pulverizacao foliar',
        dosagem: producao.id === 'larga' ? '0.5-1 L/ha' : '1-2 ml/L agua',
        frequencia: 'A cada 20-30 dias se necessario',
        icon: '\uD83D\uDD2C',
        brand: vitaZintrac.brand,
        linha: vitaZintrac.linha,
        sku: vitaZintrac.id,
        embalagens: vitaZintrac.embalagens,
        diferencial: vitaZintrac.diferencial,
      })
    }
    if (vitaMntrac) {
      adubos.push({
        nome: vitaMntrac.nome,
        tipo: 'Foliar - Micronutriente (Manganes)',
        npk: '-',
        aplicacao: 'Pulverizacao foliar',
        dosagem: producao.id === 'larga' ? '0.5-1 L/ha' : '1-2 ml/L agua',
        frequencia: 'A cada 20-30 dias se necessario',
        icon: '\uD83D\uDD2C',
        brand: vitaMntrac.brand,
        linha: vitaMntrac.linha,
        sku: vitaMntrac.id,
        embalagens: vitaMntrac.embalagens,
        diferencial: vitaMntrac.diferencial,
      })
    }
  }

  // === Correcoes de solo ===
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

  // === Manejo ===
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
  if (problemaIds.includes('deficiencia_micro')) {
    manejo.push('Realizar analise foliar para identificar micronutrientes especificos deficientes')
    manejo.push('Monitorar sintomas visuais: clorose internerval (Fe/Mn), folhas deformadas (B/Zn)')
  }

  if (manejo.length === 0) {
    manejo.push('Manter irrigacao regular conforme necessidade da cultura')
    manejo.push('Monitorar pragas e doencas preventivamente')
    manejo.push('Realizar analise de solo periodicamente')
  }

  // === Tubete - com integracao Tamoios + receita on-delivery ===
  const formulation = getFormulationByCategory(planta.categoria)

  let tubeteTamanho = '120 cm3'
  let tubeteVolume = '120 ml'
  let tubeteSubstrato = 'Substrato comercial + vermiculita (70/30)'
  let tubeteAdubo = 'NPK de liberacao lenta 14-14-14 - 3g por tubete'
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
  } else if (planta.categoria === 'Erva') {
    tubeteTamanho = '40 cm3'
    tubeteVolume = '40 ml'
    tubeteSubstrato = 'Substrato leve + perlita + areia (60/20/20)'
    tubeteAdubo = 'NPK 10-10-10 liberacao lenta - 1g por tubete'
    tubeteTempoMuda = '20-30 dias'
  } else if (planta.categoria === 'Industrial') {
    tubeteTamanho = '120 cm3'
    tubeteVolume = '120 ml'
    tubeteSubstrato = 'Substrato comercial + vermiculita (70/30)'
    tubeteAdubo = 'NPK 14-14-14 liberacao lenta - 3g por tubete'
    tubeteTempoMuda = '30-45 dias'
  }

  // Sobrescrever com dados da receita on-delivery se disponivel
  if (formulation) {
    tubeteTamanho = formulation.tamanhoTubete
    tubeteVolume = formulation.volumeTubete
    tubeteAdubo = formulation.receitaYara
  }

  const tubete: TubeteRecomendado = {
    tamanho: tubeteTamanho,
    volume: tubeteVolume,
    substrato: tubeteSubstrato,
    aduboBase: tubeteAdubo,
    tempoMuda: tubeteTempoMuda,
    instrucoes: [
      `Usar Tubete Bio Tamoios (polpa moldada) tamanho ${tubeteTamanho}`,
      `Preencher com: ${tubeteSubstrato}`,
      `Nutricao on-delivery: ${tubeteAdubo}`,
      'Semear ou transplantar a muda no centro do tubete',
      `Manter em viveiro/estufa por ${tubeteTempoMuda} antes do transplante para o terreno`,
      'Irrigar diariamente mantendo o substrato umido (nao encharcado)',
      'A tecnologia de Poda Aerea Natural elimina o enovelamento radicular - a raiz para de crescer ao tocar o ar e ramifica internamente',
      'O tubete de polpa biodegradavel se degrada naturalmente no solo apos o transplante - nao precisa remover',
    ],
    // Campos Tamoios + Yara
    brand: 'Tamoios',
    receitaId: formulation?.id,
    receitaNome: formulation ? `Receita ${formulation.culturaAlvo}` : undefined,
    tecnologiaPodaAerea: true,
    biodegradavel: true,
    biomassa: 'Polpa moldada de fibra de cana - Spin-off USP',
    nutrientesImpregnados: formulation?.nutrientesImpregnados,
    liberacaoGradualDias: formulation?.liberacaoDias,
    arquiteturaRadicular: 'Sistema radicular livre, sem enovelamento, com ramificacao lateral densa promovida pela Poda Aerea Natural',
  }

  // === Metricas ESG ===
  // Estimar quantidade de mudas com base na escala de producao
  const mudasEstimadas =
    producao.id === 'vaso' ? 10 :
    producao.id === 'horta' ? 50 :
    producao.id === 'estufa' ? 500 :
    producao.id === 'pequena' ? 2000 :
    producao.id === 'media' ? 10000 :
    50000 // larga escala

  const esg: ESGMetrics = {
    plasticoEvitadoKg: calcPlasticoEvitado(mudasEstimadas),
    reducaoCO2Percent: calcReducaoCO2(),
    conformidadeEUDR: true,
    origemBiomassa: 'Fibra de cana-de-acucar processada - Tecnologia Tamoios (Spin-off USP, Piracicaba-SP)',
    spinoffUSP: true,
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
    esg,
  }
}
