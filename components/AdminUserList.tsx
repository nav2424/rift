'use client'

import { useState } from 'react'

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
  level: string
  xp: number
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
    <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
      {/* Search and Filter Bar */}
      <div className="p-4 bg-slate-800 border-b border-slate-700">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by email, name, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-slate-600 focus:ring-1 focus:ring-slate-600"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-slate-600 focus:ring-1 focus:ring-slate-600"
            >
              <option value="all">All Roles</option>
              <option value="USER">Users</option>
              <option value="ADMIN">Admins</option>
            </select>
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-')
                setSortBy(field as any)
                setSortOrder(order as 'asc' | 'desc')
              }}
              className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-slate-600 focus:ring-1 focus:ring-slate-600"
            >
              <option value="createdAt-desc">Newest First</option>
              <option value="createdAt-asc">Oldest First</option>
              <option value="email-asc">Email A-Z</option>
              <option value="email-desc">Email Z-A</option>
              <option value="totalProcessedAmount-desc">Highest Volume</option>
              <option value="numCompletedTransactions-desc">Most Transactions</option>
            </select>
          </div>
        </div>
        <div className="mt-3 text-sm text-slate-400">
          Showing {filteredUsers.length} of {initialUsers.length} users
        </div>
      </div>

      {/* Users Table */}
      {filteredUsers.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-slate-400">No users found.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Stats
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Balance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Verification
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Joined
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <div className="text-sm font-medium text-white">
                        {user.name || 'No name'}
                      </div>
                      <div className="text-sm text-slate-400">{user.email}</div>
                      {user.phone && (
                        <div className="text-xs text-slate-500">{user.phone}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                      user.role === 'ADMIN'
                        ? 'bg-purple-900/30 text-purple-300 border border-purple-700/50'
                        : 'bg-slate-700/50 text-slate-300 border border-slate-600/50'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-slate-300 space-y-1">
                      <div>
                        <span className="text-slate-500">Volume: </span>
                        <span className="text-white font-medium">
                          {formatCurrency(user.totalProcessedAmount)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Transactions: </span>
                        <span className="text-white">{user.numCompletedTransactions}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Level: </span>
                        <span className="text-white">{user.level.replace('_', ' ')}</span>
                      </div>
                      {user.averageRating && (
                        <div>
                          <span className="text-slate-500">Rating: </span>
                          <span className="flex items-center gap-1 text-white">
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
                    <div className="text-sm text-slate-300 space-y-1">
                      <div>
                        <span className="text-slate-500">Available: </span>
                        <span className="text-green-400 font-medium">
                          {formatCurrency(user.availableBalance)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Pending: </span>
                        <span className="text-yellow-400">
                          {formatCurrency(user.pendingBalance)}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${
                          user.idVerified ? 'bg-green-500' : 'bg-slate-600'
                        }`} />
                        <span className="text-xs text-slate-400">ID</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${
                          user.bankVerified ? 'bg-green-500' : 'bg-slate-600'
                        }`} />
                        <span className="text-xs text-slate-400">Bank</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                    {formatDate(user.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

