import Link from 'next/link'
import EscrowStatusBadge from './EscrowStatusBadge'
import GlassCard from './ui/GlassCard'
import { EscrowStatus } from '@prisma/client'

interface EscrowTransaction {
  id: string
  itemTitle: string
  amount: number | null
  currency: string
  status: EscrowStatus
  buyer: { name: string | null; email: string }
  seller: { name: string | null; email: string }
}

interface EscrowListProps {
  escrows: EscrowTransaction[]
  title: string
}

export default function EscrowList({ escrows, title }: EscrowListProps) {
  if (escrows.length === 0) {
    return (
      <GlassCard variant="liquid" className="p-6 backdrop-blur-xl border border-white/10">
        <h3 className="text-sm font-light text-white/50 mb-3 tracking-wide uppercase">{title}</h3>
        <p className="text-white/40 font-light text-sm">No escrows found.</p>
      </GlassCard>
    )
  }

  return (
    <GlassCard variant="liquid" className="p-6 backdrop-blur-xl border border-white/10">
      <h3 className="text-sm font-light text-white/50 mb-4 tracking-wide uppercase">{title}</h3>
      <div className="space-y-3">
        {escrows.map((escrow) => (
          <Link
            key={escrow.id}
            href={`/escrows/${escrow.id}`}
            className="block group"
          >
            <div className="glass-light p-4 rounded-xl border border-white/5 hover:border-white/10 transition-all duration-300 hover:bg-white/5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h4 className="text-white font-light mb-1.5 text-base tracking-tight truncate group-hover:text-white/90">{escrow.itemTitle}</h4>
                  <div className="flex items-center gap-3 mb-1.5">
                    <p className="text-sm text-white/80 font-light">
                      {escrow.amount != null ? `${escrow.amount} ${escrow.currency}` : 'N/A'}
                    </p>
                  </div>
                  <p className="text-xs text-white/40 font-light truncate">
                    {title.includes('Buying') ? `Seller: ${escrow.seller.name || escrow.seller.email}` : `Buyer: ${escrow.buyer.name || escrow.buyer.email}`}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <EscrowStatusBadge status={escrow.status} />
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </GlassCard>
  )
}
