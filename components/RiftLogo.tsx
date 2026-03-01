'use client'

interface RiftLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

export default function RiftLogo({ size = 'md', className = '' }: RiftLogoProps) {
  const fontSizes = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
    xl: 'text-3xl',
  }

  return (
    <div className={`inline-flex items-center ${className}`}>
      <span className={`${fontSizes[size]} font-semibold tracking-[-0.04em] text-[#1d1d1f]`}>
        RIFT
      </span>
    </div>
  )
}
