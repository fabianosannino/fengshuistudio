import { PlantInfo, RegiaoInfo, SoloInfo, ProducaoInfo, ProblemaInfo, AduboRecomendado, TubeteRecomendado, Resultado } from './types'

export function gerarRecomendacao(
  planta: PlantInfo,
  regiao: RegiaoInfo,
  solo: SoloInfo,
  producao: ProducaoInfo,
  problemasSelecionados: ProblemaInfo[]
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
  let tubeteAdubo = 'NPK de liberacao lenta 14-14-14 (Osmocote ou similar) - 3g por tubete'
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
