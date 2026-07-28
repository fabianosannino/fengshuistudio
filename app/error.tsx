'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Error Boundary]', error)
  }, [error])

  return (
    <div style={{
      minHeight: '60vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-figtree), sans-serif',
    }}>
      <div style={{
        textAlign: 'center',
        padding: '48px 32px',
        maxWidth: '480px',
        width: '100%',
        background: '#ffffff',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        border: '1px solid #E5E7EB',
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>☯</div>

        <h2 style={{
          color: '#0E1B2C',
          fontSize: '22px',
          fontWeight: 'bold',
          marginBottom: '8px',
          marginTop: 0,
        }}>
          Algo deu errado
        </h2>

        <p style={{
          color: '#6B7280',
          fontSize: '14px',
          lineHeight: '1.6',
          marginBottom: '28px',
        }}>
          Ocorreu um erro ao carregar esta página.
          <br />
          Tente novamente ou volte ao Dashboard.
        </p>

        {process.env.NODE_ENV === 'development' && (
          <details style={{
            textAlign: 'left',
            marginBottom: '24px',
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
              background: '#2E7D6B',
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
              background: '#0E1B2C',
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
            Voltar ao Dashboard
          </a>
        </div>
      </div>
    </div>
  )
}
