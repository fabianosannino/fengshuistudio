/* Design "Chi": subpágina Calendário Lunar, Curas & Loja */
import type { Metadata } from 'next'
import { Moon, Leaf, Store } from 'lucide-react'
import FeaturePage from '../../components/marketing/FeaturePage'
import { ASSETS } from '../../components/marketing/assets'

export const metadata: Metadata = {
  title: 'Calendário Lunar, Curas & Loja — FengShui Studio',
  description:
    'Escolha os melhores períodos com o calendário chinês, prescreva curas por setor e crie uma nova fonte de receita com a loja integrada.',
}

export default function RecursoCalendario() {
  return (
    <FeaturePage
      eyebrow="Recursos · Práticas & Receita"
      title={
        <>
          Calendário lunar, curas por setor e a sua própria{' '}
          <span className="brush-underline">loja</span>
        </>
      }
      subtitle="Escolha os melhores períodos com o calendário chinês, prescreva curas e ativações práticas e crie uma nova fonte de receita com a loja integrada."
      heroImg={ASSETS.calendarioLunar}
      heroAlt="Calendário lunar com fases da lua e painel de ritual de lua cheia"
      benefits={[
        { icon: Moon, t: 'Fases e rituais', d: 'Calendário lunar chinês com dias favoráveis e rituais sugeridos para cada fase.' },
        { icon: Leaf, t: 'Curas e ativações', d: 'Biblioteca de cristais, plantas, cores, mudras e mantras organizada por setor do Ba Guá.' },
        { icon: Store, t: 'Loja com Stripe', d: 'Venda produtos e serviços na sua própria loja, com pagamentos processados pela Stripe.' },
      ]}
      blocks={[
        {
          title: 'O tempo certo para cada ação',
          text: 'Lua nova para começar, crescente para expandir, cheia para celebrar e minguante para soltar: o calendário integra as fases lunares ao seu fluxo de consultoria, sugerindo períodos favoráveis para mudanças, ativações e rituais — um diferencial que os clientes adoram acompanhar.',
          img: ASSETS.calendarioLunar,
          alt: 'Calendário mensal com ícones de fases da lua e dia favorável destacado',
        },
        {
          title: 'Prescrições práticas, não genéricas',
          text: 'Para cada setor com score baixo, a biblioteca sugere curas específicas: a planta certa para a Prosperidade, o cristal para os Relacionamentos, a cor para a Carreira. Você seleciona, adapta ao contexto do cliente e tudo entra no relatório final como um plano de ação claro.',
          img: ASSETS.salaHarmonizada,
          alt: 'Ambiente harmonizado com plantas e materiais naturais',
        },
      ]}
      faq={[
        { q: 'Como funciona a loja do consultor?', a: 'Você conecta sua conta Stripe, cadastra produtos ou serviços (consultas, cursos, kits de harmonização) e compartilha o link da sua loja. Os pagamentos caem direto na sua conta.' },
        { q: 'As curas são baseadas em qual escola?', a: 'A biblioteca reúne práticas consagradas do Feng Shui contemporâneo ocidental, organizadas pelos 9 guás, e você sempre pode adaptar as sugestões à escola que segue.' },
        { q: 'O calendário considera o fuso do Brasil?', a: 'Sim, as fases e horários são calculados para o horário de Brasília.' },
      ]}
    />
  )
}
