import { ReactNode } from 'react'

interface TableProps {
  children: ReactNode
  className?: string
}

export function Table({ children, className = '' }: TableProps) {
  return (
    <table className={`w-full ${className}`}>
      {children}
    </table>
  )
}

export function TableHeader({ children, className = '' }: TableProps) {
  return (
    <thead className={className}>
      {children}
    </thead>
  )
}

export function TableBody({ children, className = '' }: TableProps) {
  return (
    <tbody className={className}>
      {children}
    </tbody>
  )
}

export function TableRow({ children, className = '' }: TableProps) {
  return (
    <tr className={className}>
      {children}
    </tr>
  )
}

export function TableHead({ children, className = '' }: TableProps) {
  return (
    <th className={`px-4 py-3 text-left text-sm font-medium ${className}`}>
      {children}
    </th>
  )
}

export function TableCell({ children, className = '' }: TableProps) {
  return (
    <td className={`px-4 py-3 text-sm ${className}`}>
      {children}
    </td>
  )
}

