/* Design "Chi": subpágina Roda da Vida & Fluxo do Chi */
import type { Metadata } from 'next'
import { PieChart, Waves, ListChecks } from 'lucide-react'
import FeaturePage from '../../components/marketing/FeaturePage'
import { ASSETS } from '../../components/marketing/assets'

export const metadata: Metadata = {
  title: 'Roda da Vida & Fluxo do Chi — FengShui Studio',
  description:
    'Combine o diagnóstico do morador com o do imóvel: 12 áreas da vida em um radar e o caminho da energia mapeado sobre a planta.',
}

export default function RecursoRodaDaVida() {
  return (
    <FeaturePage
      eyebrow="Recursos · Diagnósticos"
      title={
        <>
          Roda da Vida e Fluxo do Chi: o retrato completo,{' '}
          <span className="brush-underline">da pessoa e do espaço</span>
        </>
      }
      subtitle="Combine o diagnóstico do morador com o diagnóstico do imóvel: 12 áreas da vida em um radar claro e o caminho da energia mapeado sobre a planta."
      heroImg={ASSETS.rodaDaVida}
      heroAlt="Tela da Roda da Vida com radar de 12 áreas e scores"
      benefits={[
        { icon: PieChart, t: '12 áreas, 60 perguntas', d: 'Questionário guiado que gera um radar visual do equilíbrio de vida do cliente.' },
        { icon: Waves, t: 'Fluxo do Chi', d: 'Trace o caminho da energia da entrada aos cômodos e identifique estagnações.' },
        { icon: ListChecks, t: 'Cruzamento de dados', d: 'Conecte áreas fracas da Roda aos setores correspondentes do Ba Guá.' },
      ]}
      blocks={[
        {
          title: 'Um radar que o cliente entende de imediato',
          text: 'A Roda da Vida transforma 60 respostas em um gráfico de radar de 12 eixos — espiritualidade, saúde, relacionamentos, propósito, finanças e mais. Em uma única imagem, o cliente enxerga onde a vida pede atenção, e você ganha um ponto de partida objetivo para a consultoria.',
          img: ASSETS.rodaDaVida,
          alt: 'Radar da Roda da Vida com 12 áreas preenchidas em jade',
        },
        {
          title: 'A energia da casa, traçada sobre a planta',
          text: 'Com o Fluxo do Chi, você desenha o caminho que a energia percorre da porta de entrada pelos ambientes, marcando pontos de estagnação e bloqueios. O checklist dedicado avalia entrada, corredores e quartos, gerando um score de fluidez que complementa o diagnóstico Ba Guá.',
          img: ASSETS.fluxoChi,
          alt: 'Planta com setas do fluxo de energia e pontos de estagnação marcados',
        },
      ]}
      faq={[
        { q: 'A Roda da Vida é respondida por mim ou pelo cliente?', a: 'Os dois modos são possíveis: você pode conduzir as perguntas durante a sessão ou enviar para o cliente responder com calma antes do encontro.' },
        { q: 'O Fluxo do Chi exige planta baixa?', a: 'O ideal é ter a planta para traçar o caminho com precisão, mas você também pode usar um esboço simples do imóvel.' },
        { q: 'Os resultados entram no relatório final?', a: 'Sim. Radar, scores e o mapa de fluxo são incluídos automaticamente no relatório PDF, com as suas observações.' },
      ]}
    />
  )
}
