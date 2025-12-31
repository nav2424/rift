'use client'

import { ButtonHTMLAttributes, ReactNode } from 'react'

interface PremiumButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: 'primary' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  glow?: boolean
}

export default function PremiumButton({
  children,
  variant = 'outline',
  size = 'md',
  glow = false,
  className = '',
  ...props
}: PremiumButtonProps) {
  const baseStyles = 'font-medium rounded-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-white/20 relative overflow-hidden group'
  
  const variants = {
    primary: 'glass text-white border border-white/20 hover:border-white/30 hover:bg-white/5 focus:ring-white/20 active:scale-[0.98]',
    outline: 'glass text-white border border-white/20 hover:border-white/30 hover:bg-white/5 focus:ring-white/20 active:scale-[0.98]',
    ghost: 'text-white/80 hover:text-white hover:bg-white/5 focus:ring-white/20 active:scale-[0.98]',
  }
  
  const sizes = {
    sm: 'px-5 py-2.5 text-sm min-h-[44px]',
    md: 'px-6 py-3 text-base min-h-[44px]',
    lg: 'px-8 py-4 text-base min-h-[48px]',
  }
  
  const glowEffect = ''
  
  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${glowEffect} premium-button ${className}`}
      {...props}
    >
      <span className="relative z-10 flex items-center justify-center gap-3">{children}</span>
    </button>
  )
}
