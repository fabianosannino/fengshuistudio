'use client'

/* Design "Chi": página de preços — toggle mensal/anual, 3 planos (Profissional em destaque),
 * tabela comparativa, banner ROI, selos de confiança, FAQ de compra. */
import { resumoDoPlano, limiteImoveis, limiteClientes, podePDF, podeCalendario, podeParceiros, type PlanoEfetivo } from '../../src/lib/plano-utils'
import { useState } from 'react'
import Link from 'next/link'
import { Check, Minus, Lock, ShieldCheck, CreditCard, RotateCcw } from 'lucide-react'
import Navbar from '../components/marketing/Navbar'
import Footer from '../components/marketing/Footer'
import FadeUp from '../components/marketing/FadeUp'
import CtaBand from '../components/marketing/CtaBand'
import FaqAccordion from '../components/marketing/FaqAccordion'
import { ASSETS, REGISTER_URL } from '../components/marketing/assets'

/**
 * A tabela de preços é um contrato: cada linha aqui é uma promessa. Ela passou
 * a ser gerada de `plano-utils` porque as duas divergiram — a página prometia
 * «Relatório com marca d'água» ao Free enquanto `podePDF('free')` devolvia
 * 'bloqueado', e anunciava 1 imóvel no Simples (pago) contra 3 no Free.
 */
function textoLimite(plano: PlanoEfetivo, recurso: 'imoveis' | 'clientes'): string | boolean {
  const limite = recurso === 'imoveis' ? limiteImoveis(plano) : limiteClientes(plano)
  if (limite === null) return 'Ilimitados'
  if (limite === 0) return false
  return String(limite)
}

function textoPDF(plano: PlanoEfetivo): string | boolean {
  const modo = podePDF(plano)
  if (modo === 'limpo') return 'Com a sua marca'
  if (modo === 'marca_dagua') return "Com marca d'água"
  return false
}

const planos = (anual: boolean) => [
  {
    nome: 'Free',
    preco: 'R$ 0',
    sufixo: '/mês',
    desc: 'Para experimentar e dar os primeiros passos.',
    destaque: false,
    features: resumoDoPlano('free'),
    cta: 'Começar grátis',
  },
  {
    nome: 'Profissional',
    preco: anual ? 'R$ 40,83' : 'R$ 49',
    sufixo: anual ? '/mês no plano anual' : '/mês',
    desc: 'Para consultores que atendem clientes.',
    destaque: true,
    features: [
      ...resumoDoPlano('profissional'),
      'CRM e controle financeiro',
      'Loja própria com Stripe',
      'Suporte prioritário',
    ],
    cta: 'Assinar Profissional',
  },
  {
    nome: 'Simples',
    preco: anual ? 'R$ 16,67' : 'R$ 20',
    sufixo: anual ? '/mês no plano anual' : '/mês',
    desc: 'Para uso pessoal, na sua própria casa.',
    destaque: false,
    features: resumoDoPlano('simples'),
    cta: 'Assinar Simples',
  },
]

const comparativo: { label: string; free: string | boolean; pro: string | boolean; simples: string | boolean }[] = [
  { label: 'Imóveis ativos', free: textoLimite('free', 'imoveis'), pro: textoLimite('profissional', 'imoveis'), simples: textoLimite('simples', 'imoveis') },
  { label: 'Clientes no CRM', free: textoLimite('free', 'clientes'), pro: textoLimite('profissional', 'clientes'), simples: textoLimite('simples', 'clientes') },
  { label: 'Análise Ba Guá com planta', free: true, pro: true, simples: true },
  { label: 'Roda da Vida (12 áreas)', free: true, pro: true, simples: true },
  { label: 'Fluxo do Chi', free: true, pro: true, simples: true },
  { label: 'Relatório PDF', free: textoPDF('free'), pro: textoPDF('profissional'), simples: textoPDF('simples') },
  { label: 'Calendário lunar com rituais', free: podeCalendario('free'), pro: podeCalendario('profissional'), simples: podeCalendario('simples') },
  { label: 'Curas e ativações por setor', free: true, pro: true, simples: true },
  { label: 'Controle financeiro', free: false, pro: true, simples: false },
  { label: 'Loja própria (Stripe)', free: false, pro: true, simples: false },
  { label: 'Rede de parceiros', free: podeParceiros('free') !== 'bloqueado', pro: podeParceiros('profissional') !== 'bloqueado', simples: podeParceiros('simples') !== 'bloqueado' },
  { label: 'Suporte prioritário', free: false, pro: true, simples: false },
]

