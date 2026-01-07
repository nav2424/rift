'use client'

interface RiftLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

export default function RiftLogo({ size = 'md', className = '' }: RiftLogoProps) {
  const sizes = {
    sm: 60,
    md: 80,
    lg: 120,
    xl: 160,
  }

  const height = sizes[size]

  return (
    <div 
      className={`inline-flex items-center ${className}`} 
      style={{ 
        margin: 0, 
        padding: 0, 
        lineHeight: 0,
        background: 'transparent',
        backgroundColor: 'transparent'
      }}
    >
      <img
        src="/rift-logo.png"
        alt="Rift"
        width={height}
        height={height}
        className="object-contain"
        style={{ 
          display: 'block', 
          margin: 0,
          padding: 0,
          border: 'none',
          outline: 'none',
          boxShadow: 'none',
          verticalAlign: 'middle',
          background: 'transparent',
          backgroundColor: 'transparent'
        }}
      />
    </div>
  )
}

