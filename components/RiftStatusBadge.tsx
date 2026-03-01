import { EscrowStatus } from '@prisma/client'

interface RiftStatusBadgeProps {
  status: EscrowStatus
}

export default function RiftStatusBadge({ status }: RiftStatusBadgeProps) {
  const statusConfig: Record<string, { label: string; color: string }> = {
    DRAFT: { label: 'Draft', color: 'bg-gray-50 text-[#86868b] border-gray-200' },
    FUNDED: { label: 'Paid', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' }, // Paid - Blue
    PAID: { label: 'Paid', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' }, // Paid - Blue
    PROOF_SUBMITTED: { label: 'Proof Submitted', color: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
    UNDER_REVIEW: { label: 'Under Review', color: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
    RELEASED: { label: 'Released', color: 'bg-green-500/10 text-green-400 border-green-500/30' }, // Released - Green
    DISPUTED: { label: 'Disputed', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' }, // Disputed - Yellow
    RESOLVED: { label: 'Resolved', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' },
    PAYOUT_SCHEDULED: { label: 'Payout Scheduled', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' },
    PAID_OUT: { label: 'Paid Out', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' },
    CANCELED: { label: 'Canceled', color: 'bg-gray-500/10 text-gray-400 border-gray-500/30' },
    // Legacy statuses
    AWAITING_PAYMENT: { label: 'Awaiting Payment', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' }, // Paid - Blue
    AWAITING_SHIPMENT: { label: 'Awaiting Shipment', color: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
    IN_TRANSIT: { label: 'In Transit', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' },
    DELIVERED_PENDING_RELEASE: { label: 'Pending Release', color: 'bg-teal-500/10 text-teal-400 border-teal-500/30' },
    REFUNDED: { label: 'Refunded', color: 'bg-red-500/10 text-red-400 border-red-500/30' },
    CANCELLED: { label: 'Cancelled', color: 'bg-gray-500/10 text-gray-400 border-gray-500/30' },
  }

  const config = statusConfig[status] || statusConfig.DRAFT

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-light border ${config.color}`}>
      {config.label}
    </span>
  )
}
