import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AgroAdubo - Avaliacao de Plantas e Recomendacao de Adubos',
  description: 'Aplicativo inteligente para avaliacao de plantas, identificacao de problemas e recomendacao de adubos e tubetes de polpa moldada.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
