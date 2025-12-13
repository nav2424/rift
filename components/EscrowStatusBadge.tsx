type EscrowStatus = 
  | 'DRAFT'
  | 'FUNDED'
  | 'PROOF_SUBMITTED'
  | 'UNDER_REVIEW'
  | 'RELEASED'
  | 'DISPUTED'
  | 'RESOLVED'
  | 'PAYOUT_SCHEDULED'
  | 'PAID_OUT'
  | 'CANCELED'
  // Legacy statuses
  | 'AWAITING_PAYMENT'
  | 'AWAITING_SHIPMENT'
  | 'IN_TRANSIT'
  | 'DELIVERED_PENDING_RELEASE'
  | 'REFUNDED'
  | 'CANCELLED'

interface EscrowStatusBadgeProps {
  status: EscrowStatus
}

export default function EscrowStatusBadge({ status }: EscrowStatusBadgeProps) {
  const statusConfig: Record<string, { label: string; color: string }> = {
    DRAFT: { label: 'Draft', color: 'bg-white/5 text-white/60 border-white/10' },
    FUNDED: { label: 'Funded', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    PROOF_SUBMITTED: { label: 'Proof Submitted', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
    UNDER_REVIEW: { label: 'Under Review', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
    RELEASED: { label: 'Released', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
    DISPUTED: { label: 'Disputed', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
    RESOLVED: { label: 'Resolved', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
    PAYOUT_SCHEDULED: { label: 'Payout Scheduled', color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' },
    PAID_OUT: { label: 'Paid Out', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    CANCELED: { label: 'Canceled', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
    // Legacy statuses
    AWAITING_PAYMENT: { label: 'Awaiting Payment', color: 'bg-white/10 text-white/80 border-white/20' },
    AWAITING_SHIPMENT: { label: 'Awaiting Shipment', color: 'bg-white/10 text-white/80 border-white/20' },
    IN_TRANSIT: { label: 'In Transit', color: 'bg-white/10 text-white/80 border-white/20' },
    DELIVERED_PENDING_RELEASE: { label: 'Pending Release', color: 'bg-white/10 text-white/80 border-white/20' },
    REFUNDED: { label: 'Refunded', color: 'bg-white/10 text-white/60 border-white/20' },
    CANCELLED: { label: 'Cancelled', color: 'bg-white/5 text-white/40 border-white/10' },
  }

  const config = statusConfig[status] || statusConfig.DRAFT

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-light border ${config.color}`}>
      {config.label}
    </span>
  )
}
