'use client'

import { ReactNode, SelectHTMLAttributes } from 'react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  children: ReactNode
}

export function Select({ children, className = '', ...props }: SelectProps) {
  return (
    <select
      className={`w-full p-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-white/30 ${className}`}
      {...props}
    >
      {children}
    </select>
  )
}

export function SelectTrigger({ children, className = '', ...props }: SelectProps) {
  return <Select className={className} {...props}>{children}</Select>
}

export function SelectContent({ children }: { children: ReactNode }) {
  return <>{children}</>
}

export function SelectItem({ children, value }: { children: ReactNode; value: string }) {
  return <option value={value}>{children}</option>
}

export function SelectValue({ placeholder }: { placeholder?: string }) {
  return <>{placeholder}</>
}

