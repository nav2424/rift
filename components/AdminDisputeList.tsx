import Link from 'next/link'
import EscrowStatusBadge from './RiftStatusBadge'
import GlassCard from './ui/GlassCard'
import { EscrowStatus, DisputeStatus } from '@prisma/client'

interface Dispute {
  id: string
  escrowId: string
  raisedById: string
  reason: string
  status: DisputeStatus
  adminNotes: string | null
  resolvedById: string | null
  createdAt: Date
  updatedAt: Date
  EscrowTransaction: {
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
        <p className="text-[#86868b] font-light text-center">No disputes found.</p>
      </GlassCard>
    )
  }

  return (
    <GlassCard variant="strong" className="overflow-hidden">
      <table className="w-full">
        <thead className="border-b border-gray-200">
          <tr>
            <th className="px-6 py-4 text-left text-xs font-light text-[#86868b] uppercase tracking-wider">
              Rift #
            </th>
            <th className="px-6 py-4 text-left text-xs font-light text-[#86868b] uppercase tracking-wider">
              Buyer
            </th>
            <th className="px-6 py-4 text-left text-xs font-light text-[#86868b] uppercase tracking-wider">
              Seller
            </th>
            <th className="px-6 py-4 text-left text-xs font-light text-[#86868b] uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-4 text-left text-xs font-light text-[#86868b] uppercase tracking-wider">
              Raised By
            </th>
            <th className="px-6 py-4 text-left text-xs font-light text-[#86868b] uppercase tracking-wider">
              Reason
            </th>
            <th className="px-6 py-4 text-left text-xs font-light text-[#86868b] uppercase tracking-wider">
              Created
            </th>
            <th className="px-6 py-4 text-left text-xs font-light text-[#86868b] uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {disputes.map((dispute) => (
            <tr key={dispute.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-6 py-4 whitespace-nowrap text-sm text-[#1d1d1f] font-light">
                #{dispute.EscrowTransaction.riftNumber}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-light">
                {dispute.EscrowTransaction.buyer.email}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-light">
                {dispute.EscrowTransaction.seller.email}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <EscrowStatusBadge status={dispute.EscrowTransaction.status} />
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-light">
                {dispute.raisedBy.email}
              </td>
              <td className="px-6 py-4 text-sm text-gray-600 font-light max-w-xs truncate">
                {dispute.reason}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-[#86868b] font-light">
                {new Date(dispute.createdAt).toLocaleDateString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <Link
                  href={`/rifts/${dispute.escrowId}`}
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

