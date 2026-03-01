import { requireAdmin } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import GlassCard from '@/components/ui/GlassCard'
import AdminUserActions from '@/components/AdminUserActions'
import RiftList from '@/components/RiftList'

export default async function AdminUserDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  try {
    await requireAdmin()
    const { userId } = await params

    if (!userId) {
      return (
        <div className="min-h-screen relative overflow-hidden bg-white flex items-center justify-center">
          <GlassCard variant="strong" className="p-8">
            <div className="text-[#86868b] font-light text-center">
              <p className="text-xl mb-4">Invalid user ID</p>
              <Link 
                href="/admin" 
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-gray-300 text-gray-600 hover:text-[#1d1d1f] font-light transition-all duration-200 group"
              >
                <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Admin Panel
              </Link>
            </div>
          </GlassCard>
        </div>
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
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
        level: true,
        xp: true,
        idVerified: true,
        bankVerified: true,
        emailVerified: true,
        phoneVerified: true,
        stripeIdentityVerified: true,
        stripeConnectAccountId: true,
        _count: {
          select: {
            sellerTransactions: true,
            buyerTransactions: true,
            // Note: disputes are stored in Supabase, not Prisma
            // Dispute counts would need to be fetched separately from Supabase
          },
        },
      },
    })

    if (!user) {
      return (
        <div className="min-h-screen relative overflow-hidden bg-white flex items-center justify-center">
          <GlassCard variant="strong" className="p-8">
            <div className="text-[#86868b] font-light text-center">
              <p className="text-xl mb-4">User not found</p>
              <p className="text-sm text-gray-400 mb-4">User ID: {userId}</p>
              <Link 
                href="/admin" 
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-gray-300 text-gray-600 hover:text-[#1d1d1f] font-light transition-all duration-200 group"
              >
                <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Admin Panel
              </Link>
            </div>
          </GlassCard>
        </div>
      )
    }

  // Get all transactions (both as buyer and seller)
  // Use explicit select to avoid schema mismatch issues with archive fields
  const buyerTransactions = await prisma.riftTransaction.findMany({
    where: { buyerId: userId },
    select: {
      id: true,
      riftNumber: true,
      itemTitle: true,
      amount: true,
      currency: true,
      status: true,
      buyerId: true,
      sellerId: true,
      createdAt: true,
      updatedAt: true,
      subtotal: true,
      buyerFee: true,
      sellerFee: true,
      sellerNet: true,
      buyer: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      seller: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  const sellerTransactions = await prisma.riftTransaction.findMany({
    where: { sellerId: userId },
    select: {
      id: true,
      riftNumber: true,
      itemTitle: true,
      amount: true,
      currency: true,
      status: true,
      buyerId: true,
      sellerId: true,
      createdAt: true,
      updatedAt: true,
      subtotal: true,
      buyerFee: true,
      sellerFee: true,
      sellerNet: true,
      buyer: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      seller: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  // Get all payouts/withdrawals
  const payouts = await prisma.payout.findMany({
    where: { userId: userId },
    orderBy: {
      createdAt: 'desc',
    },
  })

  // Get disputes raised by this user
  const { createServerClient } = await import('@/lib/supabase')
  const supabase = createServerClient()
  const { data: disputesRaised } = await supabase
    .from('disputes')
    .select('*')
    .eq('opened_by', userId)
    .order('created_at', { ascending: false })

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatPhoneNumber = (phone: string | null | undefined): string => {
    if (!phone) return 'Not provided'
    
    // If phone is already in E.164 format (+1234567890), format it nicely
    // Remove the + sign for formatting
    const cleaned = phone.replace(/^\+/, '')
    
    // US/Canada format: (123) 456-7890
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      const areaCode = cleaned.slice(1, 4)
      const exchange = cleaned.slice(4, 7)
      const number = cleaned.slice(7, 11)
      return `+1 (${areaCode}) ${exchange}-${number}`
    }
    
    // US/Canada without country code: (123) 456-7890
    if (cleaned.length === 10) {
      const areaCode = cleaned.slice(0, 3)
      const exchange = cleaned.slice(3, 6)
      const number = cleaned.slice(6, 10)
      return `(${areaCode}) ${exchange}-${number}`
    }
    
    // Return original if format is unknown
    return phone
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-white">
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-20">
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="flex-1">
              <h1 className="text-4xl md:text-5xl font-light text-[#1d1d1f] tracking-tight mb-2">
                {user.name || user.email}
              </h1>
              <p className="text-[#86868b] font-light">{user.email}</p>
              {user.riftUserId && (
                <p className="text-gray-400 font-light font-mono text-sm mt-1">{user.riftUserId}</p>
              )}
            </div>
            <Link 
              href="/admin" 
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-gray-300 text-gray-600 hover:text-[#1d1d1f] font-light transition-all duration-200 group flex-shrink-0 mt-1"
            >
              <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Admin Panel
            </Link>
          </div>
        </div>

        {/* User Info and Stats - Consolidated */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
          <div className="lg:col-span-2 space-y-6">
            <div>
              <h2 className="text-xl font-light text-[#1d1d1f] mb-6 pb-4 border-b border-gray-200">User Information</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[#86868b] text-sm font-light mb-1">Full Name</p>
                  <p className="text-[#1d1d1f] font-light">{user.name || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-[#86868b] text-sm font-light mb-1">Role</p>
                  <span className={`inline-block px-3 py-1.5 text-xs font-light rounded-lg border ${
                    user.role === 'ADMIN'
                      ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                      : 'bg-gray-50 text-gray-700 border-gray-200'
                  }`}>
                    {user.role}
                  </span>
                </div>
                <div>
                  <p className="text-[#86868b] text-sm font-light mb-1">Phone</p>
                  <p className="text-[#1d1d1f] font-light">{formatPhoneNumber(user.phone)}</p>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <p className="text-[#86868b] text-sm font-light mb-3">Verification Status</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${user.emailVerified ? 'bg-green-400' : 'bg-red-400/50'}`} />
                    <span className="text-sm text-gray-700 font-light">Email Verified</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${user.phoneVerified ? 'bg-green-400' : 'bg-red-400/50'}`} />
                    <span className="text-sm text-gray-700 font-light">Phone Verified</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${user.idVerified ? 'bg-green-400' : 'bg-white/20'}`} />
                    <span className="text-sm text-gray-700 font-light">ID Verified</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${user.bankVerified ? 'bg-green-400' : 'bg-white/20'}`} />
                    <span className="text-sm text-gray-700 font-light">Bank Verified</span>
                  </div>
                  {user.stripeIdentityVerified && (
                  <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-400" />
                      <span className="text-sm text-gray-700 font-light">Stripe Identity Verified</span>
                  </div>
                  )}
                  {user.stripeConnectAccountId && (
                  <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-400" />
                      <span className="text-sm text-gray-700 font-light">Stripe Connect: {user.stripeConnectAccountId.slice(0, 12)}...</span>
                  </div>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <p className="text-[#86868b] text-sm font-light mb-1">Account Created</p>
                <p className="text-[#1d1d1f] font-light text-sm">{formatDate(user.createdAt)}</p>
              </div>
            </div>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-light text-[#1d1d1f] mb-6 pb-4 border-b border-gray-200">Statistics</h2>
            <div className="space-y-4">
              <div>
                <p className="text-[#86868b] text-sm font-light mb-1">Total Volume</p>
                <p className="text-[#1d1d1f] font-light text-lg">{formatCurrency(user.totalProcessedAmount)}</p>
              </div>
              <div>
                <p className="text-[#86868b] text-sm font-light mb-1">Available Balance</p>
                <p className="text-green-400 font-light text-lg">{formatCurrency(user.availableBalance)}</p>
              </div>
              <div>
                <p className="text-[#86868b] text-sm font-light mb-1">Pending Balance</p>
                <p className="text-yellow-400 font-light text-lg">{formatCurrency(user.pendingBalance)}</p>
              </div>
              <div>
                <p className="text-[#86868b] text-sm font-light mb-1">Completed Transactions</p>
                <p className="text-[#1d1d1f] font-light text-lg">{user.numCompletedTransactions}</p>
              </div>
              {user.averageRating && (
                <div>
                  <p className="text-[#86868b] text-sm font-light mb-1">Average Rating</p>
                  <p className="text-[#1d1d1f] font-light text-lg flex items-center gap-1">
                    {user.averageRating.toFixed(1)}
                    <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  </p>
                </div>
              )}
              <div className="pt-4 border-t border-gray-200">
                <p className="text-[#86868b] text-sm font-light mb-2">Transaction Counts</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#86868b] font-light">As Seller</span>
                    <span className="text-[#1d1d1f] font-light">{user._count.sellerTransactions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#86868b] font-light">As Buyer</span>
                    <span className="text-[#1d1d1f] font-light">{user._count.buyerTransactions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#86868b] font-light">Disputes Raised</span>
                    <span className="text-[#1d1d1f] font-light">{disputesRaised?.length || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Admin Actions */}
        <div className="mb-10 pb-6 border-b border-gray-200">
          <AdminUserActions user={{
            id: user.id,
            email: user.email,
            name: user.name,
            phone: user.phone,
            role: user.role,
          }} />
        </div>

        {/* Withdrawal History */}
        {payouts.length > 0 && (
          <div className="mb-10">
            <h2 className="text-2xl font-light text-[#1d1d1f] mb-6 pb-4 border-b border-gray-200">Withdrawal History ({payouts.length})</h2>
            <GlassCard variant="strong" className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-light text-[#86868b] uppercase tracking-wider">Date</th>
                      <th className="px-6 py-4 text-left text-xs font-light text-[#86868b] uppercase tracking-wider">Amount</th>
                      <th className="px-6 py-4 text-left text-xs font-light text-[#86868b] uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-left text-xs font-light text-[#86868b] uppercase tracking-wider">Payout ID</th>
                      <th className="px-6 py-4 text-left text-xs font-light text-[#86868b] uppercase tracking-wider">Rift</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {payouts.map((payout) => (
                      <tr key={payout.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-light">
                          {formatDate(payout.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[#1d1d1f] font-light">
                          {formatCurrency(payout.amount, payout.currency)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-light rounded border ${
                            payout.status === 'COMPLETED' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                            payout.status === 'PROCESSING' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                            payout.status === 'FAILED' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                            'bg-gray-100 text-[#86868b] border-gray-300'
                          }`}>
                            {payout.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[#86868b] font-light font-mono">
                          {payout.stripePayoutId || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[#86868b] font-light">
                          {payout.riftId ? (
                            <Link href={`/rifts/${payout.riftId}`} className="text-blue-400 hover:text-blue-300">
                              View Rift
                            </Link>
                          ) : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          </div>
        )}

        {/* Transactions as Buyer */}
        {buyerTransactions.length > 0 && (
          <div className="mb-10">
            <h2 className="text-2xl font-light text-[#1d1d1f] mb-6 pb-4 border-b border-gray-200">Transactions as Buyer ({buyerTransactions.length})</h2>
            <RiftList rifts={buyerTransactions} title="Buyer Transactions" />
          </div>
        )}

        {/* Transactions as Seller */}
        {sellerTransactions.length > 0 && (
          <div className="mb-10">
            <h2 className="text-2xl font-light text-[#1d1d1f] mb-6 pb-4 border-b border-gray-200">Transactions as Seller ({sellerTransactions.length})</h2>
            <RiftList rifts={sellerTransactions} title="Seller Transactions" />
          </div>
        )}

        {/* Disputes Raised */}
        {disputesRaised && disputesRaised.length > 0 && (
          <div className="mb-10">
            <h2 className="text-2xl font-light text-[#1d1d1f] mb-6 pb-4 border-b border-gray-200">Disputes Raised ({disputesRaised.length})</h2>
            <GlassCard variant="strong" className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-light text-[#86868b] uppercase tracking-wider">Date</th>
                      <th className="px-6 py-4 text-left text-xs font-light text-[#86868b] uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-left text-xs font-light text-[#86868b] uppercase tracking-wider">Reason</th>
                      <th className="px-6 py-4 text-left text-xs font-light text-[#86868b] uppercase tracking-wider">Category</th>
                      <th className="px-6 py-4 text-left text-xs font-light text-[#86868b] uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {disputesRaised.map((dispute: any) => (
                      <tr key={dispute.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-light">
                          {new Date(dispute.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-light rounded border ${
                            dispute.status === 'resolved_buyer' || dispute.status === 'resolved_seller' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                            dispute.status === 'under_review' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                            'bg-gray-100 text-[#86868b] border-gray-300'
                          }`}>
                            {dispute.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700 font-light">
                          {dispute.reason?.replace(/_/g, ' ') || 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700 font-light">
                          {dispute.category_snapshot || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <Link
                            href={`/admin/disputes/${dispute.id}`}
                            className="text-blue-400 hover:text-blue-300 font-light transition-colors"
                          >
                            View →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          </div>
        )}
      </div>
    </div>
  )
  } catch (error: any) {
    console.error('Admin user detail page error:', error)
    return (
      <div className="min-h-screen relative overflow-hidden bg-white flex items-center justify-center">
        <GlassCard variant="strong" className="p-8 max-w-md">
          <div className="text-[#86868b] font-light text-center">
            <p className="text-xl mb-4 text-red-400">Error loading user</p>
            <p className="text-sm text-gray-400 mb-6">{error?.message || 'An unexpected error occurred'}</p>
            <Link 
              href="/admin" 
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-gray-300 text-gray-600 hover:text-[#1d1d1f] font-light transition-all duration-200 group mx-auto"
            >
              <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Admin Panel
            </Link>
          </div>
        </GlassCard>
      </div>
    )
  }
}
