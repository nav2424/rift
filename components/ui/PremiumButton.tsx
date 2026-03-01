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
  const baseStyles = 'inline-flex items-center justify-center rounded-xl font-medium transition duration-200 focus:outline-none focus:ring-2 focus:ring-gray-300 relative overflow-hidden group'
  
  const variants = {
    primary: 'bg-[#1d1d1f] text-[#1d1d1f] shadow-[0_14px_40px_rgba(0,0,0,0.12)] hover:shadow-[0_18px_60px_rgba(0,0,0,0.18)] active:scale-[0.99]',
    outline: 'border border-gray-300 text-[#1d1d1f] hover:bg-gray-50 hover:text-[#1d1d1f] active:scale-[0.99]',
    ghost: 'text-gray-700 hover:text-[#1d1d1f] hover:bg-gray-50 focus:ring-gray-300 active:scale-[0.99]',
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
