'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[GlobalError]', error)
  }, [error])

  return (
    <html lang="pt-BR">
      <body style={{
        margin: 0,
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#F9FAFB',
        fontFamily: 'Arial, sans-serif',
      }}>
        <div style={{
          textAlign: 'center',
          padding: '48px 32px',
          maxWidth: '480px',
          width: '100%',
        }}>
          <div style={{ fontSize: '56px', marginBottom: '20px' }}>☯</div>

          <h1 style={{
            color: '#1E3A5F',
            fontSize: '24px',
            fontWeight: 'bold',
            marginBottom: '8px',
            marginTop: 0,
          }}>
            Erro inesperado
          </h1>

          <p style={{
            color: '#6B7280',
            fontSize: '15px',
            lineHeight: '1.6',
            marginBottom: '32px',
          }}>
            Desculpe, ocorreu um erro grave na aplicação.
            <br />
            Por favor, tente novamente ou volte ao início.
          </p>

          {process.env.NODE_ENV === 'development' && (
            <details style={{
              textAlign: 'left',
              marginBottom: '28px',
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: '8px',
              padding: '16px',
            }}>
              <summary style={{
                cursor: 'pointer',
                color: '#991B1B',
                fontWeight: 'bold',
                fontSize: '13px',
              }}>
                Detalhes do erro (dev)
              </summary>
              <pre style={{
                marginTop: '12px',
                fontSize: '12px',
                color: '#7F1D1D',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {error.message}
                {error.digest && `\nDigest: ${error.digest}`}
                {error.stack && `\n\n${error.stack}`}
              </pre>
            </details>
          )}

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => reset()}
              style={{
                background: '#7C3AED',
                color: '#ffffff',
                border: 'none',
                padding: '12px 28px',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'opacity 0.2s',
              }}
              onMouseOver={(e) => (e.currentTarget.style.opacity = '0.9')}
              onMouseOut={(e) => (e.currentTarget.style.opacity = '1')}
            >
              Tentar novamente
            </button>

            <a
              href="/dashboard"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                background: '#1E3A5F',
                color: '#ffffff',
                textDecoration: 'none',
                padding: '12px 28px',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: 'bold',
                transition: 'opacity 0.2s',
              }}
              onMouseOver={(e) => (e.currentTarget.style.opacity = '0.9')}
              onMouseOut={(e) => (e.currentTarget.style.opacity = '1')}
            >
              Voltar ao início
            </a>
          </div>
        </div>
      </body>
    </html>
  )
}
