/* Design "Chi": Sobre & Contato — missão, valores, canais de contato */
import type { Metadata } from 'next'
import { Compass, Heart, Ruler, Mail, MessageCircle, HelpCircle } from 'lucide-react'
import Navbar from '../components/marketing/Navbar'
import Footer from '../components/marketing/Footer'
import FadeUp from '../components/marketing/FadeUp'
import CtaBand from '../components/marketing/CtaBand'
import { ASSETS } from '../components/marketing/assets'

export const metadata: Metadata = {
  title: 'Sobre & Contato — FengShui Studio',
  description:
    'Tecnologia a serviço de uma sabedoria milenar. Conheça a missão, os valores e os canais de contato do FengShui Studio.',
}

export default function Sobre() {
  return (
    <div className="min-h-screen flex flex-col bg-paper">
      <Navbar />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative py-20 md:py-28 bg-sand overflow-hidden">
          <div
            className="absolute inset-0 opacity-40 bg-cover bg-center"
            style={{ backgroundImage: `url(${ASSETS.sumieMontanhas})` }}
            aria-hidden="true"
          />
          <div className="container relative max-w-3xl text-center">
            <FadeUp>
              <p className="eyebrow mb-4">Sobre o FengShui Studio</p>
              <h1 className="font-display text-3xl md:text-5xl text-ink leading-[1.15] text-balance">
                Tecnologia a serviço de uma sabedoria <span className="brush-underline">milenar</span>
              </h1>
              <p className="mt-6 text-lg text-ink/70 leading-relaxed text-pretty">
                Nascemos de uma pergunta simples: por que consultores de Feng Shui ainda passam mais tempo montando documentos do que harmonizando espaços? O FengShui Studio existe para devolver esse tempo — unindo o rigor da análise tradicional à agilidade de uma plataforma pensada para o Brasil.
              </p>
            </FadeUp>
          </div>
        </section>

        {/* Valores */}
        <section className="py-20 md:py-28">
          <div className="container">
            <FadeUp className="text-center max-w-2xl mx-auto mb-14">
              <p className="eyebrow mb-4">O que nos guia</p>
              <h2 className="font-display text-3xl md:text-4xl text-ink leading-tight text-balance">Três princípios, um compromisso</h2>
            </FadeUp>
            <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              {[
                { icon: Compass, t: 'Fidelidade à tradição', d: 'O Ba Guá, os cinco elementos e o fluxo do Chi são tratados com o respeito e o rigor que as escolas clássicas ensinam.' },
                { icon: Ruler, t: 'Precisão técnica', d: 'Plantas reais, orientação por bússola e critérios objetivos: o diagnóstico deixa de ser impressão e vira método.' },
                { icon: Heart, t: 'Cuidado com quem usa', d: 'Da consultora experiente a quem está começando pela própria casa, cada tela é desenhada para acolher e simplificar.' },
              ].map((v, i) => (
                <FadeUp key={v.t} delay={i * 90}>
                  <div className="bg-sand/60 rounded-2xl border border-border/70 p-7 text-center h-full">
                    <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-ink text-gold mb-4">
                      <v.icon className="h-6 w-6" strokeWidth={1.5} />
                    </span>
                    <h3 className="font-display text-lg text-ink mb-2">{v.t}</h3>
                    <p className="text-sm text-ink/65 leading-relaxed">{v.d}</p>
                  </div>
                </FadeUp>
              ))}
            </div>
          </div>
        </section>

        {/* Contato */}
        <section className="bg-ink bagua-grid-bg text-paper py-20 md:py-28" id="contato">
          <div className="container max-w-4xl">
            <FadeUp className="text-center mb-12">
              <p className="eyebrow mb-4">Contato</p>
              <h2 className="font-display text-3xl md:text-4xl leading-tight">Vamos conversar</h2>
              <p className="mt-4 text-paper/70">Dúvidas, sugestões ou parcerias — respondemos em até um dia útil.</p>
            </FadeUp>
            <div className="grid sm:grid-cols-3 gap-5">
              {[
                { icon: Mail, t: 'E-mail', d: 'suporte@fengshuistudio.com.br', href: 'mailto:suporte@fengshuistudio.com.br' },
                { icon: MessageCircle, t: 'WhatsApp', d: 'Atendimento comercial', href: 'https://wa.me/5511999999999' },
                { icon: HelpCircle, t: 'Central de ajuda', d: 'Guias e tutoriais no app', href: 'https://www.fengshuistudio.com.br' },
              ].map((c, i) => (
                <FadeUp key={c.t} delay={i * 80}>
                  <a
                    href={c.href}
                    className="block bg-paper/5 border border-paper/15 rounded-2xl p-6 text-center h-full hover:bg-paper/10 hover:-translate-y-0.5 transition-all duration-200"
                  >
                    <c.icon className="h-6 w-6 text-gold mx-auto mb-3" strokeWidth={1.5} />
                    <h3 className="font-display text-lg text-paper mb-1">{c.t}</h3>
                    <p className="text-sm text-paper/65">{c.d}</p>
                  </a>
                </FadeUp>
              ))}
            </div>
          </div>
        </section>

        <CtaBand />
      </main>
      <Footer />
    </div>
  )
}
