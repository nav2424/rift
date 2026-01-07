'use client'

import { ReactNode, HTMLAttributes } from 'react'

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  variant?: 'glass' | 'strong' | 'light' | 'liquid'
  hover?: boolean
}

export default function GlassCard({ 
  children, 
  variant = 'glass',
  hover = false,
  className = '',
  ...props 
}: GlassCardProps) {
  const baseStyles = 'rounded-2xl transition-all duration-300'
  
  const variants = {
    glass: 'glass',
    strong: 'glass-strong',
    light: 'glass-light',
    liquid: 'liquid-glass glass liquid',
  }
  
  const hoverEffect = hover 
    ? 'glass-card-hover cursor-pointer' 
    : ''
  
  return (
    <div
      className={`${baseStyles} ${variants[variant]} ${hoverEffect} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
