// Shared constants for Roda da Vida — used by both standalone page and consultation tab

export type AreaRodaVida = {
  key: string
  label: string
  categoria: string
  cor: string
  perguntas: string[]
}

/**
 * A cor de cada área é o que identifica a série no radar de 12 pontos — rótulo,
 * ponto e valor numérico usam `a.cor`. Duas áreas com a mesma cor tornam duas
 * séries vizinhas indistinguíveis, que é o oposto do que o gráfico serve.
 *
 * Cada categoria tem uma família de tons: a categoria fica com o mais escuro e
 * as três áreas dela com os três mais claros, o que dá hierarquia sem colisão.
 */
export const AREAS: AreaRodaVida[] = [
  { key: 'familia', label: 'Família', categoria: 'Relacionamentos', cor: '#B4533A', perguntas: ['Tempo dedicado aos familiares','Momentos agradáveis com a família','Diálogo e boa vontade para resolver conflitos','Grau de abertura para falar e ouvir','Confiança e apoio mútuos'] },
  { key: 'relacao_amorosa', label: 'Relação Amorosa', categoria: 'Relacionamentos', cor: '#A9613C', perguntas: ['Tempo dedicado ao parceiro(a)','Grau de abertura para falar e ouvir','Satisfação com as relações íntimas','Criação de momentos românticos','Dividir sonhos e expectativas de vida'] },
  { key: 'vida_social', label: 'Vida Social', categoria: 'Relacionamentos', cor: '#D9A88C', perguntas: ['Festas e reuniões de amigos (periodicidade)','Esforço para manter contato com amigos','Número de amigos que encontra regularmente','Qualidade dos encontros com amigos','Participação em atividades em grupo'] },
  { key: 'espiritualidade', label: 'Espiritualidade', categoria: 'Qualidade de Vida', cor: '#C9A227', perguntas: ['Paz interior','Coerência de valores (faz o que prega)','Força e equilíbrio internos','Tempo para si (reflexão meditação oração)','Religiosidade'] },
  { key: 'hobbies', label: 'Hobbies & Lazer', categoria: 'Qualidade de Vida', cor: '#8A6E2F', perguntas: ['Qualidade do tempo dedicado ao lazer','Variedade de formas para relaxar e se divertir','Prazer que as atividades proporcionam','Periodicidade das atividades de hobbie e lazer','Relaxamento ou revigoramento após as atividades'] },
  { key: 'plenitude', label: 'Plenitude', categoria: 'Qualidade de Vida', cor: '#E0C25C', perguntas: ['Otimismo em relação ao futuro','Satisfação com a vida atual','Frequência com que sorri','Confiança em você mesmo(a)','Orgulho pelas conquistas do passado'] },
  { key: 'contribuicao', label: 'Contribuição', categoria: 'Profissional', cor: '#2E7D6B', perguntas: ['Desejo sincero pela prosperidade dos outros','Cordialidade com as pessoas em geral','Colocar-se à disposição para ajudar alguém','Dedicação ao ensinar o que sabe aos outros','Trabalhos voluntários ou doações'] },
  { key: 'financeiro', label: 'Financeiro', categoria: 'Profissional', cor: '#245F52', perguntas: ['Satisfação com os rendimentos financeiros','Equilíbrio entre ganhos e gastos','Reservas para possíveis crises','Satisfação sobre investimentos no último ano','Oportunidades para o aumento da renda'] },
  { key: 'realizacao', label: 'Realização Profissional', categoria: 'Profissional', cor: '#7FB8A8', perguntas: ['Auto-imagem profissional positiva','Satisfação com a carreira','Oportunidades de crescimento profissional','Ambiente de trabalho proporciona desafios','Atividade profissional congruente com crenças e valores'] },
  { key: 'saude', label: 'Saúde', categoria: 'Pessoal', cor: '#1C3A52', perguntas: ['Alimentação equilibrada','Exercícios físicos regulares','Horas de sono diárias adequadas','Controle do nível de stress','Check-up e exames de rotina'] },
  { key: 'emocional', label: 'Equilíbrio Emocional', categoria: 'Pessoal', cor: '#4A6E88', perguntas: ['Reações emocionais proporcionais aos eventos','Controle das emoções sob pressão e stress','Manter o foco em momentos difíceis','Expressar opiniões de forma clara e cordial','Controle da frustração com expectativas não atingidas'] },
  { key: 'intelectual', label: 'Desenvolvimento Intelectual', categoria: 'Pessoal', cor: '#3E5A70', perguntas: ['Participação em cursos e treinamentos','Leitura sobre temas diversos','Presença em atividades novas e não habituais','Manter-se informado(a)','Participação em conversas com assuntos diferentes dos habituais'] },
]

export const CATEGORIAS = [
  { key: 'relacionamentos', label: 'Relacionamentos', areas: ['familia','relacao_amorosa','vida_social'], cor: '#8F3F2C' },
  { key: 'qualidade_vida', label: 'Qualidade de Vida', areas: ['espiritualidade','hobbies','plenitude'], cor: '#6B5424' },
  { key: 'profissional', label: 'Profissional', areas: ['contribuicao','financeiro','realizacao'], cor: '#1B4A40' },
  { key: 'pessoal', label: 'Pessoal', areas: ['saude','emocional','intelectual'], cor: '#0E1B2C' },
]

/** Average of an array of numbers */
export const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length

/** Default responses: 5 questions per area, all set to 5 */
export const defaultRespostas = (): Record<string, number[]> =>
  Object.fromEntries(AREAS.map(a => [a.key, [5, 5, 5, 5, 5]]))

/**
 * Ba Guá mapping for the 12 Roda da Vida areas.
 * Maps each area key to the closest Ba Guá sector name.
 */
export const AREA_GUA_MAP: Record<string, string> = {
  familia: 'Família',
  relacao_amorosa: 'Relacionamentos',
  vida_social: 'Pessoas Úteis',
  espiritualidade: 'Espiritualidade',
  hobbies: 'Criatividade',
  plenitude: 'Centro',
  contribuicao: 'Pessoas Úteis',
  financeiro: 'Prosperidade',
  realizacao: 'Fama',
  saude: 'Centro',
  emocional: 'Família',
  intelectual: 'Carreira',
}
