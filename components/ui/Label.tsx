import { ReactNode, LabelHTMLAttributes } from 'react'

interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  children: ReactNode
}

export function Label({ children, className = '', ...props }: LabelProps) {
  return (
    <label className={`block text-sm font-medium text-white/80 mb-2 ${className}`} {...props}>
      {children}
    </label>
  )
}

