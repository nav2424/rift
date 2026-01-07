'use client'

import { ReactNode } from 'react'
import Link from 'next/link'
import Button from './Button'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description: string
  action?: {
    label: string
    href?: string
    onClick?: () => void
  }
  className?: string
}

/**
 * EmptyState component for displaying empty states with clear CTAs
 */
export default function EmptyState({
  icon,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  const defaultIcon = (
    <svg className="w-12 h-12 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
    </svg>
  )

  const actionButton = action && (
    action.href ? (
      <Link href={action.href}>
        <Button variant="primary" size="lg">
          {action.label}
        </Button>
      </Link>
    ) : (
      <Button variant="primary" size="lg" onClick={action.onClick}>
        {action.label}
      </Button>
    )
  )

  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}>
      <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6">
        {icon || defaultIcon}
      </div>
      <h3 className="text-xl font-light text-white mb-2">{title}</h3>
      <p className="text-white/60 font-light text-sm max-w-md mb-6">{description}</p>
      {actionButton}
    </div>
  )
}

