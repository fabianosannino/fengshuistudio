'use client'

import AppShell from '../../components/AppShell'

const CURE_TYPES = [
  {
    icon: '\u{1F48E}',
    title: 'Cristais e Pedras',
    color: '#2E7D6B',
    bgColor: '#EAF4F1',
    borderColor: '#DCEFE9',
    description:
      'Cristais são ferramentas milenares de canalização e purificação energética. Cada pedra possui uma frequência vibratória única que interage com os campos energéticos do ambiente e das pessoas. No Feng Shui, cristais são posicionados estrategicamente para harmonizar, ativar ou proteger setores específicos do Ba Guá.',
    examples: [
      { name: 'Quartzo Rosa', detail: 'Para relacionamentos - abre o coração para dar e receber amor. Posicione no setor Sudoeste.' },
      { name: 'Citrino', detail: 'Para prosperidade - atrai riqueza e sucesso financeiro. Ideal no setor Sudeste.' },
      { name: 'Ametista', detail: 'Para espiritualidade - aprofunda meditação e conexão espiritual. Coloque no setor Nordeste.' },
      { name: 'Turmalina Negra', detail: 'Para proteção - absorve energias negativas. Use na entrada ou setor Norte.' },
      { name: 'Jade', detail: 'Para saúde e família - promove longevidade e harmonia nos laços familiares.' },
    ],
    tips: 'Limpe seus cristais regularmente com água corrente, luz solar ou fumaça de sálvia. Programe-os com intenções claras antes de posicioná-los.',
  },
  {
    icon: '\u{1F33F}',
    title: 'Plantas e Elementos Naturais',
    color: '#15803D',
    bgColor: '#F0FDF4',
    borderColor: '#BBF7D0',
    description:
      'Plantas vivas são poderosas ativadoras do elemento Madeira no Feng Shui. Elas purificam o ar, movem a energia estagnada (Chi) e trazem vitalidade a qualquer ambiente. Plantas saudáveis e bem cuidadas simbolizam crescimento, abundância e renovação.',
    examples: [
      { name: 'Bambu da Sorte', detail: 'Ativa sorte e prosperidade. O número de hastes tem significados diferentes (3 = felicidade, 5 = saúde, 8 = riqueza).' },
      { name: 'Espada-de-São-Jorge', detail: 'Proteção energética poderosa. Suas folhas em forma de espada cortam energias negativas.' },
      { name: 'Lírio da Paz', detail: 'Purifica o ar e a energia do ambiente. Excelente para escritórios e áreas de trabalho.' },
      { name: 'Planta Jade (Crassula)', detail: 'Conhecida como árvore do dinheiro - suas folhas arredondadas lembram moedas.' },
      { name: 'Orquídea', detail: 'Simboliza elegância, fertilidade e abundância. Ideal para o setor de relacionamentos.' },
    ],
    tips: 'Evite plantas com espinhos no interior da casa (exceto na entrada para proteção). Retire imediatamente plantas mortas ou doentes.',
  },
  {
    icon: '\u{1F3EE}',
    title: 'Objetos e Símbolos',
    color: '#D97706',
    bgColor: '#FFFBEB',
    borderColor: '#FDE68A',
    description:
      'Objetos decorativos e simbólicos são ferramentas clássicas do Feng Shui para redirecionar, ativar ou acalmar o fluxo de energia (Chi) nos ambientes. Cada objeto carrega um significado e deve ser posicionado com intenção e conhecimento dos setores do Ba Guá.',
    examples: [
      { name: 'Fontes de Água', detail: 'Ativam o elemento Água e atraem prosperidade. A água deve fluir para dentro da casa, não para fora.' },
      { name: 'Sinos de Vento', detail: 'Dispersam energia estagnada e ativam o Chi. Sinos de metal para o Oeste/Noroeste, bambu para Leste/Sudeste.' },
      { name: 'Espelhos Ba Guá', detail: 'Apenas para uso externo. Refletem energia negativa vinda de fora (Sha Chi). Nunca use dentro de casa.' },
      { name: 'Sapo da Fortuna (Chan Chu)', detail: 'Símbolo de prosperidade. Posicione olhando para dentro, preferencialmente perto da porta.' },
      { name: 'Tartaruga', detail: 'Símbolo de proteção e longevidade. Posicione atrás da mesa de trabalho para apoio.' },
    ],
    tips: 'Cada objeto deve ser colocado com intenção. Objetos quebrados ou sem significado pessoal devem ser removidos do ambiente.',
  },
  {
    icon: '\u{1F64F}',
    title: 'Mudras',
    color: '#9333EA',
    bgColor: '#FAF5FF',
    borderColor: '#DCEFE9',
    description:
      'Mudras são gestos sagrados realizados com as mãos que ativam centros energéticos específicos no corpo. No contexto do Feng Shui, cada mudra corresponde a um elemento e setor do Ba Guá, canalizando energia para áreas específicas da vida.',
    examples: [
      { name: 'Varun Mudra (Água)', detail: 'Ponta do mindinho toca o polegar. Ativa fluidez na carreira e intuição.' },
      { name: 'Agni Mudra (Fogo)', detail: 'Anelar dobrado sob o polegar. Acende o fogo interior para fama e reconhecimento.' },
      { name: 'Prithvi Mudra (Terra)', detail: 'Anelar toca o polegar. Ancora e estabiliza, ideal para saúde e relacionamentos.' },
      { name: 'Kubera Mudra (Prosperidade)', detail: 'Polegar, indicador e médio unidos. Ativa manifestação de riqueza.' },
      { name: 'Gyan Mudra (Sabedoria)', detail: 'Indicador toca o polegar. O mudra mais clássico, para meditação e conhecimento.' },
    ],
    tips: 'Pratique mudras por 5-15 minutos em ambiente tranquilo. Combine com respiração consciente para potencializar os efeitos. A consistência é mais importante que a duração.',
  },
  {
    icon: '\u{1F9D8}',
    title: 'Meditação',
    color: '#059669',
    bgColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    description:
      'A meditação no Feng Shui vai além do relaxamento - é uma prática direcionada para harmonizar setores específicos do Ba Guá. Cada meditação trabalha com visualizações e elementos correspondentes ao setor que precisa de atenção e cura.',
    examples: [
      { name: 'Meditação do Rio Interior (Água)', detail: 'Visualize um rio calmo para ativar fluidez na carreira. 15 minutos, posição Norte.' },
      { name: 'Meditação da Árvore Ancestral (Madeira)', detail: 'Conecte-se com uma árvore milenar para curar laços familiares. 20 minutos.' },
      { name: 'Meditação da Chama Interior (Fogo)', detail: 'Visualize uma chama crescente no peito para ativar reputação e brilho pessoal.' },
      { name: 'Meditação das Duas Chamas (Terra)', detail: 'Duas chamas rosa se fundem - harmoniza relacionamentos amorosos.' },
      { name: 'Meditação do Centro Dourado (Terra)', detail: 'Esfera dourada no centro irradia para todos os setores - equilíbrio geral.' },
    ],
    tips: 'Medite preferencialmente no setor da casa correspondente ao tema trabalhado. Use incenso ou vela do elemento adequado para potencializar.',
  },
  {
    icon: '\u{1F549}\u{FE0F}',
    title: 'Mantras',
    color: '#B45309',
    bgColor: '#FFF7ED',
    borderColor: '#FED7AA',
    description:
      'Mantras são sons sagrados que vibram em frequências específicas, capazes de ativar e transformar a energia dos ambientes e das pessoas. No Feng Shui chinês, caracteres específicos carregam significados profundos e são entoados para atrair qualidades como prosperidade, saúde e harmonia.',
    examples: [
      { name: '\u8CA1\u6E90\u5EE3\u9032 (Caiyuan guang jin)', detail: 'Que as fontes de riqueza fluam abundantemente. Entoe voltado para o Sudeste.' },
      { name: '\u5BB6\u548C\u842C\u4E8B\u8208 (Jia he wan shi xing)', detail: 'Com harmonia familiar, tudo prospera. Use voltado para o Leste.' },
      { name: '\u611B\u60C5\u7F8E\u6EFF (Aiqing meiman)', detail: 'Que o amor seja pleno e belo. Entoe no setor Sudoeste.' },
      { name: '\u667A\u6167\u5982\u6D77 (Zhihui ru hai)', detail: 'Sabedoria vasta como o oceano. Para o setor Nordeste.' },
      { name: '\u4E2D\u5EB8\u4E4B\u9053 (Zhongyong zhi dao)', detail: 'O Caminho do Equilibrio. Entoe no centro da casa.' },
    ],
    tips: 'Entoe mantras em voz clara e com intenção. Repita pelo menos 9 vezes (número auspicioso no Feng Shui). O horário ideal é ao amanhecer ou ao anoitecer.',
  },
  {
    icon: '\u{1F56F}\u{FE0F}',
    title: 'Aromaterapia',
    color: '#BE185D',
    bgColor: '#FDF2F8',
    borderColor: '#FBCFE8',
    description:
      'O uso de óleos essenciais e incensos é uma forma poderosa de purificação e ativação energética dos setores do Ba Guá. Cada aroma corresponde a um elemento e pode transformar a qualidade energética de um ambiente em minutos.',
    examples: [
      { name: 'Lavanda (Metal/Noroeste)', detail: 'Purifica e acalma. Ideal para áreas de mentores e pessoas úteis.' },
      { name: 'Canela (Fogo/Sul)', detail: 'Ativa a energia do Fogo, perfeita para o setor de fama e reputação.' },
      { name: 'Alecrim (Madeira/Leste)', detail: 'Estimula clareza mental e proteção. Use na área de família e saúde.' },
      { name: 'Ylang-Ylang (Terra/Sudoeste)', detail: 'Aroma do romance e sensualidade. Ativa o setor de relacionamentos.' },
      { name: 'Hortelã-Pimenta (Água/Norte)', detail: 'Refresca e ativa o fluxo. Ideal para a área de carreira.' },
    ],
    tips: 'Use difusores elétricos para ambientes fechados. Incensos naturais são preferidos - evite sintéticos. Ventile o ambiente antes de aromatizar.',
  },
  {
    icon: '\u{1F3B5}',
    title: 'Musicoterapia',
    color: '#1D4ED8',
    bgColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    description:
      'Sons e frequências têm o poder de harmonizar ambientes, dissolver energias estagnadas e ativar setores específicos. No Feng Shui, a musicoterapia inclui desde instrumentos tradicionais como tigelas tibetanas até música ambiente cuidadosamente selecionada.',
    examples: [
      { name: 'Tigelas Tibetanas', detail: 'Vibração profunda que limpa e harmoniza. Toque em cada cômodo para purificação completa.' },
      { name: 'Sinos e Carrilhões', detail: 'Dispersam energia estagnada e atraem Chi positivo. Use especialmente em cantos escuros.' },
      { name: 'Música com Água (432Hz)', detail: 'Sons de chuva, rios e oceano ativam o elemento Água. Toque na área Norte.' },
      { name: 'Tambores (Elemento Terra)', detail: 'Batidas rítmicas ancoram e estabilizam. Use no centro da casa ou área Nordeste.' },
      { name: 'Flautas de Bambu', detail: 'Ativam o elemento Madeira. Toque ou pendure flautas de bambu na área Leste/Sudeste.' },
    ],
    tips: 'Toque sons de limpeza ao entrar em casa após um dia pesado. A frequência 432Hz é considerada a "afinação natural" e promove harmonia.',
  },
]

