import { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className = '', ...props }: InputProps) {
  return (
    <input
      className={`w-full p-3 rounded-xl bg-gray-50 border border-gray-200 text-[#1d1d1f] placeholder-gray-400 focus:outline-none focus:border-gray-300 ${className}`}
      {...props}
    />
  )
}


