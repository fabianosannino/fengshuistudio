/* Design "Chi": curva de fluxo separando seções. */
export default function ChiDivider({
  color = 'var(--paper-50)',
  flip = false,
  className = '',
}: {
  color?: string
  flip?: boolean
  className?: string
}) {
  return (
    <div className={`relative z-10 -mb-px ${className}`} aria-hidden="true">
      <svg
        viewBox="0 0 1440 72"
        preserveAspectRatio="none"
        className={`block w-full h-[48px] md:h-[72px] ${flip ? 'scale-y-[-1]' : ''}`}
      >
        <path
          d="M0,40 C240,72 480,8 720,28 C960,48 1200,20 1440,44 L1440,72 L0,72 Z"
          fill={color}
        />
      </svg>
    </div>
  )
}
