import { requireAdmin } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import AdminDisputeList from '@/components/AdminDisputeList'
import AdminUserList from '@/components/AdminUserList'
import RiftList from '@/components/RiftList'
import GlassCard from '@/components/ui/GlassCard'
import CollapsibleSection from '@/components/ui/CollapsibleSection'
import Link from 'next/link'

export default async function AdminPage() {
  await requireAdmin()

  // Get all users with verification status
  const allUsers = await prisma.user.findMany({
    select: {
      id: true,
      riftUserId: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      createdAt: true,
      updatedAt: true,
      totalProcessedAmount: true,
      availableBalance: true,
      pendingBalance: true,
      numCompletedTransactions: true,
      averageRating: true,
      responseTimeMs: true,
      idVerified: true,
      bankVerified: true,
      emailVerified: true,
      phoneVerified: true,
      stripeIdentityVerified: true,
      _count: {
        select: {
          EscrowTransaction_EscrowTransaction_sellerIdToUser: true,
          EscrowTransaction_EscrowTransaction_buyerIdToUser: true,
          Activity: true,
          // Note: disputes are stored in Supabase, not Prisma
          // Dispute counts would need to be fetched separately from Supabase
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  // Get all rifts (no limit - show all data)
  const allRifts = await prisma.riftTransaction.findMany({
    include: {
      buyer: {
        select: {
          name: true,
          email: true,
        },
      },
      seller: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  // Get pending proofs count
  const pendingProofsCount = await prisma.proof.count({
    where: {
      status: 'PENDING',
    },
  })

  // Get disputes from Supabase (new dispute system)
  // Note: Disputes are now stored in Supabase, not Prisma
  // We'll fetch a count for the stats, but the full list is in /admin/disputes page
  const { createServerClient } = await import('@/lib/supabase')
  const supabase = createServerClient()
  const { count: disputesCount } = await supabase
    .from('disputes')
    .select('*', { count: 'exact', head: true })
    .in('status', ['submitted', 'needs_info', 'under_review'])
  
  const openDisputesCount = disputesCount || 0

  return (
    <div className="min-h-screen relative overflow-hidden bg-black">
      {/* Subtle grid background */}
      <div className="fixed inset-0 opacity-[0.02] pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
        backgroundSize: '50px 50px'
      }} />
      
      {/* Minimal floating elements */}
      <div className="fixed top-20 left-10 w-96 h-96 bg-white/[0.02] rounded-full blur-3xl float pointer-events-none" />
      <div className="fixed bottom-20 right-10 w-[500px] h-[500px] bg-white/[0.01] rounded-full blur-3xl float pointer-events-none" style={{ animationDelay: '2s' }} />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-12">
        <div className="mb-12">
          <h1 className="text-5xl md:text-6xl font-light text-white mb-3 tracking-tight">
            Admin Panel
          </h1>
          <p className="text-white/60 font-light">Manage all users, transactions, and disputes</p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-12">
          <GlassCard>
            <div className="p-6">
              <p className="text-xs text-white/60 font-light uppercase tracking-wider mb-2">Total Users</p>
              <p className="text-4xl font-light text-white mb-2 tracking-tight">{allUsers.length}</p>
              <p className="text-sm text-white/40 font-light">
                {allUsers.filter(u => u.role === 'ADMIN').length} admins
              </p>
            </div>
          </GlassCard>
          <GlassCard>
            <div className="p-6">
              <p className="text-xs text-white/60 font-light uppercase tracking-wider mb-2">Total Volume</p>
              <p className="text-4xl font-light text-white mb-2 tracking-tight">
                ${allUsers.reduce((sum, u) => sum + u.totalProcessedAmount, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-sm text-white/40 font-light">
                {allUsers.reduce((sum, u) => sum + u.numCompletedTransactions, 0)} transactions
              </p>
            </div>
          </GlassCard>
          <Link href="/admin/disputes">
            <GlassCard className="cursor-pointer hover:bg-white/5 transition-colors">
            <div className="p-6">
              <p className="text-xs text-white/60 font-light uppercase tracking-wider mb-2">Open Disputes</p>
              <p className="text-4xl font-light text-white mb-2 tracking-tight">{openDisputesCount}</p>
                <p className="text-sm text-white/40 font-light">Click to review →</p>
            </div>
          </GlassCard>
          </Link>
          <Link href="/admin/proofs">
            <GlassCard className="cursor-pointer hover:bg-white/5 transition-colors">
              <div className="p-6">
                <p className="text-xs text-white/60 font-light uppercase tracking-wider mb-2">Pending Proofs</p>
                <p className="text-4xl font-light text-white mb-2 tracking-tight">{pendingProofsCount}</p>
                <p className="text-sm text-white/40 font-light">Awaiting review</p>
              </div>
            </GlassCard>
          </Link>
          <GlassCard>
            <div className="p-6">
              <p className="text-xs text-white/60 font-light uppercase tracking-wider mb-2">Verified Users</p>
              <p className="text-4xl font-light text-white mb-2 tracking-tight">
                {allUsers.filter(u => u.emailVerified && u.phoneVerified).length}
              </p>
              <p className="text-sm text-white/40 font-light">
                {allUsers.filter(u => u.emailVerified && u.phoneVerified && u.idVerified && u.bankVerified).length} fully verified
              </p>
            </div>
          </GlassCard>
        </div>

        <CollapsibleSection title="All Users" count={allUsers.length}>
          <AdminUserList users={allUsers} />
        </CollapsibleSection>

        <CollapsibleSection title="Open Disputes" count={openDisputesCount}>
          <div className="mb-6">
            <Link 
              href="/admin/disputes"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 transition-all duration-200 border border-white/20 text-white font-light text-sm"
            >
              View All Disputes ({openDisputesCount})
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
          <GlassCard variant="strong" className="p-8">
            <p className="text-white/60 font-light text-center">
              View all disputes in the <Link href="/admin/disputes" className="text-white/80 hover:text-white underline">Dispute Queue</Link>
            </p>
          </GlassCard>
        </CollapsibleSection>

        <CollapsibleSection title="All Transactions" count={allRifts.length}>
          <RiftList rifts={allRifts} title="All Transactions" showAdminActions={true} />
        </CollapsibleSection>
      </div>
    </div>
  )
}

