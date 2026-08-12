/* Design "Chi": página de persona pessoal — tom acolhedor, 9 setores, 3 passos */
import type { Metadata } from 'next'
import Link from 'next/link'
import { ClipboardList, Map, Leaf, Sprout, Star, Heart, Users2, Activity, Palette, BookOpen, Briefcase, HandHeart } from 'lucide-react'
import Navbar from '../components/marketing/Navbar'
import Footer from '../components/marketing/Footer'
import FadeUp from '../components/marketing/FadeUp'
import CtaBand from '../components/marketing/CtaBand'
import { ASSETS, REGISTER_URL } from '../components/marketing/assets'

export const metadata: Metadata = {
  title: 'Para minha casa — FengShui Studio',
  description:
    'Descubra o que cada ambiente da sua casa revela e aprenda, passo a passo, a criar mais harmonia e bem-estar — sem precisar ser especialista.',
}

const setores = [
  { icon: Sprout, n: 'Prosperidade', d: 'Recursos e abundância' },
  { icon: Star, n: 'Fama', d: 'Reconhecimento' },
  { icon: Heart, n: 'Amor', d: 'Relacionamentos' },
  { icon: Users2, n: 'Família', d: 'Harmonia familiar' },
  { icon: Activity, n: 'Saúde', d: 'Bem-estar e vitalidade' },
  { icon: Palette, n: 'Criatividade', d: 'Alegria e expressão' },
  { icon: BookOpen, n: 'Sabedoria', d: 'Estudos e interior' },
  { icon: Briefcase, n: 'Carreira', d: 'Propósito e caminho' },
  { icon: HandHeart, n: 'Amigos', d: 'Apoio e pessoas queridas' },
]

export default function MinhaCasa() {
  return (
    <div className="min-h-screen flex flex-col bg-paper">
      <Navbar />
      <main className="flex-1">
        {/* Hero */}
        <section className="py-16 md:py-24 overflow-hidden">
          <div className="container grid lg:grid-cols-2 gap-12 items-center">
            <FadeUp>
              <p className="eyebrow mb-4">Para você e sua casa</p>
              <h1 className="font-display text-3xl md:text-5xl text-ink leading-[1.15] text-balance">
                Sua casa também fala. <span className="brush-underline">Aprenda a ouvi-la.</span>
              </h1>
              <p className="mt-5 text-lg text-ink/70 leading-relaxed max-w-lg text-pretty">
                Descubra o que cada ambiente revela e aprenda, passo a passo, a criar mais harmonia, bem-estar e leveza no seu dia a dia — sem precisar ser especialista.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-4">
                <Link href={REGISTER_URL} className="inline-flex justify-center items-center rounded-xl bg-jade text-paper font-semibold px-8 py-4 shadow-md hover:brightness-110 active:scale-[0.97] transition-all duration-200">
                  Testar grátis
                </Link>
                <p className="text-sm text-ink/55">Plano Free para sempre</p>
              </div>
            </FadeUp>
            <FadeUp delay={130}>
              <div className="relative">
                <img
                  src={ASSETS.salaHarmonizada || '/placeholder.svg'}
                  alt="Sala de estar acolhedora com plantas, luz natural e materiais orgânicos"
                  className="rounded-2xl shadow-xl w-full"
                  loading="eager"
                />
                <div className="absolute -bottom-5 left-6 bg-paper rounded-xl shadow-lg border border-border px-5 py-4">
                  <p className="text-xs text-ink/60">Sua casa</p>
                  <p className="font-display text-2xl text-jade">7 dos 9 setores em harmonia</p>
                </div>
              </div>
            </FadeUp>
          </div>
        </section>

        {/* 9 setores */}
        <section className="bg-sand py-20 md:py-28 overflow-hidden">
          <div className="container grid lg:grid-cols-[0.95fr_1.05fr] gap-14 items-center">
            <FadeUp>
              <p className="eyebrow mb-4">O mapa da sua casa</p>
              <h2 className="font-display text-3xl md:text-4xl text-ink leading-tight text-balance">
                Nove áreas da vida, nove cantos do <span className="brush-underline">seu lar</span>
              </h2>
              <p className="mt-5 text-ink/65 leading-relaxed max-w-md text-pretty">
                O Ba Guá divide sua casa em nove setores, cada um ligado a uma área da vida. O aplicativo sobrepõe essa grade à sua planta e mostra onde cada setor fica — e como cuidar dele.
              </p>
              <img
                src={ASSETS.heroBagua || '/placeholder.svg'}
                alt="Aplicativo mostrando a grade Ba Guá sobre a planta de uma casa, com scores por setor"
                className="mt-8 rounded-2xl shadow-xl border border-border/70 w-full"
                loading="lazy"
              />
            </FadeUp>
            <div className="grid grid-cols-3 gap-3 md:gap-4">
              {setores.map((s, i) => (
                <FadeUp key={s.n} delay={i * 50}>
                  <div className="bg-paper rounded-xl border border-border/70 p-4 md:p-5 text-center h-full hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                    <s.icon className="h-6 w-6 text-jade mx-auto mb-2" strokeWidth={1.5} />
                    <p className="font-display text-sm md:text-base text-ink">{s.n}</p>
                    <p className="text-[11px] md:text-xs text-ink/55 mt-0.5">{s.d}</p>
                  </div>
                </FadeUp>
              ))}
            </div>
          </div>
        </section>

        {/* 3 passos */}
        <section className="py-20 md:py-28">
          <div className="container">
            <FadeUp className="text-center max-w-2xl mx-auto mb-14">
              <p className="eyebrow mb-4">Como funciona</p>
              <h2 className="font-display text-3xl md:text-4xl text-ink leading-tight text-balance">
                Três passos simples para transformar sua casa
              </h2>
            </FadeUp>
            <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              {[
                { icon: ClipboardList, t: 'Responda o questionário', d: 'Conte sobre sua casa e seus objetivos. É rápido, intuitivo e feito para você.' },
                { icon: Map, t: 'Veja o mapa da sua casa', d: 'Receba seu mapa Ba Guá personalizado e descubra onde estão os desequilíbrios.' },
                { icon: Leaf, t: 'Aplique as curas sugeridas', d: 'Plantas, cores, cristais e pequenos ajustes práticos para sentir a diferença no dia a dia.' },
              ].map((p, i) => (
                <FadeUp key={p.t} delay={i * 90}>
                  <div className="bg-sand/60 rounded-2xl border border-border/70 p-7 text-center h-full">
                    <span className="relative inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-ink text-gold mb-4">
                      <p.icon className="h-6 w-6" strokeWidth={1.5} />
                      <span className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-gold text-ink text-xs font-bold flex items-center justify-center">{i + 1}</span>
                    </span>
                    <h3 className="font-display text-lg text-ink mb-2">{p.t}</h3>
                    <p className="text-sm text-ink/65 leading-relaxed">{p.d}</p>
                  </div>
                </FadeUp>
              ))}
            </div>
            <FadeUp delay={120} className="text-center mt-12">
              <p className="text-ink/60 text-sm">
                Quer ajuda profissional?{' '}
                <Link href="/rede-de-parceiros" className="text-jade font-semibold hover:underline">
                  Encontre um consultor perto de você
                </Link>
                .
              </p>
            </FadeUp>
          </div>
        </section>

        <CtaBand
          title="Descubra o que sua casa está dizendo"
          subtitle="Crie sua conta gratuita, veja o mapa Ba Guá do seu lar e receba as primeiras curas ainda hoje."
          cta="Ver o mapa da minha casa"
        />
      </main>
      <Footer />
    </div>
  )
}
