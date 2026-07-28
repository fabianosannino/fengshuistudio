/* Design "Chi": hub de recursos com bento e links para as 4 subpáginas */
import type { Metadata } from 'next'
import Link from 'next/link'
import { Compass, PieChart, FileText, Moon, ArrowRight } from 'lucide-react'
import Navbar from '../components/marketing/Navbar'
import Footer from '../components/marketing/Footer'
import FadeUp from '../components/marketing/FadeUp'
import CtaBand from '../components/marketing/CtaBand'
import { ASSETS } from '../components/marketing/assets'

export const metadata: Metadata = {
  title: 'Recursos — FengShui Studio',
  description:
    'Quatro pilares, um fluxo de trabalho completo: Ba Guá & planta, Roda da Vida & Fluxo do Chi, relatórios & clientes, calendário lunar, curas & loja.',
}

const pilares = [
  {
    href: '/recursos/bagua',
    icon: Compass,
    title: 'Análise Ba Guá & Planta',
    desc: 'Upload da planta baixa, grade dos 9 setores, bússola integrada, centro Tai Ji ajustável e scores automáticos por área da vida.',
    img: ASSETS.heroBagua,
  },
  {
    href: '/recursos/roda-da-vida',
    icon: PieChart,
    title: 'Roda da Vida & Fluxo do Chi',
    desc: 'Radar de 12 áreas com 60 perguntas guiadas e o mapeamento do caminho da energia pelo imóvel, com pontos de estagnação.',
    img: ASSETS.rodaDaVida,
  },
  {
    href: '/recursos/relatorios',
    icon: FileText,
    title: 'Relatórios & Gestão de Clientes',
    desc: 'Relatório PDF premium com a sua marca, CRM com propostas e status, e controle financeiro com recebimentos.',
    img: ASSETS.crm,
  },
  {
    href: '/recursos/calendario',
    icon: Moon,
    title: 'Calendário Lunar, Curas & Loja',
    desc: 'Fases da lua com rituais, biblioteca de curas e ativações por setor, e a sua própria loja com pagamentos via Stripe.',
    img: ASSETS.calendarioLunar,
  },
]

export default function Recursos() {
  return (
    <div className="min-h-screen flex flex-col bg-paper">
      <Navbar />
      <main className="flex-1">
        <section className="relative bg-ink bagua-grid-bg text-paper py-16 md:py-24 text-center overflow-hidden">
          <div
            className="absolute inset-x-0 bottom-0 h-32 opacity-[0.14] bg-cover bg-center"
            style={{ backgroundImage: `url(${ASSETS.sumieMontanhas})` }}
            aria-hidden="true"
          />
          <div className="container relative max-w-3xl">
            <FadeUp>
              <p className="eyebrow mb-4">Recursos</p>
              <h1 className="font-display text-3xl md:text-5xl leading-[1.15] text-balance">
                Quatro pilares, um fluxo de trabalho <span className="brush-underline">completo</span>
              </h1>
              <p className="mt-5 text-lg text-paper/70 text-pretty">
                Do primeiro diagnóstico à entrega final, cada etapa da consultoria tem uma ferramenta dedicada.
              </p>
            </FadeUp>
          </div>
        </section>

        <section className="py-16 md:py-24">
          <div className="container grid md:grid-cols-2 gap-6">
            {pilares.map((p, i) => (
              <FadeUp key={p.href} delay={i * 70}>
                <Link
                  href={p.href}
                  className="group block bg-sand/60 rounded-2xl border border-border/70 p-7 h-full shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-ink text-gold">
                      <p.icon className="h-5 w-5" strokeWidth={1.5} />
                    </span>
                    <h2 className="font-display text-xl md:text-2xl text-ink">{p.title}</h2>
                  </div>
                  <p className="text-ink/65 leading-relaxed mb-5">{p.desc}</p>
                  <div className="overflow-hidden rounded-xl border border-border/60 aspect-[2/1] bg-paper">
                    <img
                      src={p.img || '/placeholder.svg'}
                      alt=""
                      className="w-full h-full object-cover object-top group-hover:scale-[1.02] transition-transform duration-300"
                      loading="lazy"
                    />
                  </div>
                  <p className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-jade">
                    Ver em detalhe <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                  </p>
                </Link>
              </FadeUp>
            ))}
          </div>
        </section>

        <CtaBand
          title="Veja os quatro pilares funcionando juntos"
          subtitle="Crie sua conta gratuita e percorra o fluxo completo: da planta ao relatório final."
        />
      </main>
      <Footer />
    </div>
  )
}
