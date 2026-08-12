/*
 * Design "Chi" — Home: hero ink segmentado + produto vivo, barra de prova,
 * problema→virada, bento recursos, como funciona, ROI, jornada pessoal, FAQ, CTA.
 * Paleta: ink/jade/gold/sand/paper. Fraunces display. Sem roxo, sem emojis.
 */
import Link from 'next/link'
import {
  Compass, FileText, PieChart, Waves, Users, Moon,
  Upload, ClipboardCheck, Send, ArrowRight, Home as HomeIcon, Sparkles,
} from 'lucide-react'
import Navbar from './components/marketing/Navbar'
import Footer from './components/marketing/Footer'
import FadeUp from './components/marketing/FadeUp'
import CtaBand from './components/marketing/CtaBand'
import ChiDivider from './components/marketing/ChiDivider'
import FaqAccordion from './components/marketing/FaqAccordion'
import { ASSETS, REGISTER_URL } from './components/marketing/assets'
import { PRECOS_DOS_PLANOS, formatarCentavos } from '../src/lib/plano-utils'

/** O preço vem de `plano-utils`, que espelha o catálogo do Stripe. */
const PRECO_PROFISSIONAL = formatarCentavos(PRECOS_DOS_PLANOS.profissional.mensalCentavos)

const bento = [
  {
    href: '/recursos/bagua',
    title: 'Análise Ba Guá com planta',
    desc: 'Sobreponha a grade dos 9 setores à planta do imóvel, oriente com a bússola e receba scores automáticos.',
    img: ASSETS.heroBagua,
    icon: Compass,
    big: true,
  },
  {
    href: '/recursos/relatorios',
    title: 'Relatórios PDF com a sua marca',
    desc: 'Entregue um documento premium, com seu logo e recomendações organizadas por setor.',
    img: ASSETS.relatorioPdf,
    icon: FileText,
    big: true,
  },
  {
    href: '/recursos/roda-da-vida',
    title: 'Roda da Vida',
    desc: '12 áreas, 60 perguntas e um radar claro do equilíbrio do seu cliente.',
    img: ASSETS.rodaDaVida,
    icon: PieChart,
    big: false,
  },
  {
    href: '/recursos/roda-da-vida',
    title: 'Fluxo do Chi',
    desc: 'Mapeie o caminho da energia e encontre pontos de estagnação.',
    img: ASSETS.fluxoChi,
    icon: Waves,
    big: false,
  },
  {
    href: '/recursos/relatorios',
    title: 'Clientes & Financeiro',
    desc: 'CRM completo com propostas, status e recebimentos em um só lugar.',
    img: ASSETS.crm,
    icon: Users,
    big: false,
  },
  {
    href: '/recursos/calendario',
    title: 'Calendário Lunar',
    desc: 'Fases da lua e rituais para escolher os melhores períodos.',
    img: ASSETS.calendarioLunar,
    icon: Moon,
    big: false,
  },
]

