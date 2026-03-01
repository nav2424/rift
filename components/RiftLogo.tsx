'use client'

interface RiftLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  variant?: 'dark' | 'light'
}

export default function RiftLogo({ size = 'md', className = '', variant = 'dark' }: RiftLogoProps) {
  const styles = {
    sm: 'text-[15px]',
    md: 'text-[17px]',
    lg: 'text-[22px]',
    xl: 'text-[28px]',
  }

  const color = variant === 'light' ? 'text-white' : 'text-[#1d1d1f]'

  return (
    <span
      className={`${styles[size]} ${color} font-semibold tracking-[0.08em] select-none ${className}`}
      style={{ fontFeatureSettings: '"kern" 1' }}
    >
      RIFT
    </span>
  )
}
