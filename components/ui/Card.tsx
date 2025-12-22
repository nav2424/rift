import { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
}

export default function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`relative rounded-2xl p-6 bg-white/[0.02] backdrop-blur-sm border border-white/10 ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent rounded-2xl pointer-events-none" />
      <div className="relative">
        {children}
      </div>
    </div>
  )
}