export default function EntendaCurasPage() {
  return (
    <AppShell currentPage="curas">
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ color: '#0E1B2C', fontSize: '26px', fontWeight: 'bold', margin: '0 0 8px 0' }}>
          Entenda as Curas e Ativações
        </h1>
        <p style={{ color: '#6B7280', fontSize: '15px', margin: '0 0 16px 0', lineHeight: '1.6' }}>
          Guia completo sobre cada tipo de cura e ativação utilizada no Feng Shui.
          Entenda como funcionam, quando aplicar e como potencializar seus resultados.
        </p>
        <div style={{
          padding: '12px 16px', background: '#EAF4F1', borderRadius: '8px',
          border: '1px solid #DCEFE9', fontSize: '13px', color: '#2E7D6B', lineHeight: '1.5',
        }}>
          Cada tipo de cura trabalha com uma dimensão diferente da energia. A combinação de múltiplas abordagens
          (cristais + meditação + aromaterapia, por exemplo) potencializa significativamente os resultados.
        </div>
      </div>

      {/* Cure Type Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {CURE_TYPES.map((cure, idx) => (
          <div key={idx} style={{
            background: '#ffffff', borderRadius: '12px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden',
          }}>
            {/* Card Header */}
            <div style={{
              background: cure.bgColor, padding: '20px 24px',
              borderBottom: `2px solid ${cure.borderColor}`,
              display: 'flex', alignItems: 'center', gap: '14px',
            }}>
              <span style={{ fontSize: '36px' }}>{cure.icon}</span>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: cure.color, margin: 0 }}>
                  {cure.title}
                </h2>
                <p style={{ fontSize: '12px', color: '#6B7280', margin: '4px 0 0 0' }}>
                  Tipo {idx + 1} de 8
                </p>
              </div>
            </div>

            {/* Card Body */}
            <div style={{ padding: '24px' }}>
              {/* Description */}
              <p style={{ fontSize: '14px', color: '#374151', lineHeight: '1.7', margin: '0 0 20px 0' }}>
                {cure.description}
              </p>

              {/* Examples */}
              <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#0E1B2C', margin: '0 0 12px 0' }}>
                Exemplos e Aplicações
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px', marginBottom: '20px' }}>
                {cure.examples.map((ex, i) => (
                  <div key={i} style={{
                    background: cure.bgColor, borderRadius: '10px', padding: '14px',
                    border: `1px solid ${cure.borderColor}`,
                  }}>
                    <p style={{ fontSize: '13px', fontWeight: 'bold', color: cure.color, margin: '0 0 4px 0' }}>
                      {ex.name}
                    </p>
                    <p style={{ fontSize: '12px', color: '#6B7280', margin: 0, lineHeight: '1.5' }}>
                      {ex.detail}
                    </p>
                  </div>
                ))}
              </div>

              {/* Tips */}
              <div style={{
                background: '#F9FAFB', borderRadius: '10px', padding: '14px 16px',
                border: '1px solid #E5E7EB', display: 'flex', gap: '10px', alignItems: 'flex-start',
              }}>
                <span style={{ fontSize: '18px', flexShrink: 0 }}>{'\u{1F4A1}'}</span>
                <div>
                  <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#374151', margin: '0 0 4px 0' }}>
                    Dica do Consultor
                  </p>
                  <p style={{ fontSize: '12px', color: '#6B7280', margin: 0, lineHeight: '1.5' }}>
                    {cure.tips}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Back Button */}
      <div style={{ textAlign: 'center', marginTop: '32px', marginBottom: '16px' }}>
        <a
          href="/curas"
          style={{
            display: 'inline-block', padding: '12px 28px', background: '#2E7D6B',
            color: '#ffffff', borderRadius: '8px', textDecoration: 'none',
            fontWeight: 'bold', fontSize: '14px', transition: 'background 0.2s',
          }}
        >
          {'\u2190'} Voltar para Curas
        </a>
      </div>
    </AppShell>
  )
}