const faq = [
  {
    q: 'Preciso de cartão de crédito para começar?',
    a: 'Não. O plano Free é gratuito para sempre e não pede cartão. Você cria a conta, cadastra um imóvel e já gera seu primeiro diagnóstico.',
  },
  {
    q: 'O investimento compensa para quem atende poucos clientes?',
    a: 'Uma consultoria de Feng Shui no Brasil custa em média de R$ 350 a R$ 2.000. O plano Profissional custa ${PRECO_PROFISSIONAL}/mês — ou seja, uma única consulta cobre mais de um ano de plataforma, além das horas economizadas em cada relatório.',
  },
  {
    q: 'Funciona no celular?',
    a: 'Sim. A plataforma é um PWA: funciona no navegador do celular e pode ser instalada como aplicativo, incluindo o uso da bússola do próprio aparelho para orientar a planta.',
  },
  {
    q: 'Posso usar sem ser consultor profissional?',
    a: 'Pode. O modo Minha Casa foi feito para quem quer harmonizar o próprio lar: linguagem simples, guia passo a passo e curas práticas por setor.',
  },
  {
    q: 'Meus dados e os dos meus clientes estão protegidos?',
    a: 'Sim. Seguimos a LGPD, usamos criptografia em trânsito (SSL) e isolamento de dados por conta. Pagamentos são processados pela Stripe, líder global em segurança de pagamentos.',
  },
  {
    q: 'Posso cancelar quando quiser?',
    a: 'Sim, o cancelamento é feito em um clique dentro da plataforma, sem fidelidade e sem burocracia. Você mantém acesso até o fim do período pago.',
  },
]

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-paper">
      <Navbar />

      <main id="conteudo" className="flex-1">
        {/* 1. HERO */}
        <section className="relative bg-ink text-paper overflow-hidden">
          <div className="absolute inset-0 bagua-grid-bg" aria-hidden="true" />
          <div
            className="absolute inset-x-0 bottom-0 h-40 opacity-[0.15] bg-cover bg-center"
            style={{ backgroundImage: `url(${ASSETS.sumieMontanhas})` }}
            aria-hidden="true"
          />
          <div className="container relative grid lg:grid-cols-[1.05fr_0.95fr] gap-12 items-center py-16 md:py-24 lg:py-28">
            <div>
              <FadeUp>
                <p className="eyebrow mb-5">A plataforma brasileira de Feng Shui</p>
                <h1 className="font-display text-4xl md:text-5xl lg:text-[3.4rem] leading-[1.12] text-paper text-balance">
                  Do diagnóstico ao relatório: sua consultoria de Feng Shui em{' '}
                  <span className="brush-underline">uma tarde</span>
                </h1>
                <p className="mt-6 text-lg text-paper/75 max-w-xl leading-relaxed">
                  Análise Ba Guá sobre a planta, Roda da Vida, curas por setor e relatórios profissionais com a sua marca — tudo em um só lugar.
                </p>
                <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-4">
                  <Link
                    href={REGISTER_URL}
                    className="inline-flex justify-center items-center rounded-xl bg-jade text-paper text-base font-semibold px-8 py-4 shadow-lg hover:brightness-110 active:scale-[0.97] transition-all duration-200"
                  >
                    Começar grátis
                  </Link>
                  <Link
                    href="/recursos"
                    className="inline-flex justify-center items-center rounded-xl border border-paper/25 text-paper/90 text-base font-medium px-8 py-4 hover:bg-paper/10 active:scale-[0.97] transition-all duration-200"
                  >
                    Conhecer os recursos
                  </Link>
                </div>
                <p className="mt-3 text-sm text-paper/55">Sem cartão · Plano Free para sempre</p>

                <div className="mt-9 flex flex-wrap gap-3">
                  <Link
                    href="/para-consultores"
                    className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 text-gold text-sm font-medium px-4 py-2 hover:bg-gold/20 transition-colors"
                  >
                    <Sparkles className="h-4 w-4" /> Sou consultor(a)
                  </Link>
                  <Link
                    href="/minha-casa"
                    className="inline-flex items-center gap-2 rounded-full border border-paper/25 bg-paper/5 text-paper/85 text-sm font-medium px-4 py-2 hover:bg-paper/15 transition-colors"
                  >
                    <HomeIcon className="h-4 w-4" /> Quero harmonizar minha casa
                  </Link>
                </div>
              </FadeUp>
            </div>
            <FadeUp delay={150}>
              <div className="relative">
                <div className="absolute -inset-6 bg-jade/20 blur-3xl rounded-full" aria-hidden="true" />
                <img
                  src={ASSETS.heroBagua || '/placeholder.svg'}
                  alt="Tela da análise Ba Guá: planta baixa com a grade de 9 setores e scores por área"
                  className="relative rounded-2xl shadow-2xl border border-paper/10 w-full"
                  loading="eager"
                />
              </div>
            </FadeUp>
          </div>
        </section>

        {/* 2. BARRA DE PROVA */}
        <section className="bg-sand border-b border-border/50">
          <div className="container py-6 flex flex-wrap items-center justify-center gap-x-12 gap-y-3 text-center">
            {[
              ['500+', 'consultores na plataforma'],
              ['2.000+', 'consultas realizadas'],
              ['9', 'setores analisados por imóvel'],
            ].map(([n, l]) => (
              <p key={l} className="text-ink">
                <span className="font-display text-3xl md:text-4xl text-jade">{n}</span>{' '}
                <span className="text-sm text-ink/70 block md:inline md:ml-1">{l}</span>
              </p>
            ))}
          </div>
        </section>

        {/* 3. PROBLEMA → VIRADA */}
        <section className="py-20 md:py-28">
          <div className="container grid md:grid-cols-2 gap-12 items-center">
            <FadeUp>
              <p className="eyebrow mb-4">O antes e o depois</p>
              <h2 className="font-display text-3xl md:text-4xl leading-tight text-ink text-balance">
                Você ainda entrega sua consultoria em planilhas e documentos soltos?
              </h2>
              <p className="mt-5 text-ink/70 leading-relaxed">
                Horas montando relatórios no Word, mapas desenhados à mão, anotações espalhadas. O FengShui Studio transforma esse processo: você faz o diagnóstico guiado na plataforma e entrega um relatório impecável, com a sua marca, no mesmo dia.
              </p>
              <ul className="mt-7 space-y-3">
                {[
                  'Diagnóstico guiado dos 9 setores com 8 critérios cada',
                  'Recomendações organizadas por prioridade: urgente, melhoria e manutenção',
                  'Relatório PDF profissional gerado em um clique',
                ].map((t) => (
                  <li key={t} className="flex items-start gap-3 text-ink/80">
                    <span className="mt-1.5 h-2 w-2 rounded-full bg-gold shrink-0" aria-hidden="true" />
                    {t}
                  </li>
                ))}
              </ul>
            </FadeUp>
            <FadeUp delay={120}>
              <div className="relative flex justify-center">
                <img
                  src={ASSETS.relatorioPdf || '/placeholder.svg'}
                  alt="Capa do relatório de consultoria Feng Shui em PDF com a marca do consultor"
                  className="rounded-2xl shadow-xl max-h-[520px] w-auto"
                  loading="lazy"
                />
              </div>
            </FadeUp>
          </div>
        </section>

        {/* 4. BENTO RECURSOS */}
        <section className="bg-sand py-20 md:py-28">
          <div className="container">
            <FadeUp className="grid md:grid-cols-[1fr_auto] items-end gap-6 mb-14">
              <div>
                <p className="eyebrow mb-4">Recursos</p>
                <h2 className="font-display text-3xl md:text-4xl text-ink leading-tight max-w-xl text-balance">
                  Tudo o que sua consultoria precisa, em um só lugar
                </h2>
              </div>
              <Link href="/recursos" className="hidden md:inline-flex items-center gap-1.5 text-sm font-semibold text-jade hover:underline pb-1">
                Ver todos os recursos <ArrowRight className="h-4 w-4" />
              </Link>
            </FadeUp>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
              {bento.map((b, i) => (
                <FadeUp key={b.title} delay={i * 60} className={b.big ? 'lg:col-span-2' : ''}>
                  <Link
                    href={b.href}
                    className="group block h-full bg-paper rounded-2xl border border-border/70 p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-jade/10 text-jade">
                        <b.icon className="h-5 w-5" strokeWidth={1.5} />
                      </span>
                      <h3 className="font-display text-lg text-ink">{b.title}</h3>
                    </div>
                    <p className="text-sm text-ink/65 leading-relaxed mb-4">{b.desc}</p>
                    <div className={`overflow-hidden rounded-xl border border-border/60 bg-sand ${b.big ? 'aspect-[2/1]' : 'aspect-[3/2]'}`}>
                      <img
                        src={b.img || '/placeholder.svg'}
                        alt=""
                        className="w-full h-full object-cover object-top group-hover:scale-[1.02] transition-transform duration-300"
                        loading="lazy"
                      />
                    </div>
                    <p className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-jade">
                      Explorar <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                    </p>
                  </Link>
                </FadeUp>
              ))}
            </div>
          </div>
        </section>

        {/* 5. COMO FUNCIONA */}
        <section className="py-20 md:py-28 overflow-hidden">
          <div className="container grid lg:grid-cols-[0.9fr_1.1fr] gap-14 items-center">
            <div>
              <FadeUp>
                <p className="eyebrow mb-4">Como funciona</p>
                <h2 className="font-display text-3xl md:text-4xl text-ink leading-tight">
                  Três passos, um fluxo <span className="brush-underline">contínuo</span>
                </h2>
              </FadeUp>
              <div className="mt-10 relative">
                <span className="absolute left-[27px] top-3 bottom-3 w-px bg-gradient-to-b from-gold/70 via-jade/40 to-transparent" aria-hidden="true" />
                {[
                  { icon: Upload, t: 'Cadastre o imóvel', d: 'Envie a planta baixa (ou use o modo sem planta), oriente com a bússola e defina o centro Tai Ji.' },
                  { icon: ClipboardCheck, t: 'Diagnostique os 9 setores', d: 'Avalie cada guá com 8 critérios objetivos e receba scores e recomendações automáticas.' },
                  { icon: Send, t: 'Entregue com a sua marca', d: 'Gere o relatório PDF personalizado e acompanhe o cliente pelo CRM integrado.' },
                ].map((s, i) => (
                  <FadeUp key={s.t} delay={i * 100} className="relative pl-20 pb-10 last:pb-0">
                    <span className="absolute left-0 top-0 inline-flex h-[54px] w-[54px] items-center justify-center rounded-2xl bg-ink text-gold shadow-md">
                      <s.icon className="h-6 w-6" strokeWidth={1.5} />
                    </span>
                    <p className="font-display text-gold/90 text-sm mb-0.5">Passo {i + 1}</p>
                    <h3 className="font-display text-xl text-ink mb-1.5">{s.t}</h3>
                    <p className="text-sm text-ink/65 leading-relaxed max-w-md">{s.d}</p>
                  </FadeUp>
                ))}
              </div>
            </div>
            <FadeUp delay={120}>
              <div className="relative">
                <img
                  src={ASSETS.fluxoChi || '/placeholder.svg'}
                  alt="Análise do Fluxo do Chi sobre a planta, com score de fluidez e checklist"
                  className="rounded-2xl shadow-2xl border border-border/70 w-full"
                  loading="lazy"
                />
                <img
                  src={ASSETS.relatorioPdf || '/placeholder.svg'}
                  alt=""
                  className="hidden md:block absolute -bottom-10 -left-8 w-36 rounded-xl shadow-xl border border-border/70 rotate-[-4deg]"
                  loading="lazy"
                />
              </div>
            </FadeUp>
          </div>
        </section>

        {/* 6. ROI */}
        <ChiDivider color="var(--ink-900)" />
        <section className="bg-ink bagua-grid-bg text-paper py-16 md:py-20 -mt-px">
          <div className="container grid md:grid-cols-[1fr_auto] gap-10 items-center">
            <FadeUp>
              <p className="eyebrow mb-4">O investimento que se paga</p>
              <h2 className="font-display text-2xl md:text-4xl leading-tight text-paper max-w-2xl text-balance">
                Uma consultoria média custa R$ 700. O plano Profissional custa {PRECO_PROFISSIONAL}/mês.
              </h2>
              <p className="mt-4 text-paper/70 max-w-xl">
                Uma única consulta paga mais de um ano de plataforma — sem contar as horas que você economiza em cada relatório.
              </p>
            </FadeUp>
            <FadeUp delay={120}>
              <div className="text-center bg-paper/5 border border-gold/30 rounded-2xl px-10 py-8">
                <p className="font-display text-6xl text-gold">14×</p>
                <p className="text-sm text-paper/70 mt-2 max-w-[180px]">o valor da mensalidade,<br />em uma única consulta</p>
              </div>
            </FadeUp>
          </div>
        </section>

        {/* 7. SEGUNDA JORNADA — MINHA CASA */}
        <section className="py-20 md:py-28 overflow-hidden">
          <div className="container grid md:grid-cols-2 gap-12 items-center">
            <FadeUp className="order-2 md:order-1">
              <div className="relative">
                <img
                  src={ASSETS.salaHarmonizada || '/placeholder.svg'}
                  alt="Sala de estar clara e harmonizada com plantas e luz natural"
                  className="rounded-2xl shadow-xl w-full"
                  loading="lazy"
                />
                <div className="absolute -bottom-5 -right-4 md:-right-8 bg-paper rounded-xl shadow-lg border border-border px-5 py-4">
                  <p className="text-xs text-ink/60">Sua casa</p>
                  <p className="font-display text-2xl text-jade">7 dos 9 setores em harmonia</p>
                </div>
              </div>
            </FadeUp>
            <FadeUp delay={120} className="order-1 md:order-2">
              <p className="eyebrow mb-4">Para você e sua casa</p>
              <h2 className="font-display text-3xl md:text-4xl text-ink leading-tight">
                Sua casa também fala. <span className="brush-underline">Aprenda a ouvi-la.</span>
              </h2>
              <p className="mt-5 text-ink/70 leading-relaxed max-w-lg">
                Você não precisa ser especialista: o modo Minha Casa guia você pelos 9 setores do seu lar com linguagem simples, mostra onde a energia pede atenção e sugere curas práticas — plantas, cores, cristais e pequenos ajustes.
              </p>
              <Link
                href="/minha-casa"
                className="mt-7 inline-flex items-center gap-2 rounded-xl border-2 border-jade text-jade font-semibold px-6 py-3.5 hover:bg-jade hover:text-paper active:scale-[0.97] transition-all duration-200"
              >
                Conhecer o modo Minha Casa <ArrowRight className="h-4 w-4" />
              </Link>
            </FadeUp>
          </div>
        </section>

        {/* 8. FAQ */}
        <section className="bg-sand py-20 md:py-28">
          <div className="container max-w-3xl">
            <FadeUp className="text-center mb-12">
              <p className="eyebrow mb-4">Perguntas frequentes</p>
              <h2 className="font-display text-3xl md:text-4xl text-ink">Antes de começar</h2>
            </FadeUp>
            <FadeUp delay={100}>
              <FaqAccordion items={faq} />
            </FadeUp>
          </div>
        </section>

        {/* 9. CTA FINAL */}
        <CtaBand
          title="Sua próxima consultoria pode nascer aqui"
          subtitle="Crie sua conta gratuita, cadastre um imóvel e gere seu primeiro diagnóstico Ba Guá ainda hoje."
        />
      </main>
      <Footer />
    </div>
  )
}
