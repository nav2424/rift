'use client'

interface RiftLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  variant?: 'dark' | 'light'
}

export default function RiftLogo({ size = 'md', className = '', variant = 'dark' }: RiftLogoProps) {
  const heights: Record<string, number> = {
    sm: 20,
    md: 24,
    lg: 32,
    xl: 44,
  }

  const h = heights[size]
  const src = variant === 'light' ? '/rift-logo-white.png' : '/rift-logo-dark.png'

  return (
    <img
      src={src}
      alt="Rift"
      height={h}
      className={className}
      style={{
        height: h,
        width: 'auto',
        display: 'block',
      }}
      draggable={false}
    />
  )
}
