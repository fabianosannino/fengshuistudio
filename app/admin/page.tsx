'use client'

import { useEffect } from 'react'

export default function AdminRedirect() {
  useEffect(() => {
    window.location.href = '/admin/pagamentos'
  }, [])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-figtree), sans-serif' }}>
      <p style={{ color: '#6B7280' }}>Redirecionando...</p>
    </div>
  )
}
