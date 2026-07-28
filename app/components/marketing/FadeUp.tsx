'use client'

/* Design "Chi": fade-up contido em scroll, respeita prefers-reduced-motion (via CSS) */
import { useEffect, useRef, type ReactNode } from 'react'

export default function FadeUp({
  children,
  delay = 0,
  className = '',
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Se o observer não existir (SSR/ambientes antigos), revela imediatamente.
    if (typeof IntersectionObserver === 'undefined') {
      el.classList.add('in-view')
      return
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('in-view')
          obs.disconnect()
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -8% 0px' },
    )
    obs.observe(el)
    // Fallback de segurança: se por algum motivo o observer não disparar,
    // garante que o conteúdo apareça (evita seções invisíveis).
    const fallback = window.setTimeout(() => el.classList.add('in-view'), 1200)
    return () => {
      obs.disconnect()
      window.clearTimeout(fallback)
    }
  }, [])

  return (
    <div ref={ref} className={`fade-up ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  )
}
