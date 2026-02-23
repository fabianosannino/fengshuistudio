'use client'

import { useEffect, useState } from 'react'

export default function LandingPage() {
  const [scrollY, setScrollY] = useState(0)
  const [mounted, setMounted] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeFaq, setActiveFaq] = useState<number | null>(null)

  useEffect(() => {
    setMounted(true)
    const handleScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const navSolid = scrollY > 60

  const faqs = [
    { q: 'Preciso ter experiencia com tecnologia?', a: 'Nao! O FengShui Studio foi feito para consultores de Feng Shui, nao para programadores. A interface e intuitiva e voce aprende em minutos.' },
    { q: 'Posso cancelar o plano Pro a qualquer momento?', a: 'Sim. Nao ha fidelidade. Voce pode fazer upgrade ou downgrade quando quiser, sem burocracia.' },
    { q: 'Meus dados estao seguros?', a: 'Absolutamente. Usamos criptografia de ponta a ponta e servidores seguros. Seus dados e os de seus clientes estao protegidos.' },
    { q: 'O relatorio PDF e personalizavel?', a: 'O relatorio inclui automaticamente seus dados profissionais, logo e informacoes do imovel analisado, gerando um documento profissional com a sua marca.' },
  ]

  if (!mounted) return null

  return (
    <div style={{ fontFamily: "'Outfit', sans-serif", color: '#1a1a2e', overflowX: 'hidden' }}>

      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap');

        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body { overflow-x: hidden; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
        @keyframes rotateSlowly {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }

        .fade-up { animation: fadeUp 0.8s ease-out forwards; opacity: 0; }
        .fade-up-d1 { animation-delay: 0.1s; }
        .fade-up-d2 { animation-delay: 0.2s; }
        .fade-up-d3 { animation-delay: 0.3s; }
        .fade-up-d4 { animation-delay: 0.4s; }
        .fade-up-d5 { animation-delay: 0.5s; }
        .fade-up-d6 { animation-delay: 0.6s; }

        .btn-primary {
          background: linear-gradient(135deg, #7C3AED, #5B21B6);
          color: #ffffff;
          border: none;
          padding: 16px 40px;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          font-family: 'Outfit', sans-serif;
          letter-spacing: 0.02em;
          position: relative;
          overflow: hidden;
        }
        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 40px rgba(124, 58, 237, 0.4);
        }
        .btn-secondary {
          background: transparent;
          color: #ffffff;
          border: 2px solid rgba(255,255,255,0.4);
          padding: 14px 36px;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          font-family: 'Outfit', sans-serif;
        }
        .btn-secondary:hover {
          background: rgba(255,255,255,0.1);
          border-color: rgba(255,255,255,0.8);
        }

        .feature-card {
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .feature-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 20px 60px rgba(0,0,0,0.12);
        }

        .pricing-card {
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .pricing-card:hover {
          transform: translateY(-4px);
        }

        .testimonial-card {
          transition: all 0.3s ease;
        }
        .testimonial-card:hover {
          transform: scale(1.02);
        }

        .nav-link {
          color: rgba(255,255,255,0.8);
          text-decoration: none;
          font-size: 15px;
          font-weight: 500;
          transition: color 0.2s;
          cursor: pointer;
          background: none;
          border: none;
          font-family: 'Outfit', sans-serif;
        }
        .nav-link:hover { color: #ffffff; }

        @media (max-width: 768px) {
          .hide-mobile { display: none !important; }
          .hero-grid { flex-direction: column !important; text-align: center !important; }
          .hero-buttons { justify-content: center !important; }
          .features-grid { grid-template-columns: 1fr !important; }
          .pricing-grid { grid-template-columns: 1fr !important; max-width: 400px !important; margin: 0 auto !important; }
          .footer-grid { grid-template-columns: 1fr !important; text-align: center !important; }
          .stats-grid { grid-template-columns: 1fr 1fr !important; }
          .steps-grid { grid-template-columns: 1fr !important; }
          .testimonials-grid { grid-template-columns: 1fr !important; }
          .faq-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* NAV */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
        padding: navSolid ? '12px 0' : '20px 0',
        background: navSolid ? 'rgba(15, 23, 42, 0.95)' : 'transparent',
        backdropFilter: navSolid ? 'blur(20px)' : 'none',
        borderBottom: navSolid ? '1px solid rgba(255,255,255,0.05)' : 'none',
        transition: 'all 0.4s ease',
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '28px' }}>☯</span>
            <span style={{
              fontFamily: "'Playfair Display', serif",
              color: '#C9A84C', fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em'
            }}>FengShui Studio</span>
          </div>
          <div className="hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
            <a href="#recursos" className="nav-link">Recursos</a>
            <a href="#como-funciona" className="nav-link">Como funciona</a>
            <a href="#precos" className="nav-link">Precos</a>
            <a href="#depoimentos" className="nav-link">Depoimentos</a>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => window.location.href = '/login'} className="nav-link hide-mobile">Entrar</button>
            <button onClick={() => window.location.href = '/cadastro'} style={{
              background: 'linear-gradient(135deg, #7C3AED, #5B21B6)',
              color: '#fff', border: 'none', padding: '10px 24px',
              borderRadius: '8px', fontSize: '14px', fontWeight: 700,
              cursor: 'pointer', fontFamily: "'Outfit', sans-serif",
              transition: 'all 0.3s ease'
            }}>Comecar gratis</button>
            {/* Mobile menu */}
            <button onClick={() => setMenuOpen(!menuOpen)} className="hide-mobile" style={{ display: 'none' }}>☰</button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section style={{
        minHeight: '100vh',
        background: 'linear-gradient(165deg, #0f172a 0%, #1E3A5F 40%, #1a3352 70%, #162544 100%)',
        position: 'relative',
        display: 'flex', alignItems: 'center',
        overflow: 'hidden',
      }}>
        {/* Decorative elements */}
        <div style={{
          position: 'absolute', top: '-20%', right: '-10%',
          width: '700px', height: '700px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)',
          animation: 'pulse 6s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', bottom: '-15%', left: '-5%',
          width: '500px', height: '500px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(201,168,76,0.08) 0%, transparent 70%)',
          animation: 'pulse 8s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', top: '15%', right: '8%',
          fontSize: '200px', opacity: 0.03, color: '#ffffff',
          animation: 'rotateSlowly 60s linear infinite',
          fontFamily: "'Playfair Display', serif",
        }}>☯</div>

        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '120px 32px 80px', width: '100%' }}>
          <div className="hero-grid" style={{ display: 'flex', alignItems: 'center', gap: '60px' }}>
            <div style={{ flex: 1 }}>
              <div className="fade-up" style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)',
                borderRadius: '100px', padding: '8px 20px', marginBottom: '24px',
              }}>
                <span style={{ fontSize: '12px' }}>✨</span>
                <span style={{ color: '#C4B5FD', fontSize: '13px', fontWeight: 600, letterSpacing: '0.05em' }}>
                  PLATAFORMA #1 PARA CONSULTORES
                </span>
              </div>

              <h1 className="fade-up fade-up-d1" style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: 'clamp(36px, 5vw, 56px)',
                color: '#ffffff', lineHeight: 1.1,
                marginBottom: '24px', fontWeight: 700,
              }}>
                Transforme suas consultas de{' '}
                <span style={{
                  background: 'linear-gradient(135deg, #C9A84C, #E8D48B)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>Feng Shui</span>
                {' '}em uma experiencia profissional
              </h1>

              <p className="fade-up fade-up-d2" style={{
                color: 'rgba(255,255,255,0.7)', fontSize: '18px',
                lineHeight: 1.7, marginBottom: '40px', maxWidth: '520px',
              }}>
                Gerencie clientes, realize diagnosticos Ba Gua completos e gere relatorios PDF profissionais. Tudo em uma unica plataforma feita para consultores como voce.
              </p>

              <div className="fade-up fade-up-d3 hero-buttons" style={{ display: 'flex', gap: '16px', marginBottom: '48px' }}>
                <button className="btn-primary" onClick={() => window.location.href = '/cadastro'}>
                  Comecar gratuitamente
                </button>
                <a href="#como-funciona" className="btn-secondary" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                  Ver como funciona
                </a>
              </div>

              <div className="fade-up fade-up-d4 stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '32px' }}>
                {[
                  { num: '500+', label: 'Consultores ativos' },
                  { num: '2.000+', label: 'Consultas realizadas' },
                  { num: '4.8★', label: 'Avaliacao media' },
                ].map((stat, i) => (
                  <div key={i}>
                    <p style={{ color: '#C9A84C', fontSize: '28px', fontWeight: 800, margin: '0 0 4px 0' }}>{stat.num}</p>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', margin: 0, fontWeight: 500 }}>{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Hero visual - App mockup */}
            <div className="hide-mobile" style={{ flex: 1, position: 'relative' }}>
              <div className="fade-up fade-up-d3" style={{
                background: 'linear-gradient(145deg, #1e293b, #0f172a)',
                borderRadius: '20px', padding: '24px',
                boxShadow: '0 40px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                animation: 'float 6s ease-in-out infinite',
              }}>
                {/* Mock app header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ef4444' }} />
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#eab308' }} />
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#22c55e' }} />
                  <div style={{ flex: 1, height: '28px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', marginLeft: '12px' }} />
                </div>
                {/* Mock sidebar + content */}
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ width: '60px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {['#7C3AED', '#334155', '#334155', '#334155', '#334155'].map((bg, i) => (
                      <div key={i} style={{ width: '40px', height: '40px', borderRadius: '10px', background: bg, margin: '0 auto' }} />
                    ))}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ height: '20px', width: '60%', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', marginBottom: '16px' }} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                      {[
                        { label: 'Clientes', val: '24', color: '#3B82F6' },
                        { label: 'Consultas', val: '12', color: '#7C3AED' },
                      ].map((card, i) => (
                        <div key={i} style={{
                          background: 'rgba(255,255,255,0.04)', borderRadius: '12px',
                          padding: '16px', border: '1px solid rgba(255,255,255,0.06)'
                        }}>
                          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', margin: '0 0 8px 0' }}>{card.label}</p>
                          <p style={{ color: card.color, fontSize: '24px', fontWeight: 800, margin: 0 }}>{card.val}</p>
                        </div>
                      ))}
                    </div>
                    {/* Mock Ba Gua grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                      {['#DC2626', '#7C3AED', '#BE185D', '#15803D', '#D97706', '#6B7280', '#1D4ED8', '#92400E', '#B45309'].map((c, i) => (
                        <div key={i} style={{
                          height: '32px', borderRadius: '6px',
                          background: `${c}30`, border: `1px solid ${c}50`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <div style={{ width: '16px', height: '4px', borderRadius: '2px', background: c, opacity: 0.6 }} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating badge */}
              <div className="fade-up fade-up-d5" style={{
                position: 'absolute', bottom: '-20px', left: '-20px',
                background: '#ffffff', borderRadius: '16px',
                padding: '16px 20px', boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
                display: 'flex', alignItems: 'center', gap: '12px',
                animation: 'float 5s ease-in-out infinite',
                animationDelay: '1s',
              }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>
                  📊
                </div>
                <div>
                  <p style={{ color: '#15803D', fontWeight: 700, fontSize: '14px', margin: 0 }}>Relatorio gerado!</p>
                  <p style={{ color: '#6B7280', fontSize: '12px', margin: 0 }}>PDF pronto para enviar</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Wave divider */}
        <div style={{ position: 'absolute', bottom: -2, left: 0, right: 0 }}>
          <svg viewBox="0 0 1440 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', width: '100%' }}>
            <path d="M0 50C360 90 720 10 1440 50V100H0V50Z" fill="#FAFAF9" />
          </svg>
        </div>
      </section>

      {/* RECURSOS */}
      <section id="recursos" style={{ background: '#FAFAF9', padding: '100px 32px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <span style={{
              color: '#7C3AED', fontSize: '13px', fontWeight: 700,
              letterSpacing: '0.1em', textTransform: 'uppercase',
              display: 'block', marginBottom: '12px',
            }}>RECURSOS</span>
            <h2 style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 'clamp(28px, 4vw, 42px)',
              color: '#0f172a', fontWeight: 700, marginBottom: '16px',
            }}>
              Tudo que voce precisa em um so lugar
            </h2>
            <p style={{ color: '#64748b', fontSize: '17px', maxWidth: '560px', margin: '0 auto', lineHeight: 1.7 }}>
              Ferramentas projetadas especificamente para consultores de Feng Shui que querem profissionalizar seu trabalho.
            </p>
          </div>

          <div className="features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
            {[
              { icon: '👥', title: 'Gestao de Clientes', desc: 'Cadastre e organize todos os seus clientes com dados de contato, historico de consultas e notas pessoais.', color: '#3B82F6' },
              { icon: '🧭', title: 'Diagnostico Ba Gua', desc: 'Avalie os 9 setores do Ba Gua com criterios padronizados e scores automaticos por setor.', color: '#7C3AED' },
              { icon: '📊', title: 'Relatorio PDF Pro', desc: 'Gere relatorios profissionais em PDF com sua marca, scores detalhados e recomendacoes por setor.', color: '#15803D' },
              { icon: '📅', title: 'Calendario Lunar', desc: 'Consulte o calendario lunar chinês integrado para planejar ativacoes e datas auspiciosas.', color: '#D97706' },
              { icon: '🔒', title: 'Dados Seguros', desc: 'Seus dados e de seus clientes estao protegidos com criptografia e autenticacao segura.', color: '#DC2626' },
              { icon: '📱', title: 'Acesso em Qualquer Lugar', desc: 'Use pelo computador, tablet ou celular. Interface responsiva que se adapta a qualquer tela.', color: '#0891B2' },
            ].map((feat, i) => (
              <div key={i} className="feature-card" style={{
                background: '#ffffff',
                borderRadius: '20px', padding: '32px',
                border: '1px solid #f1f5f9',
                cursor: 'default',
              }}>
                <div style={{
                  width: '56px', height: '56px', borderRadius: '16px',
                  background: `${feat.color}12`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '26px', marginBottom: '20px',
                }}>
                  {feat.icon}
                </div>
                <h3 style={{ color: '#0f172a', fontSize: '18px', fontWeight: 700, marginBottom: '10px' }}>
                  {feat.title}
                </h3>
                <p style={{ color: '#64748b', fontSize: '15px', lineHeight: 1.7, margin: 0 }}>
                  {feat.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section id="como-funciona" style={{ background: '#ffffff', padding: '100px 32px' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <span style={{
              color: '#C9A84C', fontSize: '13px', fontWeight: 700,
              letterSpacing: '0.1em', textTransform: 'uppercase',
              display: 'block', marginBottom: '12px',
            }}>COMO FUNCIONA</span>
            <h2 style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 'clamp(28px, 4vw, 42px)',
              color: '#0f172a', fontWeight: 700, marginBottom: '16px',
            }}>
              Simples como deve ser
            </h2>
            <p style={{ color: '#64748b', fontSize: '17px', maxWidth: '500px', margin: '0 auto', lineHeight: 1.7 }}>
              Em apenas 3 passos voce transforma seu atendimento.
            </p>
          </div>

          <div className="steps-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '48px', position: 'relative' }}>
            {/* Connecting line */}
            <div className="hide-mobile" style={{
              position: 'absolute', top: '60px', left: '16%', right: '16%',
              height: '2px', background: 'linear-gradient(90deg, #7C3AED, #C9A84C, #15803D)',
              opacity: 0.3,
            }} />
            {[
              { step: '01', title: 'Cadastre seus clientes', desc: 'Adicione os dados dos seus clientes e imoveis a serem analisados.', color: '#7C3AED' },
              { step: '02', title: 'Realize o diagnostico', desc: 'Avalie cada setor do Ba Gua com os criterios integrados e gere scores automaticos.', color: '#C9A84C' },
              { step: '03', title: 'Entregue o relatorio', desc: 'Gere um PDF profissional e impressione seus clientes com a qualidade do seu trabalho.', color: '#15803D' },
            ].map((item, i) => (
              <div key={i} style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
                <div style={{
                  width: '80px', height: '80px', borderRadius: '50%',
                  background: `linear-gradient(135deg, ${item.color}15, ${item.color}08)`,
                  border: `3px solid ${item.color}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 24px', position: 'relative',
                }}>
                  <span style={{ color: item.color, fontSize: '24px', fontWeight: 800 }}>{item.step}</span>
                </div>
                <h3 style={{ color: '#0f172a', fontSize: '18px', fontWeight: 700, marginBottom: '10px' }}>
                  {item.title}
                </h3>
                <p style={{ color: '#64748b', fontSize: '15px', lineHeight: 1.7, margin: 0 }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRECOS */}
      <section id="precos" style={{
        background: 'linear-gradient(165deg, #0f172a, #1E3A5F)',
        padding: '100px 32px', position: 'relative',
      }}>
        <div style={{
          position: 'absolute', top: '10%', right: '5%',
          width: '400px', height: '400px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(124,58,237,0.08) 0%, transparent 70%)',
        }} />

        <div style={{ maxWidth: '900px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <span style={{
              color: '#C4B5FD', fontSize: '13px', fontWeight: 700,
              letterSpacing: '0.1em', textTransform: 'uppercase',
              display: 'block', marginBottom: '12px',
            }}>PRECOS</span>
            <h2 style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 'clamp(28px, 4vw, 42px)',
              color: '#ffffff', fontWeight: 700, marginBottom: '16px',
            }}>
              Escolha o plano ideal para voce
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '17px', maxWidth: '500px', margin: '0 auto', lineHeight: 1.7 }}>
              Comece gratuitamente e faca upgrade quando quiser.
            </p>
          </div>

          <div className="pricing-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            {/* Free */}
            <div className="pricing-card" style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '24px', padding: '40px 32px',
            }}>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', fontWeight: 600, letterSpacing: '0.05em', margin: '0 0 8px 0' }}>FREE</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '8px' }}>
                <span style={{ color: '#ffffff', fontSize: '48px', fontWeight: 800 }}>R$0</span>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '16px' }}>/mes</span>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '15px', margin: '0 0 32px 0' }}>
                Perfeito para comecar
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '36px' }}>
                {[
                  'Ate 5 clientes',
                  '3 consultas por mes',
                  'Diagnostico Ba Gua completo',
                  'Suporte por email',
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', flexShrink: 0 }}>✓</div>
                    <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '15px' }}>{item}</span>
                  </div>
                ))}
                {[
                  'Relatorio PDF',
                  'Calendario lunar',
                  'Clientes ilimitados',
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', opacity: 0.35 }}>
                    <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', flexShrink: 0 }}>✕</div>
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '15px', textDecoration: 'line-through' }}>{item}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => window.location.href = '/cadastro'} style={{
                width: '100%', padding: '14px',
                background: 'rgba(255,255,255,0.1)', color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '12px', fontSize: '15px', fontWeight: 700,
                cursor: 'pointer', fontFamily: "'Outfit', sans-serif",
                transition: 'all 0.3s ease',
              }}>
                Comecar gratis
              </button>
            </div>

            {/* Pro */}
            <div className="pricing-card" style={{
              background: 'linear-gradient(145deg, rgba(124,58,237,0.15), rgba(124,58,237,0.05))',
              border: '2px solid rgba(124,58,237,0.4)',
              borderRadius: '24px', padding: '40px 32px',
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', top: '16px', right: '16px',
                background: 'linear-gradient(135deg, #7C3AED, #5B21B6)',
                borderRadius: '100px', padding: '6px 16px',
              }}>
                <span style={{ color: '#fff', fontSize: '12px', fontWeight: 700 }}>POPULAR</span>
              </div>
              <p style={{ color: '#C4B5FD', fontSize: '14px', fontWeight: 600, letterSpacing: '0.05em', margin: '0 0 8px 0' }}>PRO</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '8px' }}>
                <span style={{ color: '#ffffff', fontSize: '48px', fontWeight: 800 }}>R$49</span>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '16px' }}>/mes</span>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '15px', margin: '0 0 32px 0' }}>
                Para consultores profissionais
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '36px' }}>
                {[
                  'Clientes ilimitados',
                  'Consultas ilimitadas',
                  'Diagnostico Ba Gua completo',
                  'Relatorio PDF profissional',
                  'Calendario lunar chinês',
                  'Suporte prioritario',
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: '#fff', flexShrink: 0 }}>✓</div>
                    <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '15px' }}>{item}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => window.location.href = '/cadastro'} className="btn-primary" style={{ width: '100%' }}>
                Assinar plano Pro
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* DEPOIMENTOS */}
      <section id="depoimentos" style={{ background: '#FAFAF9', padding: '100px 32px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <span style={{
              color: '#7C3AED', fontSize: '13px', fontWeight: 700,
              letterSpacing: '0.1em', textTransform: 'uppercase',
              display: 'block', marginBottom: '12px',
            }}>DEPOIMENTOS</span>
            <h2 style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 'clamp(28px, 4vw, 42px)',
              color: '#0f172a', fontWeight: 700, marginBottom: '16px',
            }}>
              O que dizem nossos consultores
            </h2>
          </div>

          <div className="testimonials-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
            {[
              { name: 'Marina Silva', city: 'Sao Paulo, SP', text: 'Antes eu fazia tudo em planilhas. Com o FengShui Studio, meus relatorios ficaram muito mais profissionais. Meus clientes adoram!', avatar: 'M' },
              { name: 'Ricardo Tanaka', city: 'Curitiba, PR', text: 'O diagnostico por setor com scores automaticos economiza horas do meu trabalho. Recomendo para todos os consultores de Feng Shui.', avatar: 'R' },
              { name: 'Ana Beatriz Costa', city: 'Rio de Janeiro, RJ', text: 'A plataforma e intuitiva e o calendario lunar integrado e um diferencial incrivel. Vale cada centavo do plano Pro.', avatar: 'A' },
            ].map((t, i) => (
              <div key={i} className="testimonial-card" style={{
                background: '#ffffff',
                borderRadius: '20px', padding: '32px',
                border: '1px solid #f1f5f9',
              }}>
                <div style={{ display: 'flex', marginBottom: '16px' }}>
                  {[1,2,3,4,5].map(s => (
                    <span key={s} style={{ color: '#C9A84C', fontSize: '18px' }}>★</span>
                  ))}
                </div>
                <p style={{
                  color: '#334155', fontSize: '15px', lineHeight: 1.8,
                  fontStyle: 'italic', margin: '0 0 24px 0',
                }}>
                  "{t.text}"
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '44px', height: '44px', borderRadius: '50%',
                    background: 'linear-gradient(135deg, #7C3AED, #5B21B6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontWeight: 700, fontSize: '18px',
                  }}>{t.avatar}</div>
                  <div>
                    <p style={{ color: '#0f172a', fontWeight: 700, fontSize: '15px', margin: 0 }}>{t.name}</p>
                    <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>{t.city}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ background: '#ffffff', padding: '100px 32px' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <span style={{
              color: '#C9A84C', fontSize: '13px', fontWeight: 700,
              letterSpacing: '0.1em', textTransform: 'uppercase',
              display: 'block', marginBottom: '12px',
            }}>FAQ</span>
            <h2 style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 'clamp(28px, 4vw, 36px)',
              color: '#0f172a', fontWeight: 700,
            }}>
              Perguntas frequentes
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {faqs.map((faq, i) => (
              <div key={i} style={{
                border: '1px solid #f1f5f9',
                borderRadius: '16px', overflow: 'hidden',
                background: activeFaq === i ? '#FAFAF9' : '#ffffff',
                transition: 'all 0.3s ease',
              }}>
                <button
                  onClick={() => setActiveFaq(activeFaq === i ? null : i)}
                  style={{
                    width: '100%', padding: '20px 24px',
                    background: 'transparent', border: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    cursor: 'pointer', fontFamily: "'Outfit', sans-serif",
                  }}
                >
                  <span style={{ color: '#0f172a', fontSize: '16px', fontWeight: 600, textAlign: 'left' }}>{faq.q}</span>
                  <span style={{
                    color: '#7C3AED', fontSize: '20px', fontWeight: 300,
                    transform: activeFaq === i ? 'rotate(45deg)' : 'none',
                    transition: 'transform 0.3s ease',
                  }}>+</span>
                </button>
                <div style={{
                  maxHeight: activeFaq === i ? '200px' : '0',
                  overflow: 'hidden',
                  transition: 'max-height 0.3s ease',
                }}>
                  <p style={{
                    padding: '0 24px 20px', color: '#64748b',
                    fontSize: '15px', lineHeight: 1.7, margin: 0,
                  }}>{faq.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section style={{
        background: 'linear-gradient(135deg, #7C3AED, #5B21B6)',
        padding: '80px 32px', textAlign: 'center',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '600px', height: '600px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 60%)',
        }} />
        <div style={{ maxWidth: '600px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <h2 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 'clamp(28px, 4vw, 40px)',
            color: '#ffffff', fontWeight: 700, marginBottom: '16px',
          }}>
            Pronto para transformar suas consultas?
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '17px', lineHeight: 1.7, marginBottom: '36px' }}>
            Junte-se a centenas de consultores que ja usam o FengShui Studio para elevar a qualidade do seu trabalho.
          </p>
          <button onClick={() => window.location.href = '/cadastro'} style={{
            background: '#ffffff', color: '#7C3AED', border: 'none',
            padding: '16px 48px', borderRadius: '12px', fontSize: '17px',
            fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit', sans-serif",
            transition: 'all 0.3s ease', boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
          }}>
            Criar minha conta gratis
          </button>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', marginTop: '16px' }}>
            Sem cartao de credito. Cancele quando quiser.
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{
        background: '#0f172a', padding: '64px 32px 32px',
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div className="footer-grid" style={{
            display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr',
            gap: '48px', marginBottom: '48px',
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <span style={{ fontSize: '24px' }}>☯</span>
                <span style={{ fontFamily: "'Playfair Display', serif", color: '#C9A84C', fontSize: '20px', fontWeight: 700 }}>FengShui Studio</span>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', lineHeight: 1.7, maxWidth: '300px' }}>
                A plataforma completa para consultores de Feng Shui que querem profissionalizar seu trabalho e impressionar seus clientes.
              </p>
            </div>
            <div>
              <h4 style={{ color: '#ffffff', fontSize: '14px', fontWeight: 700, marginBottom: '16px', letterSpacing: '0.05em' }}>PRODUTO</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {['Recursos', 'Precos', 'Depoimentos'].map((item, i) => (
                  <a key={i} href={`#${item.toLowerCase()}`} style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', textDecoration: 'none', transition: 'color 0.2s' }}>{item}</a>
                ))}
              </div>
            </div>
            <div>
              <h4 style={{ color: '#ffffff', fontSize: '14px', fontWeight: 700, marginBottom: '16px', letterSpacing: '0.05em' }}>EMPRESA</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {['Sobre', 'Blog', 'Contato'].map((item, i) => (
                  <span key={i} style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', cursor: 'pointer' }}>{item}</span>
                ))}
              </div>
            </div>
            <div>
              <h4 style={{ color: '#ffffff', fontSize: '14px', fontWeight: 700, marginBottom: '16px', letterSpacing: '0.05em' }}>LEGAL</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {['Termos de uso', 'Privacidade'].map((item, i) => (
                  <span key={i} style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', cursor: 'pointer' }}>{item}</span>
                ))}
              </div>
            </div>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '24px', textAlign: 'center' }}>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>
              © {new Date().getFullYear()} FengShui Studio. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
