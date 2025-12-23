import { requireAdmin } from '@/lib/auth-helpers'
import DisputeQueue from '@/components/DisputeQueue'

export default async function AdminDisputesPage() {
  await requireAdmin()

  return (
    <div className="min-h-screen relative overflow-hidden bg-black">
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-20">
        <div className="mb-8">
          <h1 className="text-4xl font-light text-white tracking-tight">Dispute Queue</h1>
          <p className="text-white/60 font-light mt-2">Review and resolve disputes</p>
        </div>

        <DisputeQueue />
      </div>
    </div>
  )
}

