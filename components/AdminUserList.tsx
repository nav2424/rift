'use client'

import { useState } from 'react'
import GlassCard from './ui/GlassCard'

interface User {
  id: string
  name: string | null
  email: string
  phone: string | null
  role: string
  createdAt: Date
  updatedAt: Date
  totalProcessedAmount: number
  availableBalance: number
  pendingBalance: number
  numCompletedTransactions: number
  averageRating: number | null
  responseTimeMs: number | null
  idVerified: boolean
  bankVerified: boolean
  _count: {
    sellerTransactions: number
    buyerTransactions: number
    disputesRaised: number
    disputesResolved: number
  }
}

interface AdminUserListProps {
  users: User[]
}

export default function AdminUserList({ users: initialUsers }: AdminUserListProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRole, setFilterRole] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'createdAt' | 'email' | 'totalProcessedAmount' | 'numCompletedTransactions'>('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Filter and sort users
  let filteredUsers = initialUsers.filter((user) => {
    const matchesSearch =
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.name && user.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (user.phone && user.phone.includes(searchTerm))
    
    const matchesRole = filterRole === 'all' || user.role === filterRole

    return matchesSearch && matchesRole
  })

  // Sort users
  filteredUsers.sort((a, b) => {
    let aValue: any
    let bValue: any

    switch (sortBy) {
      case 'createdAt':
        aValue = new Date(a.createdAt).getTime()
        bValue = new Date(b.createdAt).getTime()
        break
      case 'email':
        aValue = a.email.toLowerCase()
        bValue = b.email.toLowerCase()
        break
      case 'totalProcessedAmount':
        aValue = a.totalProcessedAmount
        bValue = b.totalProcessedAmount
        break
      case 'numCompletedTransactions':
        aValue = a.numCompletedTransactions
        bValue = b.numCompletedTransactions
        break
      default:
        return 0
    }

    if (sortOrder === 'asc') {
      return aValue > bValue ? 1 : -1
    } else {
      return aValue < bValue ? 1 : -1
    }
  })

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <GlassCard variant="strong" className="overflow-hidden">
      {/* Search and Filter Bar */}
      <div className="p-6 border-b border-white/10">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by email, name, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-5 py-3 bg-white/[0.05] backdrop-blur-xl border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 transition-all font-light"
            />
          </div>
          <div className="flex gap-3">
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="px-5 py-3 bg-white/[0.05] backdrop-blur-xl border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 transition-all font-light"
            >
              <option value="all" className="bg-black/90">All Roles</option>
              <option value="USER" className="bg-black/90">Users</option>
              <option value="ADMIN" className="bg-black/90">Admins</option>
            </select>
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-')
                setSortBy(field as any)
                setSortOrder(order as 'asc' | 'desc')
              }}
              className="px-5 py-3 bg-white/[0.05] backdrop-blur-xl border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 transition-all font-light"
            >
              <option value="createdAt-desc" className="bg-black/90">Newest First</option>
              <option value="createdAt-asc" className="bg-black/90">Oldest First</option>
              <option value="email-asc" className="bg-black/90">Email A-Z</option>
              <option value="email-desc" className="bg-black/90">Email Z-A</option>
              <option value="totalProcessedAmount-desc" className="bg-black/90">Highest Volume</option>
              <option value="numCompletedTransactions-desc" className="bg-black/90">Most Transactions</option>
            </select>
          </div>
        </div>
        <div className="mt-4 text-sm text-white/60 font-light">
          Showing {filteredUsers.length} of {initialUsers.length} users
        </div>
      </div>

      {/* Users Table */}
      {filteredUsers.length === 0 ? (
        <div className="p-12 text-center">
          <p className="text-white/60 font-light">No users found.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-white/10">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-light text-white/60 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-4 text-left text-xs font-light text-white/60 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-4 text-left text-xs font-light text-white/60 uppercase tracking-wider">
                  Stats
                </th>
                <th className="px-6 py-4 text-left text-xs font-light text-white/60 uppercase tracking-wider">
                  Balance
                </th>
                <th className="px-6 py-4 text-left text-xs font-light text-white/60 uppercase tracking-wider">
                  Verification
                </th>
                <th className="px-6 py-4 text-left text-xs font-light text-white/60 uppercase tracking-wider">
                  Joined
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <div className="text-sm font-light text-white">
                        {user.name || 'No name'}
                      </div>
                      <div className="text-sm text-white/60 font-light">{user.email}</div>
                      {user.phone && (
                        <div className="text-xs text-white/40 font-light">{user.phone}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1.5 text-xs font-light rounded-lg border ${
                      user.role === 'ADMIN'
                        ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                        : 'bg-white/5 text-white/80 border-white/10'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-white/80 space-y-1.5 font-light">
                      <div>
                        <span className="text-white/50">Volume: </span>
                        <span className="text-white font-light">
                          {formatCurrency(user.totalProcessedAmount)}
                        </span>
                      </div>
                      <div>
                        <span className="text-white/50">Transactions: </span>
                        <span className="text-white font-light">{user.numCompletedTransactions}</span>
                      </div>
                      {user.averageRating && (
                        <div>
                          <span className="text-white/50">Rating: </span>
                          <span className="flex items-center gap-1 text-white font-light">
                            {user.averageRating.toFixed(1)}
                            <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          </span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-white/80 space-y-1.5 font-light">
                      <div>
                        <span className="text-white/50">Available: </span>
                        <span className="text-green-400 font-light">
                          {formatCurrency(user.availableBalance)}
                        </span>
                      </div>
                      <div>
                        <span className="text-white/50">Pending: </span>
                        <span className="text-yellow-400 font-light">
                          {formatCurrency(user.pendingBalance)}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${
                          user.idVerified ? 'bg-green-400' : 'bg-white/20'
                        }`} />
                        <span className="text-xs text-white/60 font-light">ID</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${
                          user.bankVerified ? 'bg-green-400' : 'bg-white/20'
                        }`} />
                        <span className="text-xs text-white/60 font-light">Bank</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-white/60 font-light">
                    {formatDate(user.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </GlassCard>
  )
}

