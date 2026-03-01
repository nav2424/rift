'use client'

import { ReactNode, SelectHTMLAttributes } from 'react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  children: ReactNode
}

export function Select({ children, className = '', ...props }: SelectProps) {
  return (
    <select
      className={`w-full p-2 rounded-lg bg-gray-50 border border-gray-200 text-[#1d1d1f] focus:outline-none focus:border-gray-300 ${className}`}
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


