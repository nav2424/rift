'use client'

interface RiftLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  variant?: 'dark' | 'light'
}

export default function RiftLogo({ size = 'md', className = '', variant = 'dark' }: RiftLogoProps) {
  const heights = {
    sm: 28,
    md: 36,
    lg: 48,
    xl: 64,
  }

  const h = heights[size]
  const src = variant === 'light' ? '/rift-logo.png' : '/rift-logo-dark.png'

  return (
    <div
      className={`inline-flex items-center ${className}`}
      style={{ margin: 0, padding: 0, lineHeight: 0 }}
    >
      <img
        src={src}
        alt="Rift"
        height={h}
        style={{
          height: h,
          width: 'auto',
          display: 'block',
          ...(variant === 'light' ? { mixBlendMode: 'screen' as const } : {}),
        }}
      />
    </div>
  )
}
