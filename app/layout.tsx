import type { Metadata } from 'next'
import AppProvider from './components/AppProvider'

export const metadata: Metadata = {
  title: 'FengShui Studio',
  description: 'Plataforma de consultoria Feng Shui profissional',
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
