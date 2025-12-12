import Link from 'next/link'
import EscrowStatusBadge from './EscrowStatusBadge'

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
  adminNote: string | null
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
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
        <p className="text-slate-400">No disputes found.</p>
      </div>
    )
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-slate-800">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
              Rift #
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
              Buyer
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
              Seller
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
              Raised By
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
              Created
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {disputes.map((dispute) => (
            <tr key={dispute.id} className="hover:bg-slate-800/50">
              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                #{dispute.escrow.riftNumber}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                {dispute.escrow.buyer.email}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                {dispute.escrow.seller.email}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <EscrowStatusBadge status={dispute.escrow.status} />
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                {dispute.raisedBy.email}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                {new Date(dispute.createdAt).toLocaleDateString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <Link
                  href={`/escrows/${dispute.escrowId}`}
                  className="text-blue-400 hover:text-blue-300"
                >
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

