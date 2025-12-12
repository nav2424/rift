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
  variant = 'primary',
  size = 'md',
  glow = false,
  className = '',
  ...props
}: PremiumButtonProps) {
  const baseStyles = 'font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white/20 relative overflow-hidden group'
  
  const variants = {
    primary: 'bg-white text-black hover:bg-white/95 focus:ring-white/30 active:scale-[0.98]',
    outline: 'glass text-white border border-white/20 hover:border-white/30 hover:bg-white/5 focus:ring-white/20 active:scale-[0.98]',
    ghost: 'text-white/80 hover:text-white hover:bg-white/5 focus:ring-white/20 active:scale-[0.98]',
  }
  
  const sizes = {
    sm: 'px-5 py-2 text-sm',
    md: 'px-6 py-2.5 text-base',
    lg: 'px-8 py-3 text-base',
  }
  
  const glowEffect = glow ? 'shadow-[0_0_20px_rgba(255,255,255,0.2)]' : ''
  
  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${glowEffect} premium-button ${className}`}
      {...props}
    >
      <span className="relative z-10">{children}</span>
      {variant === 'primary' && (
        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
      )}
    </button>
  )
}
