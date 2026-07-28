import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#F9FAFB',
      fontFamily: 'var(--font-figtree), sans-serif',
    }}>
      <div style={{
        textAlign: 'center',
        padding: '48px 32px',
        maxWidth: '480px',
        width: '100%',
      }}>
        <div style={{ fontSize: '56px', marginBottom: '20px' }}>☯</div>

        <h1 style={{
          color: '#0E1B2C',
          fontSize: '72px',
          fontWeight: 'bold',
          marginBottom: '4px',
          marginTop: 0,
        }}>
          404
        </h1>

        <h2 style={{
          color: '#0E1B2C',
          fontSize: '22px',
          fontWeight: 'bold',
          marginBottom: '8px',
          marginTop: 0,
        }}>
          Página não encontrada
        </h2>

        <p style={{
          color: '#6B7280',
          fontSize: '15px',
          lineHeight: '1.6',
          marginBottom: '32px',
        }}>
          A página que você procura não existe ou foi movida.
        </p>

        <Link
          href="/dashboard"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: '#2E7D6B',
            color: '#ffffff',
            textDecoration: 'none',
            padding: '12px 28px',
            borderRadius: '8px',
            fontSize: '15px',
            fontWeight: 'bold',
          }}
        >
          Voltar ao Dashboard
        </Link>
      </div>
    </div>
  )
}
