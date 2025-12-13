import Link from 'next/link'
import EscrowStatusBadge from './EscrowStatusBadge'
import GlassCard from './ui/GlassCard'

type EscrowStatus = 
  | 'AWAITING_PAYMENT'
  | 'AWAITING_SHIPMENT'
  | 'IN_TRANSIT'
  | 'DELIVERED_PENDING_RELEASE'
  | 'RELEASED'
  | 'REFUNDED'
  | 'DISPUTED'
  | 'CANCELLED'

interface Dispute {
  id: string
  escrowId: string
  raisedById: string
  reason: string
  status: 'OPEN' | 'RESOLVED'
  adminNotes: string | null
  resolvedById: string | null
  createdAt: Date
  updatedAt: Date
  escrow: {
    id: string
    riftNumber: number
    status: EscrowStatus
    buyer: { email: string }
    seller: { email: string }
  }
  raisedBy: { email: string }
}

interface AdminDisputeListProps {
  disputes: Dispute[]
}

export default function AdminDisputeList({ disputes }: AdminDisputeListProps) {
  if (disputes.length === 0) {
    return (
      <GlassCard variant="strong" className="p-8">
        <p className="text-white/60 font-light text-center">No disputes found.</p>
      </GlassCard>
    )
  }

  return (
    <GlassCard variant="strong" className="overflow-hidden">
      <table className="w-full">
        <thead className="border-b border-white/10">
          <tr>
            <th className="px-6 py-4 text-left text-xs font-light text-white/60 uppercase tracking-wider">
              Rift #
            </th>
            <th className="px-6 py-4 text-left text-xs font-light text-white/60 uppercase tracking-wider">
              Buyer
            </th>
            <th className="px-6 py-4 text-left text-xs font-light text-white/60 uppercase tracking-wider">
              Seller
            </th>
            <th className="px-6 py-4 text-left text-xs font-light text-white/60 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-4 text-left text-xs font-light text-white/60 uppercase tracking-wider">
              Raised By
            </th>
            <th className="px-6 py-4 text-left text-xs font-light text-white/60 uppercase tracking-wider">
              Reason
            </th>
            <th className="px-6 py-4 text-left text-xs font-light text-white/60 uppercase tracking-wider">
              Created
            </th>
            <th className="px-6 py-4 text-left text-xs font-light text-white/60 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {disputes.map((dispute) => (
            <tr key={dispute.id} className="hover:bg-white/5 transition-colors">
              <td className="px-6 py-4 whitespace-nowrap text-sm text-white font-light">
                #{dispute.escrow.riftNumber}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-white/80 font-light">
                {dispute.escrow.buyer.email}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-white/80 font-light">
                {dispute.escrow.seller.email}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <EscrowStatusBadge status={dispute.escrow.status} />
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-white/80 font-light">
                {dispute.raisedBy.email}
              </td>
              <td className="px-6 py-4 text-sm text-white/70 font-light max-w-xs truncate">
                {dispute.reason}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-white/60 font-light">
                {new Date(dispute.createdAt).toLocaleDateString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <Link
                  href={`/escrows/${dispute.escrowId}`}
                  className="text-blue-400 hover:text-blue-300 font-light transition-colors"
                >
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </GlassCard>
  )
}

