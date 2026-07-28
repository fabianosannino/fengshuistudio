/* Design "Chi": rede de parceiros — página institucional pública que explica
 * o funcionamento e leva à busca real de consultores na área logada. */
import type { Metadata } from 'next'
import Link from 'next/link'
import { MapPin, Search, BadgeCheck, MessageCircle } from 'lucide-react'
import Navbar from '../components/marketing/Navbar'
import Footer from '../components/marketing/Footer'
import FadeUp from '../components/marketing/FadeUp'
import CtaBand from '../components/marketing/CtaBand'
import { ASSETS, REGISTER_URL } from '../components/marketing/assets'

export const metadata: Metadata = {
  title: 'Rede de parceiros — FengShui Studio',
  description:
    'Encontre um consultor de Feng Shui perto de você. Consultores profissionais em todo o Brasil, com perfil, especialidades e contato direto.',
}

export default function RedeDeParceiros() {
  return (
    <div className="min-h-screen flex flex-col bg-paper">
      <Navbar />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative bg-ink bagua-grid-bg text-paper py-16 md:py-24 overflow-hidden">
          <div
            className="absolute inset-x-0 bottom-0 h-32 opacity-[0.14] bg-cover bg-center"
            style={{ backgroundImage: `url(${ASSETS.sumieMontanhas})` }}
            aria-hidden="true"
          />
          <div className="container relative max-w-3xl text-center">
            <FadeUp>
              <p className="eyebrow mb-4">Rede de parceiros</p>
              <h1 className="font-display text-3xl md:text-5xl leading-[1.15] text-balance">
                Encontre um consultor de Feng Shui <span className="brush-underline">perto de você</span>
              </h1>
              <p className="mt-5 text-lg text-paper/70 text-pretty">
                A rede reúne consultores profissionais que usam o FengShui Studio em todo o Brasil — com perfil, especialidades e contato direto.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4">
                <Link
                  href="/consultores"
                  className="inline-flex justify-center items-center gap-2 rounded-xl bg-jade text-paper font-semibold px-7 py-3.5 shadow-lg hover:brightness-110 active:scale-[0.97] transition-all duration-200"
                >
                  <Search className="h-4 w-4" /> Buscar consultores
                </Link>
                <Link
                  href={REGISTER_URL}
                  className="inline-flex justify-center items-center rounded-xl border border-paper/25 text-paper/90 font-medium px-7 py-3.5 hover:bg-paper/10 active:scale-[0.97] transition-all duration-200"
                >
                  Sou consultor: quero aparecer aqui
                </Link>
              </div>
            </FadeUp>
          </div>
        </section>

        {/* Como funciona a busca */}
        <section className="py-20 md:py-28 overflow-hidden">
          <div className="container grid lg:grid-cols-[1.05fr_0.95fr] gap-14 items-center">
            <div>
              <FadeUp>
                <p className="eyebrow mb-4">Como funciona</p>
                <h2 className="font-display text-3xl md:text-4xl text-ink leading-tight max-w-lg text-balance">
                  Da busca ao primeiro contato, em <span className="brush-underline">três passos</span>
                </h2>
              </FadeUp>
              <div className="mt-10 relative">
                <span className="absolute left-[27px] top-3 bottom-3 w-px bg-gradient-to-b from-gold/70 via-jade/40 to-transparent" aria-hidden="true" />
                {[
                  { icon: MapPin, t: 'Busque por região', d: 'Filtre por estado e cidade para encontrar consultores que atendem na sua área — presencialmente ou on-line.' },
                  { icon: BadgeCheck, t: 'Compare perfis', d: 'Veja especialidades, formação e o jeito de trabalhar de cada profissional antes de escolher.' },
                  { icon: MessageCircle, t: 'Fale direto', d: 'Entre em contato pelo WhatsApp ou e-mail do consultor, sem intermediários e sem custo.' },
                ].map((p, i) => (
                  <FadeUp key={p.t} delay={i * 90} className="relative pl-20 pb-10 last:pb-0">
                    <span className="absolute left-0 top-0 inline-flex h-[54px] w-[54px] items-center justify-center rounded-2xl bg-ink text-gold shadow-md">
                      <p.icon className="h-6 w-6" strokeWidth={1.5} />
                    </span>
                    <p className="font-display text-gold/90 text-sm mb-0.5">Passo {i + 1}</p>
                    <h3 className="font-display text-xl text-ink mb-1.5">{p.t}</h3>
                    <p className="text-sm text-ink/65 leading-relaxed max-w-md">{p.d}</p>
                  </FadeUp>
                ))}
              </div>
            </div>
            <FadeUp delay={120}>
              <div className="relative">
                <img
                  src={ASSETS.heroBagua || '/placeholder.svg'}
                  alt="Diagnóstico Ba Guá que os consultores da rede entregam aos clientes"
                  className="rounded-2xl shadow-2xl border border-border/70 w-full"
                  loading="lazy"
                />
                <div className="absolute -bottom-6 -left-4 md:-left-8 bg-paper rounded-xl shadow-lg border border-border px-5 py-4">
                  <p className="text-xs text-ink/60">Consultores usam</p>
                  <p className="font-display text-xl text-jade">diagnóstico padronizado</p>
                </div>
              </div>
            </FadeUp>
          </div>
        </section>

        {/* Para consultores */}
        <section className="bg-sand py-20 md:py-28">
          <div className="container grid md:grid-cols-2 gap-12 items-center">
            <FadeUp>
              <img
                src={ASSETS.consultora || '/placeholder.svg'}
                alt="Consultora de Feng Shui trabalhando em seu estúdio"
                className="rounded-2xl shadow-xl w-full"
                loading="lazy"
              />
            </FadeUp>
            <FadeUp delay={110}>
              <p className="eyebrow mb-4">Para consultores</p>
              <h2 className="font-display text-3xl md:text-4xl text-ink leading-tight text-balance">
                Sua vitrine profissional, incluída no plano
              </h2>
              <p className="mt-5 text-ink/70 leading-relaxed max-w-lg text-pretty">
                Assinantes do plano Profissional podem ativar o perfil público na rede: foto, bio, especialidades, região de atendimento e contato direto. Clientes que chegam ao FengShui Studio procurando ajuda encontram você — sem comissão sobre os seus atendimentos.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  'Perfil completo com especialidades e formação',
                  'Contato direto por WhatsApp e e-mail',
                  'Sem comissão: o cliente é 100% seu',
                ].map((t) => (
                  <li key={t} className="flex items-start gap-3 text-ink/80">
                    <span className="mt-1.5 h-2 w-2 rounded-full bg-gold shrink-0" aria-hidden="true" />
                    {t}
                  </li>
                ))}
              </ul>
              <Link
                href={REGISTER_URL}
                className="mt-8 inline-flex items-center rounded-xl bg-jade text-paper font-semibold px-7 py-3.5 shadow-md hover:brightness-110 active:scale-[0.97] transition-all duration-200"
              >
                Criar meu perfil na rede
              </Link>
            </FadeUp>
          </div>
        </section>

        <CtaBand
          title="Consultor: seja visto em todo o Brasil"
          subtitle="Ative seu perfil na rede de parceiros e receba contatos de clientes da sua região — sem comissão."
          cta="Quero aparecer na rede"
        />
      </main>
      <Footer />
    </div>
  )
}
