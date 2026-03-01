'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import GlassCard from '@/components/ui/GlassCard'
import PremiumButton from '@/components/ui/PremiumButton'

interface PayoutDetail {
  id: string
  amount: number
  currency: string
  status: string
  scheduledAt: Date | null
  processedAt: Date | null
  createdAt: Date
  riftNumber: number | null
  itemTitle: string | null
  riftId: string | null
}

interface UserSummary {
  userId: string
  userName: string | null
  userEmail: string
  riftUserId: string | null
  stripeConnectAccountId: string | null
  walletBalance: number
  pendingBalance: number
  currency: string
  totalPending: number
  totalProcessing: number
  totalCompleted: number
  totalFailed: number
  totalOwed: number
  totalAllTime: number
  nextScheduledDate: Date | null
  payouts: PayoutDetail[]
}

interface PayoutStats {
  totalUsers: number
  totalPending: number
  totalProcessing: number
  totalCompleted: number
  totalFailed: number
  totalOwed: number
}

export default function AdminPayoutsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [userSummaries, setUserSummaries] = useState<UserSummary[]>([])
  const [stats, setStats] = useState<PayoutStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'amount' | 'date' | 'user'>('amount')
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadPayouts()
  }, [filterStatus])

  const loadPayouts = async () => {
    try {
      setLoading(true)
      setError(null)
      const url = filterStatus === 'all' 
        ? '/api/admin/payouts'
        : `/api/admin/payouts?status=${filterStatus}`
      
      const response = await fetch(url, {
        credentials: 'include',
      })

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          router.push('/admin')
          return
        }
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to load payouts: ${response.status}`)
      }

      const data = await response.json()
      
      // Parse dates
      const summaries = data.users.map((user: any) => ({
        ...user,
        nextScheduledDate: user.nextScheduledDate ? new Date(user.nextScheduledDate) : null,
        payouts: user.payouts.map((p: any) => ({
          ...p,
          scheduledAt: p.scheduledAt ? new Date(p.scheduledAt) : null,
          processedAt: p.processedAt ? new Date(p.processedAt) : null,
          createdAt: new Date(p.createdAt),
        })),
      }))

      // Sort users
      const sorted = summaries.sort((a: UserSummary, b: UserSummary) => {
        if (sortBy === 'amount') {
          return b.totalOwed - a.totalOwed
        } else if (sortBy === 'date') {
          if (!a.nextScheduledDate && !b.nextScheduledDate) return 0
          if (!a.nextScheduledDate) return 1
          if (!b.nextScheduledDate) return -1
          return a.nextScheduledDate.getTime() - b.nextScheduledDate.getTime()
        } else {
          return (a.userName || a.userEmail).localeCompare(b.userName || b.userEmail)
        }
      })

      setUserSummaries(sorted)
      setStats(data.stats)
    } catch (error: any) {
      console.error('Error loading payouts:', error)
      setError(error.message || 'Failed to load payouts')
      setUserSummaries([])
      setStats(null)
    } finally {
      setLoading(false)
    }
  }

  const toggleUser = (userId: string) => {
    const newExpanded = new Set(expandedUsers)
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId)
    } else {
      newExpanded.add(userId)
    }
    setExpandedUsers(newExpanded)
  }

  const formatCurrency = (amount: number, currency: string = 'CAD') => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  const formatDate = (date: Date | null) => {
    if (!date) return 'N/A'
    return new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }

  const formatDateShort = (date: Date | null) => {
    if (!date) return 'N/A'
    return new Intl.DateTimeFormat('en-CA', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date)
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      PENDING: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      PROCESSING: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      COMPLETED: 'bg-green-500/20 text-green-400 border-green-500/30',
      FAILED: 'bg-red-500/20 text-red-400 border-red-500/30',
    }
    return (
      <span className={`px-2 py-1 text-xs font-light rounded border ${styles[status as keyof typeof styles] || 'bg-gray-100 text-[#86868b] border-gray-300'}`}>
        {status}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-white">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-20">
          <div className="animate-pulse space-y-6">
            <div className="h-10 bg-gray-100 rounded w-1/3"></div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-100 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-white">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-20">
          <GlassCard className="p-8">
            <div className="text-center">
              <p className="text-xl font-light text-red-400 mb-4">Error Loading Payouts</p>
              <p className="text-[#86868b] font-light mb-6">{error}</p>
              <PremiumButton onClick={loadPayouts} variant="outline">
                Try Again
              </PremiumButton>
            </div>
          </GlassCard>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-white">
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-20">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl md:text-5xl font-light text-[#1d1d1f] tracking-tight mb-2">
              Payout Tracking
            </h1>
            <p className="text-[#86868b] font-light">
              Track user payouts, scheduled dates, and amounts owed
            </p>
          </div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-gray-300 text-gray-600 hover:text-[#1d1d1f] font-light transition-all duration-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Admin
          </Link>
        </div>

        {/* Statistics */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
            <GlassCard>
              <div className="p-6">
                <p className="text-xs text-[#86868b] font-light uppercase tracking-wider mb-2">Users with Payouts</p>
                <p className="text-4xl font-light text-[#1d1d1f] mb-2 tracking-tight">{stats.totalUsers}</p>
                <p className="text-sm text-gray-400 font-light">Active users</p>
              </div>
            </GlassCard>
            <GlassCard>
              <div className="p-6">
                <p className="text-xs text-[#86868b] font-light uppercase tracking-wider mb-2">Total Owed</p>
                <p className="text-4xl font-light text-[#1d1d1f] mb-2 tracking-tight">
                  {formatCurrency(stats.totalOwed)}
                </p>
                <p className="text-sm text-gray-400 font-light">Pending + Processing</p>
              </div>
            </GlassCard>
            <GlassCard>
              <div className="p-6">
                <p className="text-xs text-[#86868b] font-light uppercase tracking-wider mb-2">Pending</p>
                <p className="text-4xl font-light text-yellow-400 mb-2 tracking-tight">
                  {formatCurrency(stats.totalPending)}
                </p>
                <p className="text-sm text-gray-400 font-light">Awaiting schedule</p>
              </div>
            </GlassCard>
            <GlassCard>
              <div className="p-6">
                <p className="text-xs text-[#86868b] font-light uppercase tracking-wider mb-2">Processing</p>
                <p className="text-4xl font-light text-blue-400 mb-2 tracking-tight">
                  {formatCurrency(stats.totalProcessing)}
                </p>
                <p className="text-sm text-gray-400 font-light">In progress</p>
              </div>
            </GlassCard>
            <GlassCard>
              <div className="p-6">
                <p className="text-xs text-[#86868b] font-light uppercase tracking-wider mb-2">Completed</p>
                <p className="text-4xl font-light text-green-400 mb-2 tracking-tight">
                  {formatCurrency(stats.totalCompleted)}
                </p>
                <p className="text-sm text-gray-400 font-light">All time</p>
              </div>
            </GlassCard>
          </div>
        )}

        {/* Filters and Sort */}
        <GlassCard className="p-6 mb-8">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-[#86868b] font-light">Filter:</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-[#1d1d1f] font-light focus:outline-none focus:ring-2 focus:ring-gray-300"
              >
                <option value="all">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="PROCESSING">Processing</option>
                <option value="COMPLETED">Completed</option>
                <option value="FAILED">Failed</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-[#86868b] font-light">Sort by:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-[#1d1d1f] font-light focus:outline-none focus:ring-2 focus:ring-gray-300"
              >
                <option value="amount">Amount Owed</option>
                <option value="date">Next Scheduled Date</option>
                <option value="user">User Name</option>
              </select>
            </div>
            <PremiumButton
              onClick={loadPayouts}
              variant="ghost"
              className="ml-auto"
            >
              Refresh
            </PremiumButton>
          </div>
        </GlassCard>

        {/* User Summaries */}
        <div className="space-y-4">
          {userSummaries.map((user) => (
            <GlassCard key={user.userId} className="overflow-hidden">
              <div className="p-6">
                {/* User Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Link
                        href={`/admin/users/${user.userId}`}
                        className="text-xl font-light text-[#1d1d1f] hover:text-blue-400 transition-colors"
                      >
                        {user.userName || user.userEmail}
                      </Link>
                      {user.riftUserId && (
                        <span className="text-sm text-gray-400 font-light font-mono">
                          ({user.riftUserId})
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[#86868b] font-light">{user.userEmail}</p>
                    {!user.stripeConnectAccountId && (
                      <p className="text-xs text-yellow-400/80 font-light mt-1">
                        ⚠ No Stripe Connect account
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-light text-[#1d1d1f] mb-1">
                      {formatCurrency(user.totalOwed, user.currency)}
                    </p>
                    <p className="text-xs text-[#86868b] font-light">Total Owed</p>
                  </div>
                </div>

                {/* Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-xs text-[#86868b] font-light mb-1">Wallet Balance</p>
                    <p className="text-lg font-light text-[#1d1d1f]">
                      {formatCurrency(user.walletBalance, user.currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#86868b] font-light mb-1">Pending</p>
                    <p className="text-lg font-light text-yellow-400">
                      {formatCurrency(user.totalPending, user.currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#86868b] font-light mb-1">Processing</p>
                    <p className="text-lg font-light text-blue-400">
                      {formatCurrency(user.totalProcessing, user.currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#86868b] font-light mb-1">Next Scheduled</p>
                    <p className="text-sm font-light text-[#1d1d1f]">
                      {formatDateShort(user.nextScheduledDate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#86868b] font-light mb-1">Total All Time</p>
                    <p className="text-lg font-light text-green-400">
                      {formatCurrency(user.totalAllTime, user.currency)}
                    </p>
                  </div>
                </div>

                {/* Payouts List */}
                {user.payouts.length > 0 && (
                  <div>
                    <PremiumButton
                      onClick={() => toggleUser(user.userId)}
                      variant="ghost"
                      className="w-full mb-2"
                    >
                      {expandedUsers.has(user.userId) ? '▼' : '▶'} {user.payouts.length} Payout{user.payouts.length !== 1 ? 's' : ''}
                    </PremiumButton>
                    {expandedUsers.has(user.userId) && (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-3 px-4 text-xs text-[#86868b] font-light uppercase tracking-wider">Status</th>
                              <th className="text-left py-3 px-4 text-xs text-[#86868b] font-light uppercase tracking-wider">Amount</th>
                              <th className="text-left py-3 px-4 text-xs text-[#86868b] font-light uppercase tracking-wider">Scheduled</th>
                              <th className="text-left py-3 px-4 text-xs text-[#86868b] font-light uppercase tracking-wider">Processed</th>
                              <th className="text-left py-3 px-4 text-xs text-[#86868b] font-light uppercase tracking-wider">Rift</th>
                              <th className="text-left py-3 px-4 text-xs text-[#86868b] font-light uppercase tracking-wider">Created</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {user.payouts.map((payout) => (
                              <tr key={payout.id} className="hover:bg-gray-50 transition-colors">
                                <td className="py-3 px-4">{getStatusBadge(payout.status)}</td>
                                <td className="py-3 px-4 text-[#1d1d1f] font-light">
                                  {formatCurrency(payout.amount, payout.currency)}
                                </td>
                                <td className="py-3 px-4 text-gray-700 font-light text-sm">
                                  {formatDate(payout.scheduledAt)}
                                </td>
                                <td className="py-3 px-4 text-gray-700 font-light text-sm">
                                  {formatDate(payout.processedAt)}
                                </td>
                                <td className="py-3 px-4">
                                  {payout.riftId ? (
                                    <Link
                                      href={`/rifts/${payout.riftId}`}
                                      className="text-blue-400 hover:text-blue-300 text-sm font-light"
                                    >
                                      {payout.riftNumber ? `Rift #${payout.riftNumber}` : 'View Rift'}
                                    </Link>
                                  ) : (
                                    <span className="text-gray-400 text-sm">N/A</span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-[#86868b] font-light text-sm">
                                  {formatDateShort(payout.createdAt)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </GlassCard>
          ))}
        </div>

        {userSummaries.length === 0 && (
          <GlassCard className="p-12 text-center">
            <p className="text-[#86868b] font-light text-lg">
              No payouts found{filterStatus !== 'all' ? ` with status "${filterStatus}"` : ''}
            </p>
          </GlassCard>
        )}
      </div>
    </div>
  )
}
