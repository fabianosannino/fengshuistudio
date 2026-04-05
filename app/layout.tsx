import type { Metadata } from 'next'
import AppProvider from './components/AppProvider'

export const metadata: Metadata = {
  metadataBase: new URL('https://fengshuistudio.vercel.app'),
  title: {
    default: 'FengShui Studio — Consultoria Feng Shui Profissional',
    template: '%s | FengShui Studio',
  },
  description:
    'Plataforma completa de consultoria Feng Shui profissional. Crie análises detalhadas, relatórios personalizados e transforme ambientes com harmonia e equilíbrio.',
  keywords: [
    'feng shui',
    'consultoria feng shui',
    'análise feng shui',
    'harmonização de ambientes',
    'equilíbrio energético',
    'feng shui profissional',
    'relatório feng shui',
    'plataforma feng shui',
  ],
  openGraph: {
    title: 'FengShui Studio — Consultoria Feng Shui Profissional',
    description:
      'Plataforma completa de consultoria Feng Shui profissional. Crie análises detalhadas, relatórios personalizados e transforme ambientes.',
    url: 'https://fengshuistudio.vercel.app',
    siteName: 'FengShui Studio',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'FengShui Studio — Consultoria Feng Shui Profissional',
      },
    ],
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FengShui Studio — Consultoria Feng Shui Profissional',
    description:
      'Plataforma completa de consultoria Feng Shui profissional. Crie análises detalhadas, relatórios personalizados e transforme ambientes.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="UTF-8" />
        <style>{`
          .skip-link {
            position: absolute;
            left: -9999px;
            top: 0;
            z-index: 9999;
            padding: 12px 24px;
            background: #1E3A5F;
            color: #ffffff;
            font-size: 14px;
            text-decoration: none;
          }
          .skip-link:focus {
            left: 0;
          }
        `}</style>
      </head>
      <body style={{ margin: 0 }}>
        <a href="#main-content" className="skip-link">
          Pular para o conteúdo principal
        </a>
        <AppProvider>
          {children}
        </AppProvider>
      </body>
    </html>
  )
}
