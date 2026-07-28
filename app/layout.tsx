import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Fraunces, Figtree } from 'next/font/google'
import './globals.css'
import AppProvider from './components/AppProvider'
import Analytics from './components/Analytics'

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
  weight: ['400', '500', '600'],
})

const figtree = Figtree({
  subsets: ['latin'],
  variable: '--font-figtree',
  display: 'swap',
})

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
    <html lang="pt-BR" className={`${fraunces.variable} ${figtree.variable} bg-background`}>
      <head>
        <meta charSet="UTF-8" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0E1B2C" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="FengShui Studio" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <style>{`
          .skip-link {
            position: absolute;
            left: -9999px;
            top: 0;
            z-index: 9999;
            padding: 12px 24px;
            background: #2E7D6B;
            color: #FBF9F4;
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
          <Suspense fallback={null}>
            <Analytics />
          </Suspense>
          {children}
        </AppProvider>
      </body>
    </html>
  )
}
