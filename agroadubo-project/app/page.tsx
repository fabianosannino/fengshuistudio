'use client'

import { useState, useEffect, useRef } from 'react'

function useInView(ref: React.RefObject<HTMLElement | null>) {
  const [inView, setInView] = useState(false)
  useEffect(() => {
    if (!ref.current) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true) },
      { threshold: 0.15 }
    )
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [ref])
  return inView
}

export default function LandingPage() {
  const [mounted, setMounted] = useState(false)
  const [scrollY, setScrollY] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)

  const recursosRef = useRef<HTMLDivElement>(null)
  const comoRef = useRef<HTMLDivElement>(null)
  const tubetesRef = useRef<HTMLDivElement>(null)

  const recursosInView = useInView(recursosRef)
  const comoInView = useInView(comoRef)
  const tubetesInView = useInView(tubetesRef)

  useEffect(() => {
    setMounted(true)
    const handleScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  if (!mounted) return null

  const navSolid = scrollY > 60

  const sectionTransition = (inView: boolean): React.CSSProperties => ({
    opacity: inView ? 1 : 0,
    transform: inView ? 'translateY(0)' : 'translateY(30px)',
    transition: 'opacity 0.7s ease-out, transform 0.7s ease-out',
  })

  return (
    <div style={{ color: '#1a1a2e', overflowX: 'hidden' }}>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-12px); } }
        @keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }
        @keyframes fadeDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        .fade-up { animation: fadeUp 0.8s ease-out forwards; opacity: 0; }
        .fade-up-d1 { animation-delay: 0.1s; }
        .fade-up-d2 { animation-delay: 0.2s; }
        .fade-up-d3 { animation-delay: 0.3s; }
        .fade-up-d4 { animation-delay: 0.4s; }
        .btn-hero { background: linear-gradient(135deg, #16a34a, #15803d); color: #fff; border: none; padding: 18px 44px; border-radius: 14px; font-size: 17px; font-weight: 700; cursor: pointer; transition: all 0.3s ease; }
        .btn-hero:hover { transform: translateY(-2px); box-shadow: 0 12px 40px rgba(22,163,74,0.4); }
        .btn-outline { background: transparent; color: #fff; border: 2px solid rgba(255,255,255,0.4); padding: 16px 36px; border-radius: 14px; font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.3s ease; text-decoration: none; }
        .btn-outline:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.8); }
        .feature-card { transition: all 0.4s ease; }
        .feature-card:hover { transform: translateY(-6px); box-shadow: 0 20px 50px rgba(0,0,0,0.08); border-color: rgba(22,163,74,0.15) !important; }
        .cta-btn { transition: all 0.3s ease; }
        .cta-btn:hover { transform: translateY(-2px); box-shadow: 0 12px 40px rgba(255,255,255,0.2); }
        .hamburger-btn { display: none !important; }
        @media (max-width: 768px) {
          .hide-mobile { display: none !important; }
          .hamburger-btn { display: flex !important; }
          .hero-grid { flex-direction: column !important; text-align: center !important; }
          .hero-buttons { justify-content: center !important; flex-direction: column !important; align-items: center !important; }
          .features-grid { grid-template-columns: 1fr !important; }
          .steps-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 32px !important; }
          .footer-grid { grid-template-columns: 1fr !important; text-align: center !important; }
          .cta-buttons { flex-direction: column !important; align-items: center !important; }
        }
        @media (max-width: 480px) {
          .steps-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* NAV */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
        padding: navSolid ? '12px 0' : '20px 0',
        background: navSolid ? 'rgba(5, 46, 22, 0.95)' : 'transparent',
        backdropFilter: navSolid ? 'blur(20px)' : 'none',
        borderBottom: navSolid ? '1px solid rgba(255,255,255,0.05)' : 'none',
        transition: 'all 0.4s ease',
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '28px' }}>{'\uD83C\uDF31'}</span>
            <span style={{ color: '#86efac', fontSize: '22px', fontWeight: 800 }}>AgroAdubo</span>
          </div>
          <div className="hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
            <a href="#recursos" style={{ color: 'rgba(255,255,255,0.8)', textDecoration: 'none', fontSize: '15px', fontWeight: 500 }}>Recursos</a>
            <a href="#como-funciona" style={{ color: 'rgba(255,255,255,0.8)', textDecoration: 'none', fontSize: '15px', fontWeight: 500 }}>Como funciona</a>
            <a href="#tubetes" style={{ color: 'rgba(255,255,255,0.8)', textDecoration: 'none', fontSize: '15px', fontWeight: 500 }}>Tubetes</a>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => window.location.href = '/avaliar'} className="hide-mobile" style={{
              background: 'linear-gradient(135deg, #16a34a, #15803d)', color: '#fff', border: 'none',
              padding: '10px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: 700, cursor: 'pointer',
            }}>Avaliar planta</button>

            {/* Hamburger Button */}
            <button
              className="hamburger-btn"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Menu"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', gap: '5px', padding: '8px',
              }}
            >
              {menuOpen ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
                  <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div style={{
            padding: '24px 32px',
            display: 'flex', flexDirection: 'column', gap: '20px',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(5, 46, 22, 0.98)',
            animation: 'fadeDown 0.3s ease-out',
          }}>
            <a href="#recursos" onClick={() => setMenuOpen(false)} style={{ color: 'rgba(255,255,255,0.8)', textDecoration: 'none', fontSize: '16px', fontWeight: 500 }}>Recursos</a>
            <a href="#como-funciona" onClick={() => setMenuOpen(false)} style={{ color: 'rgba(255,255,255,0.8)', textDecoration: 'none', fontSize: '16px', fontWeight: 500 }}>Como funciona</a>
            <a href="#tubetes" onClick={() => setMenuOpen(false)} style={{ color: 'rgba(255,255,255,0.8)', textDecoration: 'none', fontSize: '16px', fontWeight: 500 }}>Tubetes</a>
            <button onClick={() => { setMenuOpen(false); window.location.href = '/avaliar' }} style={{
              background: 'linear-gradient(135deg, #16a34a, #15803d)', color: '#fff', border: 'none',
              padding: '12px 24px', borderRadius: '8px', fontSize: '15px', fontWeight: 700, cursor: 'pointer',
            }}>Avaliar planta</button>
          </div>
        )}
      </nav>

      {/* HERO */}
      <section style={{
        minHeight: '100vh',
        background: 'linear-gradient(165deg, #052e16 0%, #14532d 40%, #166534 70%, #15803d 100%)',
        position: 'relative', display: 'flex', alignItems: 'center', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: '-20%', right: '-10%', width: '700px', height: '700px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(34,197,94,0.12) 0%, transparent 70%)', animation: 'pulse 6s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', bottom: '-15%', left: '-5%', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(163,230,53,0.08) 0%, transparent 70%)', animation: 'pulse 8s ease-in-out infinite' }} />

        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '120px 32px 80px', width: '100%' }}>
          <div className="hero-grid" style={{ display: 'flex', alignItems: 'center', gap: '60px' }}>
            <div style={{ flex: 1 }}>
              <div className="fade-up" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '100px', padding: '8px 20px', marginBottom: '24px' }}>
                <span style={{ fontSize: '12px' }}>{'\uD83C\uDF3F'}</span>
                <span style={{ color: '#86efac', fontSize: '13px', fontWeight: 600, letterSpacing: '0.05em' }}>TECNOLOGIA PARA O AGRO + IA</span>
              </div>

              <h1 className="fade-up fade-up-d1" style={{ fontSize: 'clamp(36px, 5vw, 56px)', color: '#ffffff', lineHeight: 1.1, marginBottom: '24px', fontWeight: 800 }}>
                O adubo certo para cada{' '}
                <span style={{ background: 'linear-gradient(135deg, #86efac, #4ade80)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>planta e solo</span>
              </h1>

              <p className="fade-up fade-up-d2" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '18px', lineHeight: 1.7, marginBottom: '40px', maxWidth: '520px' }}>
                Tire uma foto e nossa IA identifica a planta. Informe sua regiao e tipo de producao. Receba instantaneamente a recomendacao completa de adubos e tubetes personalizados.
              </p>

              <div className="fade-up fade-up-d3 hero-buttons" style={{ display: 'flex', gap: '16px', marginBottom: '48px' }}>
                <button className="btn-hero" onClick={() => window.location.href = '/avaliar'}>
                  {'\uD83D\uDCF1'} Avaliar minha planta
                </button>
                <a href="#como-funciona" className="btn-outline">Como funciona</a>
              </div>

              <div className="fade-up fade-up-d4" style={{ display: 'flex', gap: '40px', flexWrap: 'wrap' }}>
                {[
                  { num: '12+', label: 'Especies cadastradas' },
                  { num: '5', label: 'Regioes do Brasil' },
                  { num: 'IA', label: 'Identificacao por foto' },
                ].map((stat, i) => (
                  <div key={i}>
                    <p style={{ color: '#4ade80', fontSize: '28px', fontWeight: 800, margin: '0 0 4px 0' }}>{stat.num}</p>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', margin: 0, fontWeight: 500 }}>{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Hero visual */}
            <div className="hide-mobile" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="fade-up fade-up-d3" style={{
                background: 'linear-gradient(145deg, rgba(5,46,22,0.9), rgba(22,101,52,0.8))',
                borderRadius: '24px', padding: '40px',
                boxShadow: '0 40px 80px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)',
                border: '1px solid rgba(74,222,128,0.25)',
                animation: 'float 6s ease-in-out infinite',
              }}>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                  <div style={{ fontSize: '64px', marginBottom: '8px' }}>{'\uD83C\uDF31'}</div>
                  <p style={{ color: '#86efac', fontSize: '18px', fontWeight: 700 }}>AgroAdubo</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', width: '280px' }}>
                  {[
                    { icon: '\uD83D\uDCF7', label: 'Foto + IA', color: '#4ade80' },
                    { icon: '\uD83D\uDCCD', label: 'Sua regiao', color: '#38bdf8' },
                    { icon: '\uD83E\uDEA8', label: 'Tipo de solo', color: '#fb923c' },
                    { icon: '\uD83C\uDFE1', label: 'Sua producao', color: '#c084fc' },
                  ].map((item, i) => (
                    <div key={i} style={{
                      background: `${item.color}15`, border: `1px solid ${item.color}40`,
                      borderRadius: '14px', padding: '16px', textAlign: 'center',
                    }}>
                      <div style={{ fontSize: '28px', marginBottom: '6px' }}>{item.icon}</div>
                      <p style={{ color: item.color, fontSize: '12px', fontWeight: 700, margin: 0 }}>{item.label}</p>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: '20px', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: '12px', padding: '14px', textAlign: 'center' }}>
                  <p style={{ color: '#4ade80', fontSize: '13px', fontWeight: 700, margin: 0 }}>
                    {'\u2192'} Recomendacao completa de adubos + tubetes
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ position: 'absolute', bottom: -2, left: 0, right: 0 }}>
          <svg viewBox="0 0 1440 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', width: '100%' }}>
            <path d="M0 50C360 90 720 10 1440 50V100H0V50Z" fill="#f0fdf4" />
          </svg>
        </div>
      </section>

      {/* RECURSOS */}
      <section id="recursos" ref={recursosRef} style={{ background: '#f0fdf4', padding: '100px 32px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', ...sectionTransition(recursosInView) }}>
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <span style={{ color: '#16a34a', fontSize: '13px', fontWeight: 700, letterSpacing: '0.1em', display: 'block', marginBottom: '12px' }}>RECURSOS</span>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', color: '#052e16', fontWeight: 800, marginBottom: '16px' }}>Tudo que o produtor precisa</h2>
            <p style={{ color: '#4b5563', fontSize: '17px', maxWidth: '560px', margin: '0 auto', lineHeight: 1.7 }}>Do celular direto para o campo. Tecnologia acessivel para decisoes inteligentes de adubacao.</p>
          </div>
          <div className="features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
            {[
              { icon: '\uD83E\uDD16', title: 'Identificacao por IA', desc: 'Tire uma foto e nossa inteligencia artificial identifica a especie automaticamente.', color: '#16a34a' },
              { icon: '\uD83D\uDCCD', title: 'Geolocalizacao', desc: 'Detecta automaticamente sua regiao para sugerir o tipo de solo e as condicoes climaticas locais.', color: '#2563eb' },
              { icon: '\uD83E\uDDEA', title: 'Adubos Personalizados', desc: 'Recomendacao de NPK, organicos e corretivos com dosagem ajustada a escala da sua producao.', color: '#d97706' },
              { icon: '\uD83C\uDF31', title: 'Tubetes de Polpa Moldada', desc: 'Indicacao do tubete ideal com substrato e adubo base especifico para cada planta e terreno.', color: '#7c3aed' },
              { icon: '\u26A0\uFE0F', title: 'Diagnostico de Problemas', desc: 'Informe pragas, doencas ou deficiencias nutricionais e receba solucoes corretivas direcionadas.', color: '#dc2626' },
              { icon: '\uD83D\uDCF1', title: 'Funciona no Celular', desc: 'Interface otimizada para uso no campo, ideal para areas rurais.', color: '#0891b2' },
            ].map((feat, i) => (
              <div key={i} className="feature-card" style={{
                background: '#ffffff', borderRadius: '20px', padding: '32px',
                border: '1px solid rgba(0,0,0,0.06)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}>
                <div style={{
                  width: '56px', height: '56px', borderRadius: '16px',
                  background: `linear-gradient(135deg, ${feat.color}18, ${feat.color}08)`,
                  border: `1px solid ${feat.color}25`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '24px', marginBottom: '20px',
                  boxShadow: `0 4px 12px ${feat.color}12`,
                }}>{feat.icon}</div>
                <h3 style={{ color: '#052e16', fontSize: '18px', fontWeight: 700, marginBottom: '10px' }}>{feat.title}</h3>
                <p style={{ color: '#4b5563', fontSize: '15px', lineHeight: 1.7, margin: 0 }}>{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section id="como-funciona" ref={comoRef} style={{ background: '#ffffff', padding: '100px 32px' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', ...sectionTransition(comoInView) }}>
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <span style={{ color: '#16a34a', fontSize: '13px', fontWeight: 700, letterSpacing: '0.1em', display: 'block', marginBottom: '12px' }}>COMO FUNCIONA</span>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', color: '#052e16', fontWeight: 800, marginBottom: '16px' }}>Simples como plantar</h2>
            <p style={{ color: '#4b5563', fontSize: '17px', maxWidth: '500px', margin: '0 auto', lineHeight: 1.7 }}>Em 5 passos rapidos, voce recebe a recomendacao completa.</p>
          </div>
          <div className="steps-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '20px', position: 'relative' }}>
            <div className="hide-mobile" style={{ position: 'absolute', top: '40px', left: '10%', right: '10%', height: '2px', background: 'linear-gradient(90deg, #16a34a, #2563eb, #d97706, #7c3aed, #dc2626)', opacity: 0.3 }} />
            {[
              { step: '1', title: 'Tire a foto', desc: 'IA identifica a planta', color: '#16a34a', icon: '\uD83D\uDCF7' },
              { step: '2', title: 'Regiao', desc: 'GPS automatico ou manual', color: '#2563eb', icon: '\uD83D\uDCCD' },
              { step: '3', title: 'Solo', desc: 'Selecione o tipo de solo', color: '#d97706', icon: '\uD83E\uDEA8' },
              { step: '4', title: 'Producao', desc: 'Vaso, horta ou larga escala', color: '#7c3aed', icon: '\uD83C\uDFE1' },
              { step: '5', title: 'Resultado', desc: 'Adubos + tubetes recomendados', color: '#dc2626', icon: '\u2705' },
            ].map((item, i) => (
              <div key={i} style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
                <div style={{
                  width: '64px', height: '64px', borderRadius: '50%',
                  background: `linear-gradient(135deg, ${item.color}15, ${item.color}08)`,
                  border: `3px solid ${item.color}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 16px', fontSize: '24px',
                }}>{item.icon}</div>
                <h3 style={{ color: '#052e16', fontSize: '15px', fontWeight: 700, marginBottom: '6px' }}>{item.title}</h3>
                <p style={{ color: '#6b7280', fontSize: '13px', lineHeight: 1.5, margin: 0 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TUBETES */}
      <section id="tubetes" ref={tubetesRef} style={{ background: 'linear-gradient(165deg, #052e16, #14532d)', padding: '100px 32px', position: 'relative' }}>
        <div style={{ position: 'absolute', top: '10%', right: '5%', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(34,197,94,0.08) 0%, transparent 70%)' }} />
        <div style={{ maxWidth: '900px', margin: '0 auto', position: 'relative', zIndex: 1, ...sectionTransition(tubetesInView) }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <span style={{ color: '#86efac', fontSize: '13px', fontWeight: 700, letterSpacing: '0.1em', display: 'block', marginBottom: '12px' }}>TUBETES DE POLPA MOLDADA</span>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', color: '#ffffff', fontWeight: 800, marginBottom: '16px' }}>O inicio ideal para cada muda</h2>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '17px', maxWidth: '560px', margin: '0 auto', lineHeight: 1.7 }}>
              Tubetes biodegradaveis com adubo personalizado para cada especie. A muda vai direto para o terreno com o substrato ideal.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
            {[
              { tamanho: '50-55 cm3', para: 'Hortalicas e ornamentais', plantas: 'Alface, tomate, pimentao, orquidea', cor: '#4ade80' },
              { tamanho: '120 cm3', para: 'Culturas anuais e graos', plantas: 'Milho, soja, cana, morango', cor: '#38bdf8' },
              { tamanho: '180-280 cm3', para: 'Florestais e perenes', plantas: 'Eucalipto, cafe, manga, rosa', cor: '#c084fc' },
            ].map((tubete, i) => (
              <div key={i} style={{
                background: 'rgba(255,255,255,0.05)', border: `1px solid ${tubete.cor}40`,
                borderRadius: '20px', padding: '28px',
              }}>
                <div style={{ fontSize: '36px', marginBottom: '12px' }}>{'\uD83C\uDF31'}</div>
                <p style={{ color: tubete.cor, fontSize: '24px', fontWeight: 800, margin: '0 0 4px 0' }}>{tubete.tamanho}</p>
                <p style={{ color: '#ffffff', fontSize: '15px', fontWeight: 600, margin: '0 0 12px 0' }}>{tubete.para}</p>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', margin: '0 0 16px 0', lineHeight: 1.6 }}>{tubete.plantas}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {['Substrato personalizado', 'Adubo de liberacao lenta', 'Biodegradavel no solo'].map((item, j) => (
                    <div key={j} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: tubete.cor, fontSize: '12px' }}>{'\u2713'}</span>
                      <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px' }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', padding: '80px 32px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '600px', height: '600px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 60%)' }} />
        <div style={{ maxWidth: '600px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 40px)', color: '#ffffff', fontWeight: 800, marginBottom: '16px' }}>Pronto para avaliar sua planta?</h2>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '17px', lineHeight: 1.7, marginBottom: '36px' }}>
            Basta ter o celular em maos. Tire a foto, informe seus dados e receba a recomendacao completa em segundos.
          </p>
          <div className="cta-buttons" style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
            <button className="cta-btn" onClick={() => window.location.href = '/avaliar'} style={{
              background: '#ffffff', color: '#16a34a', border: 'none', padding: '16px 48px',
              borderRadius: '12px', fontSize: '17px', fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
            }}>{'\uD83D\uDCF1'} Comecar avaliacao</button>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', marginTop: '16px' }}>Gratuito. Sem cadastro necessario.</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: '#052e16', padding: '48px 32px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div className="footer-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '48px', marginBottom: '32px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <span style={{ fontSize: '24px' }}>{'\uD83C\uDF31'}</span>
                <span style={{ color: '#86efac', fontSize: '20px', fontWeight: 800 }}>AgroAdubo</span>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', lineHeight: 1.7, maxWidth: '300px' }}>
                Tecnologia acessivel para produtores de todos os tamanhos. Do vaso a larga escala.
              </p>
            </div>
            <div>
              <h4 style={{ color: '#ffffff', fontSize: '14px', fontWeight: 700, marginBottom: '16px' }}>PRODUTO</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {['Recursos', 'Como funciona', 'Tubetes'].map((item, i) => (
                  <a key={i} href={`#${item.toLowerCase().replace(/ /g, '-')}`} style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', textDecoration: 'none' }}>{item}</a>
                ))}
              </div>
            </div>
            <div>
              <h4 style={{ color: '#ffffff', fontSize: '14px', fontWeight: 700, marginBottom: '16px' }}>CONTATO</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>contato@agroadubo.com.br</span>
              </div>
            </div>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '20px', textAlign: 'center' }}>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>&copy; {new Date().getFullYear()} AgroAdubo. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
