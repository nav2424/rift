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
      <GlassCard variant="liquid" className="p-6 backdrop-blur-xl border border-white/10">
        <h3 className="text-sm font-light text-white/50 mb-3 tracking-wide uppercase">{title}</h3>
        <p className="text-white/40 font-light text-sm">No rifts found.</p>
      </GlassCard>
    )
  }

  return (
    <GlassCard variant="liquid" className="p-6 backdrop-blur-xl border border-white/10">
      <h3 className="text-sm font-light text-white/50 mb-4 tracking-wide uppercase">{title}</h3>
      <div className="space-y-5">
        {rifts.map((rift) => (
          <div
            key={rift.id}
            className="glass-light p-4 rounded-xl border border-white/5 hover:border-white/10 transition-all duration-300 hover:bg-white/5"
          >
            <div className="flex items-start justify-between gap-4">
              <Link href={`/rifts/${rift.id}`} className="flex-1 min-w-0 group">
                <div className="flex items-center gap-2 mb-1.5">
                  {rift.riftNumber && (
                    <span className="text-xs text-white/50 font-light font-mono">#{rift.riftNumber}</span>
                  )}
                  <h4 className="text-white font-light text-base tracking-tight truncate group-hover:text-white/90">{rift.itemTitle}</h4>
                </div>
                <div className="flex items-center gap-3 mb-1.5">
                  <p className="text-sm text-white/80 font-light">
                    {rift.amount != null ? `${(rift.amount || 0).toFixed(2)} ${rift.currency}` : 'N/A'}
                  </p>
                </div>
                <p className="text-xs text-white/40 font-light truncate">
                  {title.includes('Buying') ? `Seller: ${rift.seller.name || rift.seller.email}` : `Buyer: ${rift.buyer.name || rift.buyer.email}`}
                </p>
              </Link>
              <div className="flex-shrink-0 flex items-center gap-2">
                <EscrowStatusBadge status={rift.status} />
                {showAdminActions && (
                  <Link
                    href={`/admin/vault/${rift.id}`}
                    className="px-3 py-1.5 text-xs font-light text-white/60 hover:text-white border border-white/20 hover:border-white/40 rounded transition-colors"
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
