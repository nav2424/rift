import { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
}

export default function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`glass-light rounded-2xl p-6 backdrop-blur-xl border border-white/10 ${className}`}>
      {children}
    </div>
  )
}

