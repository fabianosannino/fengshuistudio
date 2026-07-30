/* Design "Chi": subpágina Análise Ba Guá & Planta */
import type { Metadata } from 'next'
import { Upload, Compass, Gauge } from 'lucide-react'
import FeaturePage from '../../components/marketing/FeaturePage'
import FadeUp from '../../components/marketing/FadeUp'
import { ASSETS } from '../../components/marketing/assets'

export const metadata: Metadata = {
  title: 'Análise Ba Guá & Planta — FengShui Studio',
  description:
    'Sobreponha o Ba Guá à planta do imóvel, avalie cada setor com critérios objetivos e receba scores e recomendações práticas.',
}

export default function RecursoBagua() {
  return (
    <FeaturePage
      eyebrow="Recursos · Ba Guá"
      title={
        <>
          Analise a planta do imóvel como as grandes escolas ensinam —{' '}
          <span className="brush-underline">em minutos</span>
        </>
      }
      subtitle="Sobreponha o Ba Guá à planta, avalie cada setor com critérios objetivos e receba scores e recomendações práticas para harmonizar o espaço."
      heroImg={ASSETS.heroBagua}
      heroAlt="Editor de análise Ba Guá com planta baixa, grade de 9 setores, scores e bússola"
      benefits={[
        { icon: Upload, t: 'Upload da planta', d: 'Envie a planta em JPG ou PNG e comece em segundos — ou use o modo sem planta para avaliações rápidas.' },
        { icon: Compass, t: 'Bússola integrada', d: 'Oriente a planta com a bússola do próprio celular ou pelo alinhamento com o mapa do endereço.' },
        { icon: Gauge, t: 'Scores automáticos', d: 'Avaliação inteligente dos 9 setores com recomendações classificadas por prioridade.' },
      ]}
      blocks={[
        {
          title: 'Centro Tai Ji e polígono ajustável',
          text: 'Defina o perímetro real do imóvel com o editor de polígono e posicione o centro Tai Ji com precisão. A grade dos 9 guás se adapta automaticamente, garantindo que cada setor corresponda ao espaço físico correto — inclusive em plantas irregulares.',
          img: ASSETS.heroBagua,
          alt: 'Planta baixa com grade Ba Guá e centro Tai Ji ajustável',
        },
        {
          title: '8 critérios objetivos por setor',
          text: 'Limpeza, iluminação, ventilação, cores, mobiliário, plantas, objetos e fluxo: cada guá é avaliado com um checklist consistente que transforma percepções em dados. O resultado são scores comparáveis entre visitas e uma linha de evolução clara para mostrar ao cliente.',
          img: ASSETS.fluxoChi,
          alt: 'Painel de critérios de avaliação por setor com score',
        },
      ]}
      faq={[
        { q: 'E se o cliente não tiver a planta baixa?', a: 'Você pode usar o modo sem planta, avaliando os setores a partir da orientação do imóvel, ou desenhar um esboço simples e enviá-lo como imagem.' },
        { q: 'A bússola funciona em qualquer celular?', a: 'Sim, em aparelhos com sensor de orientação (a grande maioria). Como alternativa, você pode alinhar a planta usando o mapa do endereço.' },
        { q: 'Posso analisar mais de um pavimento?', a: 'Sim. Cada imóvel aceita múltiplos pavimentos, cada um com sua própria grade e diagnóstico.' },
      ]}
      extra={
        <section className="py-16 md:py-20 bg-paper">
          <div className="container max-w-4xl">
            <FadeUp>
              <h2 className="font-display text-2xl md:text-3xl text-ink text-center mb-8">
                Método manual vs. FengShui Studio
              </h2>
              <div className="overflow-x-auto rounded-2xl border border-border/70">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-ink text-paper">
                      <th className="text-left font-sans font-semibold px-5 py-3.5">Etapa</th>
                      <th className="text-left font-sans font-semibold px-5 py-3.5">Método manual</th>
                      <th className="text-left font-sans font-semibold px-5 py-3.5 text-gold">Com o FengShui Studio</th>
                    </tr>
                  </thead>
                  <tbody className="[&_td]:px-5 [&_td]:py-3.5 [&_tr:nth-child(even)]:bg-sand/60">
                    <tr><td className="font-medium text-ink">Sobrepor o Ba Guá</td><td className="text-ink/65">Régua, transparências e retrabalho</td><td className="text-ink/85">Grade automática sobre a planta</td></tr>
                    <tr><td className="font-medium text-ink">Orientar o imóvel</td><td className="text-ink/65">Bússola física e anotações</td><td className="text-ink/85">Bússola do celular ou mapa</td></tr>
                    <tr><td className="font-medium text-ink">Avaliar setores</td><td className="text-ink/65">Percepção sem padrão</td><td className="text-ink/85">8 critérios e scores comparáveis</td></tr>
                    <tr><td className="font-medium text-ink">Montar o relatório</td><td className="text-ink/65">Horas no Word</td><td className="text-ink/85">PDF com a sua marca, em um clique</td></tr>
                  </tbody>
                </table>
              </div>
            </FadeUp>
          </div>
        </section>
      }
    />
  )
}
