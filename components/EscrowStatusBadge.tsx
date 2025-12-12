type EscrowStatus = 
  | 'AWAITING_PAYMENT'
  | 'AWAITING_SHIPMENT'
  | 'IN_TRANSIT'
  | 'DELIVERED_PENDING_RELEASE'
  | 'RELEASED'
  | 'REFUNDED'
  | 'DISPUTED'
  | 'CANCELLED'

interface EscrowStatusBadgeProps {
  status: EscrowStatus
}

export default function EscrowStatusBadge({ status }: EscrowStatusBadgeProps) {
  const statusConfig = {
    AWAITING_PAYMENT: { label: 'Awaiting Payment', color: 'bg-white/10 text-white/80 border-white/20' },
    AWAITING_SHIPMENT: { label: 'Awaiting Shipment', color: 'bg-white/10 text-white/80 border-white/20' },
    IN_TRANSIT: { label: 'In Transit', color: 'bg-white/10 text-white/80 border-white/20' },
    DELIVERED_PENDING_RELEASE: { label: 'Pending Release', color: 'bg-white/10 text-white/80 border-white/20' },
    RELEASED: { label: 'Released', color: 'bg-white/10 text-white border-white/30' },
    REFUNDED: { label: 'Refunded', color: 'bg-white/10 text-white/60 border-white/20' },
    DISPUTED: { label: 'Disputed', color: 'bg-white/10 text-white/90 border-white/30' },
    CANCELLED: { label: 'Cancelled', color: 'bg-white/5 text-white/40 border-white/10' },
  }

  const config = statusConfig[status] || statusConfig.AWAITING_PAYMENT

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-light border ${config.color}`}>
      {config.label}
    </span>
  )
}
