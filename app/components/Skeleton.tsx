'use client'

/**
 * Reusable skeleton loading component.
 * Usage:
 *   <Skeleton width="100%" height="20px" />
 *   <Skeleton variant="card" />
 *   <Skeleton variant="list" rows={5} />
 */
export default function Skeleton({
  width = '100%',
  height = '16px',
  borderRadius = '8px',
  variant,
  rows = 3,
}: {
  width?: string
  height?: string
  borderRadius?: string
  variant?: 'card' | 'list' | 'chart' | 'kpi'
  rows?: number
}) {
  const shimmer: React.CSSProperties = {
    background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
    backgroundSize: '200% 100%',
    animation: 'skeleton-shimmer 1.5s ease-in-out infinite',
    borderRadius,
  }

  if (variant === 'kpi') {
    return (
      <>
        <style>{`@keyframes skeleton-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{ background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
              <div style={{ ...shimmer, width: '40px', height: '40px', borderRadius: '10px', marginBottom: '12px' }} />
              <div style={{ ...shimmer, width: '60px', height: '28px', marginBottom: '8px' }} />
              <div style={{ ...shimmer, width: '120px', height: '14px' }} />
            </div>
          ))}
        </div>
      </>
    )
  }

  if (variant === 'card') {
    return (
      <>
        <style>{`@keyframes skeleton-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
        <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <div style={{ ...shimmer, width: '60%', height: '20px', marginBottom: '16px' }} />
          <div style={{ ...shimmer, width: '100%', height: '200px' }} />
        </div>
      </>
    )
  }

  if (variant === 'chart') {
    return (
      <>
        <style>{`@keyframes skeleton-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {[1,2].map(i => (
            <div key={i} style={{ background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
              <div style={{ ...shimmer, width: '40%', height: '18px', marginBottom: '16px' }} />
              <div style={{ ...shimmer, width: '100%', height: '260px' }} />
            </div>
          ))}
        </div>
      </>
    )
  }

  if (variant === 'list') {
    return (
      <>
        <style>{`@keyframes skeleton-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} style={{
              background: '#fff', borderRadius: '12px', padding: '20px 24px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: '16px',
            }}>
              <div style={{ ...shimmer, width: '48px', height: '48px', borderRadius: '50%', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ ...shimmer, width: '50%', height: '16px', marginBottom: '8px' }} />
                <div style={{ ...shimmer, width: '80%', height: '12px' }} />
              </div>
              <div style={{ ...shimmer, width: '80px', height: '32px', borderRadius: '6px' }} />
            </div>
          ))}
        </div>
      </>
    )
  }

  // Default: single bar
  return (
    <>
      <style>{`@keyframes skeleton-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
      <div style={{ ...shimmer, width, height }} />
    </>
  )
}
