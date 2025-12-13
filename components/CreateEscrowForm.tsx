'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import PremiumButton from './ui/PremiumButton'
import GlassCard from './ui/GlassCard'
import { ItemType } from './ItemTypeSelection'
import { calculateBuyerFee, calculateSellerFee, calculateSellerNet, calculateBuyerTotal } from '@/lib/fees'

interface User {
  id: string
  name: string | null
  email: string
}

interface CreateEscrowFormProps {
  users: User[]
  itemType: ItemType
  creatorRole: 'BUYER' | 'SELLER'
}

export default function CreateEscrowForm({ users, itemType, creatorRole }: CreateEscrowFormProps) {
  const router = useRouter()
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<User[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [showResults, setShowResults] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  
  const [formData, setFormData] = useState({
    itemTitle: '',
    itemDescription: '',
    amount: '',
    currency: 'CAD',
    sellerId: '',
    sellerEmail: '',
    buyerId: '',
    buyerEmail: '',
    shippingAddress: '',
    notes: '',
    // Type-specific fields
    eventDate: '',
    venue: '',
    transferMethod: '',
    downloadLink: '',
    licenseKey: '',
    serviceDate: '',
  })

  // Debounced search function
  const searchUsers = useCallback(
    async (query: string) => {
      if (!query || query.length < 2) {
        setSearchResults([])
        setShowResults(false)
        return
      }

      setSearchLoading(true)
      try {
        const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`, {
          credentials: 'include',
        })
        if (response.ok) {
          const data = await response.json()
          setSearchResults(data.users || [])
          setShowResults(true)
        }
      } catch (error) {
        console.error('Search error:', error)
        setSearchResults([])
      } finally {
        setSearchLoading(false)
      }
    },
    []
  )

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      searchUsers(searchQuery)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery, searchUsers])

  // Handle user selection
  const handleUserSelect = (user: User) => {
    setSelectedUser(user)
    setSearchQuery(user.name || user.email)
    setShowResults(false)
    if (creatorRole === 'BUYER') {
      setFormData({ ...formData, sellerId: user.id, sellerEmail: user.email })
    } else {
      setFormData({ ...formData, buyerId: user.id, buyerEmail: user.email })
    }
  }

  // Handle search input change
  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    setSelectedUser(null)
    if (creatorRole === 'BUYER') {
      setFormData({ ...formData, sellerId: '', sellerEmail: value })
    } else {
      setFormData({ ...formData, buyerId: '', buyerEmail: value })
    }
  }

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Validate partner selection
      const hasSeller = creatorRole === 'BUYER' && (formData.sellerId || selectedUser)
      const hasBuyer = creatorRole === 'SELLER' && (formData.buyerId || selectedUser)
      
      if (creatorRole === 'BUYER' && !hasSeller) {
        alert('Please search and select a seller')
        setLoading(false)
        return
      }
      if (creatorRole === 'SELLER' && !hasBuyer) {
        alert('Please search and select a buyer')
        setLoading(false)
        return
      }

      // Verify authentication before submitting
      const authCheck = await fetch('/api/auth/me', {
        credentials: 'include',
      })
      
      if (!authCheck.ok) {
        alert('Your session has expired. Please sign in again.')
        router.push('/auth/signin')
        return
      }

      const payload: any = {
        itemTitle: formData.itemTitle,
        itemDescription: formData.itemDescription,
        amount: parseFloat(formData.amount),
        currency: formData.currency,
        itemType,
        creatorRole,
        notes: formData.notes || null,
      }

      // Set buyer/seller based on creator role
      if (creatorRole === 'BUYER') {
        // User is buyer, they select seller
        payload.sellerId = formData.sellerId
        payload.sellerEmail = formData.sellerEmail
        payload.buyerId = session?.user?.id
      } else {
        // User is seller, they select buyer
        payload.buyerId = formData.buyerId
        payload.buyerEmail = formData.buyerEmail
        payload.sellerId = session?.user?.id
      }

      // Add type-specific fields
      if (itemType === 'PHYSICAL') {
        payload.shippingAddress = formData.shippingAddress
      } else if (itemType === 'TICKETS') {
        payload.eventDate = formData.eventDate
        payload.venue = formData.venue
        payload.transferMethod = formData.transferMethod
      } else if (itemType === 'DIGITAL') {
        payload.downloadLink = formData.downloadLink
        payload.licenseKey = formData.licenseKey
      } else if (itemType === 'SERVICES') {
        payload.serviceDate = formData.serviceDate
      }

      const response = await fetch('/api/escrows/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json()
        const errorMessage = error.error || 'Failed to create rift'
        console.error('Escrow creation error:', {
          status: response.status,
          error: errorMessage,
          statusText: response.statusText,
        })
        
        if (response.status === 401) {
          alert('You are not authenticated. Please sign in again.')
          router.push('/auth/signin')
        } else {
          alert(errorMessage)
        }
        return
      }

      const data = await response.json()
      router.push(`/escrows/${data.escrowId}`)
    } catch (error) {
      console.error('Error creating escrow:', error)
      alert('Failed to create rift')
    } finally {
      setLoading(false)
    }
  }

  return (
    <GlassCard variant="glass" className="p-8 lg:p-10">
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Information Section */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/10 border border-blue-500/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-2xl font-light text-white">Basic Information</h2>
          </div>

          <div>
            <label className="block text-sm font-light text-white/80 mb-3">
              Item Title *
            </label>
            <input
              type="text"
              required
              value={formData.itemTitle}
              onChange={(e) => setFormData({ ...formData, itemTitle: e.target.value })}
              className="w-full px-5 py-3.5 bg-white/[0.05] backdrop-blur-xl border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 transition-all font-light"
              placeholder={
                itemType === 'PHYSICAL' ? 'e.g., iPhone 13 Pro' :
                itemType === 'TICKETS' ? 'e.g., Taylor Swift Concert Tickets' :
                itemType === 'DIGITAL' ? 'e.g., Premium Software License' :
                'e.g., Web Development Service'
              }
            />
          </div>

          <div>
            <label className="block text-sm font-light text-white/80 mb-3">
              Description *
            </label>
            <textarea
              required
              value={formData.itemDescription}
              onChange={(e) => setFormData({ ...formData, itemDescription: e.target.value })}
              className="w-full px-5 py-3.5 bg-white/[0.05] backdrop-blur-xl border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 transition-all resize-none font-light"
              rows={5}
              placeholder="Describe the item in detail..."
            />
          </div>
        </div>

        {/* Payment Details Section */}
        <div className="space-y-6 pt-6 border-t border-white/10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/10 border border-green-500/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-light text-white">Payment Details</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-light text-white/80 mb-3">
                Transaction Amount (Subtotal) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                min="0"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-5 py-3.5 bg-white/[0.05] backdrop-blur-xl border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 transition-all font-light"
                placeholder="0.00"
              />
              {formData.amount && parseFloat(formData.amount) > 0 && (
                <div className="mt-4 p-4 rounded-xl bg-white/5 border border-white/10">
                  <p className="text-xs text-white/60 font-light mb-3 uppercase tracking-wider">Fee Breakdown</p>
                  {creatorRole === 'BUYER' ? (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-white/70 font-light text-sm">Listed Price</span>
                        <span className="text-white font-light">{formData.currency} {parseFloat(formData.amount).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-white/60 font-light text-sm">Processing Fee (3%)</span>
                        <span className="text-white/70 font-light">+{formData.currency} {calculateBuyerFee(parseFloat(formData.amount)).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-white/10">
                        <span className="text-white font-light">You Pay</span>
                        <span className="text-green-400 font-light text-lg">{formData.currency} {calculateBuyerTotal(parseFloat(formData.amount)).toFixed(2)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-white/70 font-light text-sm">Transaction Amount</span>
                        <span className="text-white font-light">{formData.currency} {parseFloat(formData.amount).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-white/60 font-light text-sm">Platform Fee (5%)</span>
                        <span className="text-white/70 font-light">-{formData.currency} {calculateSellerFee(parseFloat(formData.amount)).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-white/10">
                        <span className="text-white font-light">You Receive</span>
                        <span className="text-green-400 font-light text-lg">{formData.currency} {calculateSellerNet(parseFloat(formData.amount)).toFixed(2)}</span>
                      </div>
                      <p className="text-xs text-green-400/80 font-light mt-2 text-center">
                        You keep 95% of the transaction
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-light text-white/80 mb-3">
                Currency *
              </label>
              <input
                type="text"
                required
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className="w-full px-5 py-3.5 bg-white/[0.05] backdrop-blur-xl border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 transition-all font-light"
                placeholder="CAD"
              />
            </div>
          </div>
        </div>

        {/* Partner Selection Section - Buyer or Seller based on creator role */}
        <div className="space-y-6 pt-6 border-t border-white/10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/10 border border-purple-500/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-light text-white">
                {creatorRole === 'BUYER' ? 'Seller Information' : 'Buyer Information'}
              </h2>
              <p className="text-sm text-white/60 font-light mt-1">
                {creatorRole === 'BUYER' 
                  ? "You are the buyer. Select the seller you're purchasing from."
                  : "You are the seller. Select the buyer you're selling to."}
              </p>
            </div>
          </div>

          <div className="relative" ref={searchRef}>
            <label className="block text-sm font-light text-white/80 mb-3">
              {creatorRole === 'BUYER' ? 'Search for Seller *' : 'Search for Buyer *'}
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onFocus={() => {
                  if (searchQuery.length >= 2) {
                    setShowResults(true)
                  }
                }}
                className="w-full px-5 py-3.5 bg-white/[0.05] backdrop-blur-xl border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 transition-all font-light"
                placeholder={creatorRole === 'BUYER' 
                  ? "Enter seller's email or username..."
                  : "Enter buyer's email or username..."}
                required
              />
              {searchLoading && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <svg className="animate-spin h-5 w-5 text-white/40" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              )}
            </div>

            {/* Search Results Dropdown */}
            {showResults && searchResults.length > 0 && (
              <div className="absolute z-50 w-full mt-2 bg-black/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                <div className="max-h-60 overflow-y-auto">
                  {searchResults.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => handleUserSelect(user)}
                      className="w-full px-5 py-3 text-left hover:bg-white/5 transition-colors border-b border-white/5 last:border-b-0"
                    >
                      <div className="flex flex-col">
                        <span className="text-white font-light">{user.name || 'No name'}</span>
                        <span className="text-white/60 text-sm font-light">{user.email}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Selected User Display */}
            {selectedUser && (
              <div className="mt-3 p-4 bg-white/5 border border-white/10 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-light">{selectedUser.name || 'No name'}</p>
                    <p className="text-white/60 text-sm font-light">{selectedUser.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedUser(null)
                      setSearchQuery('')
                      if (creatorRole === 'BUYER') {
                        setFormData({ ...formData, sellerId: '', sellerEmail: '' })
                      } else {
                        setFormData({ ...formData, buyerId: '', buyerEmail: '' })
                      }
                    }}
                    className="text-white/60 hover:text-white transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {/* No Results Message */}
            {showResults && searchQuery.length >= 2 && !searchLoading && searchResults.length === 0 && (
              <div className="mt-2 p-4 bg-white/5 border border-white/10 rounded-xl">
                <p className="text-white/60 text-sm font-light">
                  No user found. {creatorRole === 'BUYER' ? 'Seller' : 'Buyer'} must be registered to create an escrow.
                </p>
              </div>
            )}

            {/* Info Message */}
            {!selectedUser && searchQuery.length < 2 && (
              <p className="text-xs text-white/60 mt-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {creatorRole === 'BUYER' 
                  ? 'Search by seller email or username. They must be registered.'
                  : 'Search by buyer email or username. They must be registered.'}
              </p>
            )}
          </div>
        </div>

        {/* Type-specific fields */}
        {itemType === 'PHYSICAL' && creatorRole === 'BUYER' && (
          <div className="space-y-6 pt-6 border-t border-white/10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/10 border border-orange-500/30 flex items-center justify-center">
                <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <h2 className="text-2xl font-light text-white">Shipping Details</h2>
            </div>
            <div>
              <label className="block text-sm font-light text-white/80 mb-3">
                Shipping Address *
              </label>
              <textarea
                required
                value={formData.shippingAddress}
                onChange={(e) => setFormData({ ...formData, shippingAddress: e.target.value })}
                className="w-full px-5 py-3.5 bg-white/[0.05] backdrop-blur-xl border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 transition-all resize-none font-light"
                rows={4}
                placeholder="Your complete shipping address..."
              />
            </div>
          </div>
        )}

        {itemType === 'TICKETS' && (
          <div className="space-y-6 pt-6 border-t border-white/10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500/20 to-amber-500/10 border border-yellow-500/30 flex items-center justify-center">
                <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4v-3a2 2 0 00-2-2H5z" />
                </svg>
              </div>
              <h2 className="text-2xl font-light text-white">Event Details</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-light text-white/80 mb-3">
                  Event Date *
                </label>
                <input
                  type="date"
                  required
                  value={formData.eventDate}
                  onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })}
                  className="w-full px-5 py-3.5 bg-white/[0.05] backdrop-blur-xl border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 transition-all font-light"
                />
              </div>
              <div>
                <label className="block text-sm font-light text-white/80 mb-3">
                  Venue *
                </label>
                <input
                  type="text"
                  required
                  value={formData.venue}
                  onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                  className="w-full px-5 py-3.5 bg-white/[0.05] backdrop-blur-xl border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 transition-all font-light"
                  placeholder="e.g., Rogers Centre, Toronto"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-light text-white/80 mb-3">
                Transfer Method *
              </label>
              <select
                required
                value={formData.transferMethod}
                onChange={(e) => setFormData({ ...formData, transferMethod: e.target.value })}
                className="w-full px-5 py-3.5 bg-white/[0.05] backdrop-blur-xl border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 transition-all font-light"
              >
                <option value="" className="bg-black/90">Select transfer method...</option>
                <option value="email" className="bg-black/90">Email Transfer</option>
                <option value="mobile_app" className="bg-black/90">Mobile App (Ticketmaster, etc.)</option>
                <option value="pdf" className="bg-black/90">PDF Download</option>
                <option value="other" className="bg-black/90">Other</option>
              </select>
            </div>
          </div>
        )}

        {itemType === 'DIGITAL' && (
          <div className="space-y-6 pt-6 border-t border-white/10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/10 border border-cyan-500/30 flex items-center justify-center">
                <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <h2 className="text-2xl font-light text-white">Delivery Details</h2>
            </div>
            <div>
              <label className="block text-sm font-light text-white/80 mb-3">
                Download Link *
              </label>
              <input
                type="url"
                required
                value={formData.downloadLink}
                onChange={(e) => setFormData({ ...formData, downloadLink: e.target.value })}
                className="w-full px-5 py-3.5 bg-white/[0.05] backdrop-blur-xl border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 transition-all font-light"
                placeholder="https://..."
              />
            </div>
            <div>
              <label className="block text-sm font-light text-white/80 mb-3">
                License Key <span className="text-white/50">(if applicable)</span>
              </label>
              <input
                type="text"
                value={formData.licenseKey}
                onChange={(e) => setFormData({ ...formData, licenseKey: e.target.value })}
                className="w-full px-5 py-3.5 bg-white/[0.05] backdrop-blur-xl border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 transition-all font-light"
                placeholder="Enter license key..."
              />
            </div>
          </div>
        )}

        {itemType === 'SERVICES' && (
          <div className="space-y-6 pt-6 border-t border-white/10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/10 border border-indigo-500/30 flex items-center justify-center">
                <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-light text-white">Service Details</h2>
            </div>
            <div>
              <label className="block text-sm font-light text-white/80 mb-3">
                Service Date / Timeline *
              </label>
              <input
                type="text"
                required
                value={formData.serviceDate}
                onChange={(e) => setFormData({ ...formData, serviceDate: e.target.value })}
                className="w-full px-5 py-3.5 bg-white/[0.05] backdrop-blur-xl border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 transition-all font-light"
                placeholder="e.g., January 15, 2024 or Within 2 weeks"
              />
            </div>
          </div>
        )}

        {/* Notes Section */}
        <div className="pt-6 border-t border-white/10">
          <label className="block text-sm font-light text-white/80 mb-3">
            Additional Notes <span className="text-white/50">(optional)</span>
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="w-full px-5 py-3.5 bg-white/[0.05] backdrop-blur-xl border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 transition-all resize-none font-light"
            rows={3}
            placeholder="Any additional information or special instructions..."
          />
        </div>

        {/* Submit Button */}
        <div className="pt-8">
          <PremiumButton 
            type="submit" 
            disabled={loading} 
            variant="outline"
            className="w-full py-4 text-base backdrop-blur-xl bg-white/[0.06] border border-white/20 hover:border-white/30 hover:bg-white/10 transition-all duration-300 font-light"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-3">
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Creating Rift...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-3">
                <span>Create Rift</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>
            )}
          </PremiumButton>
        </div>
      </form>
    </GlassCard>
  )
}
