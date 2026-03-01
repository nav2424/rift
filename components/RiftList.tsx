import Link from 'next/link'
import EscrowStatusBadge from './RiftStatusBadge'
import GlassCard from './ui/GlassCard'
import { EscrowStatus } from '@prisma/client'

interface RiftTransaction {
  id: string
  riftNumber: number | null
  itemTitle: string
  amount: number | null
  currency: string
  status: EscrowStatus
  buyer: { name: string | null; email: string }
  seller: { name: string | null; email: string }
}

interface EscrowListProps {
  rifts: RiftTransaction[]
  title: string
  showAdminActions?: boolean
}

export default function EscrowList({ rifts, title, showAdminActions = false }: EscrowListProps) {
  if (rifts.length === 0) {
    return (
      <GlassCard variant="liquid" className="p-6 backdrop-blur-xl border border-gray-200">
        <h3 className="text-sm font-light text-[#86868b] mb-3 tracking-wide uppercase">{title}</h3>
        <p className="text-gray-400 font-light text-sm">No rifts found.</p>
      </GlassCard>
    )
  }

  return (
    <GlassCard variant="liquid" className="p-6 backdrop-blur-xl border border-gray-200">
      <h3 className="text-sm font-light text-[#86868b] mb-4 tracking-wide uppercase">{title}</h3>
      <div className="space-y-5">
        {rifts.map((rift) => (
          <div
            key={rift.id}
            className="glass-light p-4 rounded-xl border border-gray-100 hover:border-gray-200 transition-all duration-300 hover:bg-gray-50"
          >
            <div className="flex items-start justify-between gap-4">
              <Link href={`/rifts/${rift.id}`} className="flex-1 min-w-0 group">
                <div className="flex items-center gap-2 mb-1.5">
                  {rift.riftNumber && (
                    <span className="text-xs text-[#86868b] font-light font-mono">#{rift.riftNumber}</span>
                  )}
                  <h4 className="text-[#1d1d1f] font-light text-base tracking-tight truncate group-hover:text-gray-800">{rift.itemTitle}</h4>
                </div>
                <div className="flex items-center gap-3 mb-1.5">
                  <p className="text-sm text-gray-700 font-light">
                    {rift.amount != null ? `${(rift.amount || 0).toFixed(2)} ${rift.currency}` : 'N/A'}
                  </p>
                </div>
                <p className="text-xs text-gray-400 font-light truncate">
                  {title.includes('Buying') ? `Seller: ${rift.seller.name || rift.seller.email}` : `Buyer: ${rift.buyer.name || rift.buyer.email}`}
                </p>
              </Link>
              <div className="flex-shrink-0 flex items-center gap-2">
                <EscrowStatusBadge status={rift.status} />
                {showAdminActions && (
                  <Link
                    href={`/admin/vault/${rift.id}`}
                    className="px-3 py-1.5 text-xs font-light text-[#86868b] hover:text-[#1d1d1f] border border-gray-300 hover:border-white/40 rounded transition-colors"
                  >
                    Vault
                  </Link>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  )
}
