import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'FengShui Studio — Plataforma Profissional de Consultoria Feng Shui',
  description:
    'Descubra o FengShui Studio: a plataforma profissional para consultores de Feng Shui. Gerencie clientes, crie relatórios detalhados, análises de baguá e recomendações personalizadas para harmonização de ambientes residenciais e comerciais.',
  openGraph: {
    title: 'FengShui Studio — Plataforma Profissional de Consultoria Feng Shui',
    description:
      'A plataforma definitiva para consultores de Feng Shui. Gerencie clientes, crie relatórios e análises de baguá com recomendações personalizadas.',
    url: 'https://fengshuistudio.vercel.app',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'FengShui Studio — Plataforma Profissional de Consultoria Feng Shui',
      },
    ],
  },
}

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
