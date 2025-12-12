import { requireAdmin } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import AdminDisputeList from '@/components/AdminDisputeList'
import AdminUserList from '@/components/AdminUserList'
import EscrowList from '@/components/EscrowList'
import Link from 'next/link'

export default async function AdminPage() {
  await requireAdmin()

  // Get all users
  const allUsers = await prisma.user.findMany({
    select: {
      id: true,
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
      _count: {
        select: {
          sellerTransactions: true,
          buyerTransactions: true,
          disputesRaised: true,
          disputesResolved: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  // Get all escrows
  const allEscrows = await prisma.escrowTransaction.findMany({
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
    take: 20, // Limit for performance
  })

  // Get all disputes
  const disputes = await prisma.dispute.findMany({
    where: {
      status: 'OPEN',
    },
    include: {
      escrow: {
        select: {
          id: true,
          riftNumber: true,
          status: true,
          buyer: {
            select: {
              email: true,
            },
          },
          seller: {
            select: {
              email: true,
            },
          },
        },
      },
      raisedBy: {
        select: {
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

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

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-12">
          <h1 className="text-5xl md:text-6xl font-light text-white mb-3 tracking-tight">
            Admin Panel
          </h1>
          <p className="text-white/60 font-light">Manage all users, transactions, and disputes</p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-12">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
            <div className="text-sm text-slate-400 mb-1">Total Users</div>
            <div className="text-3xl font-light text-white">{allUsers.length}</div>
            <div className="text-xs text-slate-500 mt-2">
              {allUsers.filter(u => u.role === 'ADMIN').length} admins
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
            <div className="text-sm text-slate-400 mb-1">Total Volume</div>
            <div className="text-3xl font-light text-white">
              ${allUsers.reduce((sum, u) => sum + u.totalProcessedAmount, 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-xs text-slate-500 mt-2">
              {allUsers.reduce((sum, u) => sum + u.numCompletedTransactions, 0)} transactions
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
            <div className="text-sm text-slate-400 mb-1">Open Disputes</div>
            <div className="text-3xl font-light text-white">{disputes.length}</div>
            <div className="text-xs text-slate-500 mt-2">Requires attention</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
            <div className="text-sm text-slate-400 mb-1">Verified Users</div>
            <div className="text-3xl font-light text-white">
              {allUsers.filter(u => u.idVerified && u.bankVerified).length}
            </div>
            <div className="text-xs text-slate-500 mt-2">
              {allUsers.filter(u => u.idVerified).length} ID verified
            </div>
          </div>
        </div>

        <div className="mb-12">
          <h2 className="text-2xl font-light text-white mb-6">All Users ({allUsers.length})</h2>
          <AdminUserList users={allUsers} />
        </div>

        <div className="mb-12">
          <h2 className="text-2xl font-light text-white mb-6">Open Disputes</h2>
          <AdminDisputeList disputes={disputes} />
        </div>

        <div>
          <h2 className="text-2xl font-light text-white mb-6">Recent Escrows</h2>
          <EscrowList escrows={allEscrows} title="All Escrows" />
        </div>
      </div>
    </div>
  )
}

