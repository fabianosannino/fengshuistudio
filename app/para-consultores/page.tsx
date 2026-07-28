'use client'

/* Design "Chi": página de persona — consultores & arquitetos, com calculadora de ROI */
import { useState } from 'react'
import Link from 'next/link'
import { Clock, BadgeCheck, Store, Network, ArrowRight } from 'lucide-react'
import Navbar from '../components/marketing/Navbar'
import Footer from '../components/marketing/Footer'
import FadeUp from '../components/marketing/FadeUp'
import CtaBand from '../components/marketing/CtaBand'
import { ASSETS, REGISTER_URL } from '../components/marketing/assets'

export default function ParaConsultores() {
  const [consultas, setConsultas] = useState(4)
  const [ticket, setTicket] = useState(700)
  const receitaMes = consultas * ticket
  const custoAno = 49 * 12
  const horasEconomizadas = consultas * 5

  return (
    <div className="min-h-screen flex flex-col bg-paper">
      <Navbar />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative bg-ink bagua-grid-bg text-paper overflow-hidden">
          <div className="container grid lg:grid-cols-2 gap-12 items-center py-16 md:py-24">
            <FadeUp>
              <p className="eyebrow mb-4">Para consultores & arquitetos</p>
              <h1 className="font-display text-3xl md:text-5xl leading-[1.15] text-balance">
                Menos horas no Word. Mais tempo fazendo o que só <span className="brush-underline">você</span> sabe fazer.
              </h1>
              <p className="mt-5 text-lg text-paper/75 max-w-xl leading-relaxed text-pretty">
                Relatórios que tomavam o fim de semana ficam prontos em minutos. Diagnósticos padronizados que sustentam honorários maiores. E uma vitrine para ser encontrado por novos clientes.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-4">
                <Link href={REGISTER_URL} className="inline-flex justify-center items-center rounded-xl bg-jade text-paper font-semibold px-8 py-4 shadow-lg hover:brightness-110 active:scale-[0.97] transition-all duration-200">
                  Começar grátis
                </Link>
                <p className="text-sm text-paper/55">Sem cartão · Plano Free para sempre</p>
              </div>
            </FadeUp>
            <FadeUp delay={130}>
              <img
                src={ASSETS.consultora || '/placeholder.svg'}
                alt="Consultora de Feng Shui analisando uma planta baixa em seu estúdio"
                className="rounded-2xl shadow-2xl border border-paper/10 w-full"
                loading="eager"
              />
            </FadeUp>
          </div>
        </section>

        {/* Dores → soluções */}
        <section className="py-20 md:py-28 overflow-hidden">
          <div className="container grid lg:grid-cols-[1.1fr_0.9fr] gap-14 items-center">
            <div>
              <FadeUp>
                <p className="eyebrow mb-4">O que muda na prática</p>
                <h2 className="font-display text-3xl md:text-4xl text-ink leading-tight max-w-lg text-balance">
                  Feito para a rotina de <span className="brush-underline">quem atende</span>
                </h2>
              </FadeUp>
              <div className="mt-10 space-y-8">
                {[
                  { icon: Clock, t: 'De 6 horas para 40 minutos', d: 'O diagnóstico guiado e o relatório automático devolvem suas noites e fins de semana.' },
                  { icon: BadgeCheck, t: 'Entrega que justifica honorários', d: 'Um documento premium com a sua marca eleva a percepção de valor da consultoria.' },
                  { icon: Store, t: 'Nova fonte de receita', d: 'Venda kits, cursos e atendimentos na sua loja própria, com pagamentos via Stripe.' },
                  { icon: Network, t: 'Seja encontrado', d: 'Apareça na rede de parceiros e receba contatos de clientes da sua região.' },
                ].map((c, i) => (
                  <FadeUp key={c.t} delay={i * 70} className="flex items-start gap-5">
                    <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-ink text-gold">
                      <c.icon className="h-5 w-5" strokeWidth={1.5} />
                    </span>
                    <div>
                      <h3 className="font-display text-xl text-ink mb-1">{c.t}</h3>
                      <p className="text-sm text-ink/65 leading-relaxed max-w-md">{c.d}</p>
                    </div>
                  </FadeUp>
                ))}
              </div>
            </div>
            <FadeUp delay={120}>
              <div className="relative">
                <img
                  src={ASSETS.crm || '/placeholder.svg'}
                  alt="Painel de clientes e financeiro do FengShui Studio, com status e recebimentos"
                  className="rounded-2xl shadow-2xl border border-border/70 w-full"
                  loading="lazy"
                />
                <img
                  src={ASSETS.relatorioPdf || '/placeholder.svg'}
                  alt=""
                  className="hidden md:block absolute -bottom-12 -right-6 w-40 rounded-xl shadow-xl border border-border/70 rotate-[5deg]"
                  loading="lazy"
                />
              </div>
            </FadeUp>
          </div>
        </section>

        {/* Calculadora ROI */}
        <section className="bg-ink bagua-grid-bg text-paper py-20 md:py-28">
          <div className="container max-w-4xl">
            <FadeUp className="text-center mb-12">
              <p className="eyebrow mb-4">Calculadora de retorno</p>
              <h2 className="font-display text-3xl md:text-4xl leading-tight">Quanto o seu tempo vale?</h2>
            </FadeUp>
            <FadeUp delay={80}>
              <div className="bg-paper/5 border border-paper/15 rounded-2xl p-8 md:p-10 grid md:grid-cols-2 gap-10">
                <div className="space-y-8">
                  <div>
                    <div className="flex justify-between text-sm mb-3">
                      <label htmlFor="sl-consultas" className="text-paper/80">Consultas por mês</label>
                      <span className="font-display text-xl text-gold">{consultas}</span>
                    </div>
                    <input
                      id="sl-consultas"
                      type="range"
                      min={1}
                      max={20}
                      step={1}
                      value={consultas}
                      onChange={(e) => setConsultas(Number(e.target.value))}
                      className="chi-range w-full"
                      aria-label="Número de consultas por mês"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-3">
                      <label htmlFor="sl-ticket" className="text-paper/80">Valor médio da consultoria</label>
                      <span className="font-display text-xl text-gold">R$ {ticket.toLocaleString('pt-BR')}</span>
                    </div>
                    <input
                      id="sl-ticket"
                      type="range"
                      min={200}
                      max={3000}
                      step={50}
                      value={ticket}
                      onChange={(e) => setTicket(Number(e.target.value))}
                      className="chi-range w-full"
                      aria-label="Valor médio da consultoria em reais"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <div className="rounded-xl bg-paper/5 border border-gold/30 px-6 py-4 flex items-baseline justify-between">
                    <p className="text-sm text-paper/70">Receita mensal estimada</p>
                    <p className="font-display text-2xl text-gold">R$ {receitaMes.toLocaleString('pt-BR')}</p>
                  </div>
                  <div className="rounded-xl bg-paper/5 border border-paper/15 px-6 py-4 flex items-baseline justify-between">
                    <p className="text-sm text-paper/70">Horas economizadas/mês</p>
                    <p className="font-display text-2xl text-jade-300">≈ {horasEconomizadas}h</p>
                  </div>
                  <div className="rounded-xl bg-paper/5 border border-paper/15 px-6 py-4 flex items-baseline justify-between">
                    <p className="text-sm text-paper/70">Plataforma no ano</p>
                    <p className="font-display text-2xl text-paper">R$ {custoAno.toLocaleString('pt-BR')}</p>
                  </div>
                  <p className="text-xs text-paper/50 leading-relaxed">
                    Estimativa com base em 5h economizadas por consulta e plano Profissional mensal (R$ 49). A sua primeira consulta do ano já cobre {Math.floor((ticket / custoAno) * 100)}% do custo anual.
                  </p>
                </div>
              </div>
            </FadeUp>
          </div>
        </section>

        {/* Arquitetos */}
        <section className="py-20 md:py-28">
          <div className="container grid md:grid-cols-2 gap-12 items-center">
            <FadeUp>
              <p className="eyebrow mb-4">Arquitetos & decoradores</p>
              <h2 className="font-display text-3xl md:text-4xl text-ink leading-tight text-balance">
                O diferencial técnico que seus projetos pediam
              </h2>
              <p className="mt-5 text-ink/70 leading-relaxed max-w-lg text-pretty">
                Integre o Feng Shui ao seu processo de projeto com rigor: análise sobre a planta real, orientação precisa e um relatório que se soma ao seu caderno de apresentação. Um argumento a mais para fechar o projeto — e um cuidado que o cliente sente.
              </p>
              <Link href="/recursos/bagua" className="mt-7 inline-flex items-center gap-2 rounded-xl border-2 border-jade text-jade font-semibold px-6 py-3.5 hover:bg-jade hover:text-paper active:scale-[0.97] transition-all duration-200">
                Ver a análise sobre a planta <ArrowRight className="h-4 w-4" />
              </Link>
            </FadeUp>
            <FadeUp delay={110}>
              <img
                src={ASSETS.heroBagua || '/placeholder.svg'}
                alt="Análise Ba Guá aplicada sobre planta arquitetônica"
                className="rounded-2xl shadow-xl border border-border/70 w-full"
                loading="lazy"
              />
            </FadeUp>
          </div>
        </section>

        <CtaBand
          title="Recupere suas horas já na primeira consultoria"
          subtitle="Conta gratuita, diagnóstico guiado e relatório com a sua marca — comece hoje."
          cta="Criar conta de consultor"
        />
      </main>
      <Footer />
    </div>
  )
}
