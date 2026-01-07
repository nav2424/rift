'use client'

import { EscrowStatus } from '@prisma/client'

interface StatusPillProps {
  status: EscrowStatus | string
  className?: string
}

/**
 * StatusPill component for displaying Rift lifecycle status
 * Maps all Rift statuses to user-friendly labels with appropriate colors
 */
export default function StatusPill({ status, className = '' }: StatusPillProps) {
  const statusConfig: Record<string, { label: string; color: string }> = {
    // Core lifecycle
    DRAFT: { label: 'Draft', color: 'bg-white/5 text-white/60 border-white/10' },
    CREATED: { label: 'Created', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
    AWAITING_PAYMENT: { label: 'Awaiting Payment', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
    FUNDED: { label: 'Funds Secured', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
    PROOF_SUBMITTED: { label: 'Awaiting Delivery', color: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
    UNDER_REVIEW: { label: 'In Review', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
    ACTION_NEEDED: { label: 'Action Needed', color: 'bg-orange-500/10 text-orange-400 border-orange-500/30' },
    DISPUTED: { label: 'Disputed', color: 'bg-red-500/10 text-red-400 border-red-500/30' },
    RESOLVED: { label: 'Resolved', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' },
    APPROVED: { label: 'Approved', color: 'bg-green-500/10 text-green-400 border-green-500/30' },
    RELEASED: { label: 'Released', color: 'bg-green-500/10 text-green-400 border-green-500/30' },
    COMPLETED: { label: 'Completed', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
    CANCELLED: { label: 'Cancelled', color: 'bg-gray-500/10 text-gray-400 border-gray-500/30' },
    CANCELED: { label: 'Cancelled', color: 'bg-gray-500/10 text-gray-400 border-gray-500/30' },
    
    // Legacy statuses
    AWAITING_SHIPMENT: { label: 'Awaiting Shipment', color: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
    IN_TRANSIT: { label: 'In Transit', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' },
    DELIVERED_PENDING_RELEASE: { label: 'Pending Release', color: 'bg-teal-500/10 text-teal-400 border-teal-500/30' },
    REFUNDED: { label: 'Refunded', color: 'bg-red-500/10 text-red-400 border-red-500/30' },
    PAYOUT_SCHEDULED: { label: 'Payout Scheduled', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' },
    PAID_OUT: { label: 'Paid Out', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
    PAID: { label: 'Paid', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  }

  const config = statusConfig[status] || statusConfig.DRAFT

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-light border ${config.color} ${className}`}>
      {config.label}
    </span>
  )
}