const faqCompra = [
  { q: 'Posso cancelar quando quiser?', a: 'Sim. O cancelamento é feito em um clique, sem fidelidade. Você mantém o acesso até o fim do período já pago.' },
  { q: 'Como funciona o plano anual?', a: 'No plano anual você paga o equivalente a 10 meses e usa 12 — dois meses grátis em relação ao mensal.' },
  { q: 'Quais formas de pagamento são aceitas?', a: 'Cartão de crédito, processado com segurança pela Stripe. Não armazenamos os dados do seu cartão.' },
  { q: 'Posso mudar de plano depois?', a: 'Sim, o upgrade ou downgrade é imediato e o valor é ajustado proporcionalmente.' },
  { q: 'Meus dados estão protegidos?', a: 'Sim. Seguimos a LGPD, com criptografia em trânsito e isolamento de dados por conta.' },
]

function Cell({ v }: { v: string | boolean }) {
  if (v === true) return <Check className="h-4 w-4 text-jade mx-auto" aria-label="Incluído" />
  if (v === false) return <Minus className="h-4 w-4 text-ink/25 mx-auto" aria-label="Não incluído" />
  return <span className="text-ink/75 text-sm">{v}</span>
}

export default function Precos() {
  const [anual, setAnual] = useState(false)
  const lista = planos(anual)

  return (
    <div className="min-h-screen flex flex-col bg-paper">
      <Navbar />
      <main className="flex-1">
        <section className="pt-16 md:pt-24 pb-10 text-center">
          <div className="container max-w-3xl">
            <FadeUp>
              <p className="eyebrow mb-4">Preços</p>
              <h1 className="font-display text-3xl md:text-5xl text-ink leading-[1.15] text-balance">
                Comece grátis. Cresça quando <span className="brush-underline">fizer sentido</span>.
              </h1>
              <div className="mt-8 inline-flex items-center gap-3 text-sm">
                <span className={anual ? 'text-ink/60' : 'font-semibold text-ink'}>Mensal</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={anual}
                  aria-label="Alternar entre plano mensal e anual"
                  onClick={() => setAnual((v) => !v)}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${anual ? 'bg-jade' : 'bg-ink/20'}`}
                >
                  <span
                    className={`inline-block h-5 w-5 rounded-full bg-paper shadow transition-transform ${anual ? 'translate-x-5' : 'translate-x-0.5'}`}
                  />
                </button>
                <span className={anual ? 'font-semibold text-ink' : 'text-ink/60'}>
                  Anual <span className="text-jade font-semibold">(2 meses grátis)</span>
                </span>
              </div>
            </FadeUp>
          </div>
        </section>

        <section className="pb-16">
          <div className="container grid md:grid-cols-3 gap-6 max-w-5xl items-stretch">
            {lista.map((p, i) => (
              <FadeUp key={p.nome} delay={i * 80} className={p.destaque ? 'md:-mt-4' : ''}>
                <div
                  className={`relative flex flex-col h-full rounded-2xl p-7 ${
                    p.destaque ? 'bg-paper border-2 border-gold shadow-xl' : 'bg-sand/60 border border-border/70'
                  }`}
                >
                  {p.destaque && (
                    <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gold text-ink text-xs font-bold px-4 py-1.5 shadow-sm">
                      Mais escolhido
                    </span>
                  )}
                  <h2 className="font-display text-2xl text-ink">{p.nome}</h2>
                  <p className="mt-1 text-sm text-ink/60">{p.desc}</p>
                  <p className="mt-5">
                    <span className="font-display text-4xl text-ink">{p.preco}</span>{' '}
                    <span className="text-sm text-ink/60">{p.sufixo}</span>
                  </p>
                  <ul className="mt-6 space-y-2.5 flex-1">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-ink/80">
                        <Check className="h-4 w-4 text-jade mt-0.5 shrink-0" strokeWidth={2.5} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={REGISTER_URL}
                    className={`mt-7 inline-flex justify-center rounded-xl font-semibold px-6 py-3.5 active:scale-[0.97] transition-all duration-200 ${
                      p.destaque
                        ? 'bg-jade text-paper shadow-md hover:brightness-110'
                        : 'border-2 border-ink/15 text-ink hover:border-jade hover:text-jade'
                    }`}
                  >
                    {p.cta}
                  </Link>
                  {p.nome === 'Free' && <p className="mt-2.5 text-center text-xs text-ink/55">Sem cartão de crédito</p>}
                </div>
              </FadeUp>
            ))}
          </div>
        </section>

        {/* ROI banner */}
        <section className="bg-ink bagua-grid-bg text-paper py-14">
          <div className="container max-w-4xl grid md:grid-cols-[1fr_auto] gap-8 items-center">
            <FadeUp>
              <h2 className="font-display text-2xl md:text-3xl leading-tight text-balance">
                Uma única consultoria paga mais de um ano de plataforma
              </h2>
              <p className="mt-3 text-paper/70">
                Consultorias de Feng Shui no Brasil custam de R$ 350 a R$ 2.000 ou mais. Com o Profissional a R$ 49/mês, o retorno chega já no primeiro cliente.
              </p>
            </FadeUp>
            <FadeUp delay={100}>
              <div className="text-center border border-gold/40 bg-gold/10 rounded-2xl px-8 py-6">
                <p className="font-display text-5xl text-gold">14×</p>
                <p className="text-xs text-paper/70 mt-1">retorno por consulta média</p>
              </div>
            </FadeUp>
          </div>
        </section>

        {/* Tabela comparativa */}
        <section className="py-16 md:py-24">
          <div className="container max-w-4xl">
            <FadeUp className="text-center mb-10">
              <p className="eyebrow mb-3">Compare</p>
              <h2 className="font-display text-2xl md:text-3xl text-ink">Tudo que cada plano inclui</h2>
            </FadeUp>
            <FadeUp delay={80}>
              <div className="overflow-x-auto rounded-2xl border border-border/70 shadow-sm">
                <table className="w-full text-sm bg-paper">
                  <thead>
                    <tr className="bg-ink text-paper">
                      <th className="text-left font-sans font-semibold px-5 py-4">Funcionalidade</th>
                      <th className="font-sans font-semibold px-4 py-4 w-28">Free</th>
                      <th className="font-sans font-semibold px-4 py-4 w-36 text-gold">Profissional</th>
                      <th className="font-sans font-semibold px-4 py-4 w-28">Simples</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparativo.map((r, i) => (
                      <tr key={r.label} className={i % 2 === 1 ? 'bg-sand/50' : ''}>
                        <td className="px-5 py-3.5 font-medium text-ink">{r.label}</td>
                        <td className="px-4 py-3.5 text-center">
                          <Cell v={r.free} />
                        </td>
                        <td className="px-4 py-3.5 text-center bg-gold/5">
                          <Cell v={r.pro} />
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <Cell v={r.simples} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </FadeUp>
            <FadeUp delay={120}>
              <div className="mt-8 flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm text-ink/60">
                <span className="inline-flex items-center gap-2"><CreditCard className="h-4 w-4 text-jade" /> Pagamento seguro via Stripe</span>
                <span className="inline-flex items-center gap-2"><Lock className="h-4 w-4 text-jade" /> Criptografia SSL</span>
                <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-jade" /> Conformidade LGPD</span>
                <span className="inline-flex items-center gap-2"><RotateCcw className="h-4 w-4 text-jade" /> Cancele em 1 clique</span>
              </div>
            </FadeUp>
          </div>
        </section>

        {/* FAQ de compra */}
        <section className="bg-sand py-16 md:py-24">
          <div className="container max-w-3xl">
            <FadeUp className="text-center mb-10">
              <p className="eyebrow mb-3">FAQ</p>
              <h2 className="font-display text-2xl md:text-3xl text-ink">Dúvidas sobre planos e pagamento</h2>
            </FadeUp>
            <FadeUp delay={80}>
              <FaqAccordion items={faqCompra} />
            </FadeUp>
          </div>
        </section>

        {/* Artefato do produto antes do CTA final */}
        <section className="py-16 md:py-24 overflow-hidden">
          <div className="container grid lg:grid-cols-[0.9fr_1.1fr] gap-12 items-center max-w-5xl">
            <FadeUp>
              <p className="eyebrow mb-4">O que você recebe</p>
              <h2 className="font-display text-2xl md:text-4xl text-ink leading-tight text-balance">
                Cada plano entrega o diagnóstico <span className="brush-underline">completo</span>
              </h2>
              <p className="mt-4 text-ink/70 leading-relaxed max-w-md text-pretty">
                Do Free ao Profissional, a análise Ba Guá sobre a planta, a Roda da Vida e as curas por setor estão sempre incluídas. O que muda é a escala — e a marca no relatório.
              </p>
            </FadeUp>
            <FadeUp delay={110}>
              <div className="relative">
                <img
                  src={ASSETS.heroBagua || '/placeholder.svg'}
                  alt="Análise Ba Guá sobre a planta com scores por setor"
                  className="rounded-2xl shadow-2xl border border-border/70 w-full"
                  loading="lazy"
                />
                <img
                  src={ASSETS.rodaDaVida || '/placeholder.svg'}
                  alt=""
                  className="hidden md:block absolute -bottom-10 -left-10 w-52 rounded-xl shadow-xl border border-border/70 rotate-[-3deg]"
                  loading="lazy"
                />
              </div>
            </FadeUp>
          </div>
        </section>

        <CtaBand title="Comece hoje, sem risco" subtitle="Plano Free para sempre, sem cartão. Faça o upgrade só quando a sua agenda pedir." cta="Criar conta gratuita" />
      </main>
      <Footer />
    </div>
  )
}
