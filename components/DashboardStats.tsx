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

interface RiftTransaction {
  status: EscrowStatus
}

interface DashboardStatsProps {
  rifts: RiftTransaction[]
}

export default function DashboardStats({ rifts }: DashboardStatsProps) {
  const open = rifts.filter(
    (e) => !['RELEASED', 'REFUNDED', 'CANCELLED'].includes(e.status)
  ).length

  const disputed = rifts.filter((e) => e.status === 'DISPUTED').length

  const released = rifts.filter((e) => e.status === 'RELEASED').length

  return (
    <div className="space-y-4">
      <GlassCard variant="liquid" hover className="p-5 backdrop-blur-xl border border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-light text-white/40 mb-1">Open</p>
            <p className="text-3xl font-light text-white tracking-tight">{open}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
            <svg className="w-5 h-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
        </div>
      </GlassCard>
      <GlassCard variant="liquid" hover className="p-5 backdrop-blur-xl border border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-light text-white/40 mb-1">Disputed</p>
            <p className="text-3xl font-light text-white tracking-tight">{disputed}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
            <svg className="w-5 h-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        </div>
      </GlassCard>
      <GlassCard variant="liquid" hover className="p-5 backdrop-blur-xl border border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-light text-white/40 mb-1">Completed</p>
            <p className="text-3xl font-light text-white tracking-tight">{released}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
            <svg className="w-5 h-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
      </GlassCard>
    </div>
  )
}
