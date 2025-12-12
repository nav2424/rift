'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import PremiumButton from './ui/PremiumButton'
import GlassCard from './ui/GlassCard'
import { ItemType } from './ItemTypeSelection'

interface User {
  id: string
  name: string | null
  email: string
}

interface CreateEscrowFormProps {
  users: User[]
  itemType: ItemType
}

export default function CreateEscrowForm({ users, itemType }: CreateEscrowFormProps) {
  const router = useRouter()
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)
  
  // Filter out current user from the list
  const availableUsers = users.filter((u) => u.id !== session?.user?.id)
  const [formData, setFormData] = useState({
    itemTitle: '',
    itemDescription: '',
    amount: '',
    currency: 'CAD',
    sellerId: '',
    sellerEmail: '',
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
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
        sellerId: formData.sellerId,
        sellerEmail: formData.sellerEmail,
        notes: formData.notes || null,
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
    <GlassCard>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-white/70 mb-2">
            Item Title *
          </label>
          <input
            type="text"
            required
            value={formData.itemTitle}
            onChange={(e) => setFormData({ ...formData, itemTitle: e.target.value })}
            className="w-full px-4 py-3 glass-light border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
            placeholder={
              itemType === 'PHYSICAL' ? 'e.g., iPhone 13 Pro' :
              itemType === 'TICKETS' ? 'e.g., Taylor Swift Concert Tickets' :
              itemType === 'DIGITAL' ? 'e.g., Premium Software License' :
              'e.g., Web Development Service'
            }
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white/70 mb-2">
            Description *
          </label>
          <textarea
            required
            value={formData.itemDescription}
            onChange={(e) => setFormData({ ...formData, itemDescription: e.target.value })}
            className="w-full px-4 py-3 glass-light border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all resize-none"
            rows={4}
            placeholder="Describe the item..."
          />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Amount *
            </label>
            <input
              type="number"
              step="0.01"
              required
              min="0"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="w-full px-4 py-3 glass-light border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Currency *
            </label>
            <input
              type="text"
              required
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
              className="w-full px-4 py-3 glass-light border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
              placeholder="CAD"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-white/70 mb-2">
            Seller * (Who you're buying from)
          </label>
          <p className="text-xs text-white/40 mb-2">You are the buyer. Select the seller you're purchasing from.</p>
          <select
            value={formData.sellerId}
            onChange={(e) => setFormData({ ...formData, sellerId: e.target.value, sellerEmail: '' })}
            className="w-full px-4 py-3 glass-light border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-white/20 transition-all mb-3"
          >
            <option value="">Select a seller...</option>
            {availableUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name || user.email}
              </option>
            ))}
          </select>
          <p className="text-xs text-white/40 mb-2 text-center">OR</p>
          <input
            type="email"
            value={formData.sellerEmail}
            onChange={(e) => setFormData({ ...formData, sellerEmail: e.target.value, sellerId: '' })}
            className="w-full px-4 py-3 glass-light border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
            placeholder="Enter seller email (must be registered)"
          />
          {formData.sellerEmail && !formData.sellerId && (
            <p className="text-xs text-white/50 mt-2">
              Note: Seller must sign up to see this escrow
            </p>
          )}
        </div>

        {/* Type-specific fields */}
        {itemType === 'PHYSICAL' && (
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Shipping Address *
            </label>
            <textarea
              required
              value={formData.shippingAddress}
              onChange={(e) => setFormData({ ...formData, shippingAddress: e.target.value })}
              className="w-full px-4 py-3 glass-light border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all resize-none"
              rows={3}
              placeholder="Your shipping address..."
            />
          </div>
        )}

        {itemType === 'TICKETS' && (
          <>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  Event Date *
                </label>
                <input
                  type="date"
                  required
                  value={formData.eventDate}
                  onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })}
                  className="w-full px-4 py-3 glass-light border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  Venue *
                </label>
                <input
                  type="text"
                  required
                  value={formData.venue}
                  onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                  className="w-full px-4 py-3 glass-light border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
                  placeholder="e.g., Rogers Centre, Toronto"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Transfer Method *
              </label>
              <select
                required
                value={formData.transferMethod}
                onChange={(e) => setFormData({ ...formData, transferMethod: e.target.value })}
                className="w-full px-4 py-3 glass-light border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
              >
                <option value="">Select transfer method...</option>
                <option value="email">Email Transfer</option>
                <option value="mobile_app">Mobile App (Ticketmaster, etc.)</option>
                <option value="pdf">PDF Download</option>
                <option value="other">Other</option>
              </select>
            </div>
          </>
        )}

        {itemType === 'DIGITAL' && (
          <>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Download Link *
              </label>
              <input
                type="url"
                required
                value={formData.downloadLink}
                onChange={(e) => setFormData({ ...formData, downloadLink: e.target.value })}
                className="w-full px-4 py-3 glass-light border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
                placeholder="https://..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                License Key (if applicable)
              </label>
              <input
                type="text"
                value={formData.licenseKey}
                onChange={(e) => setFormData({ ...formData, licenseKey: e.target.value })}
                className="w-full px-4 py-3 glass-light border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
                placeholder="Enter license key..."
              />
            </div>
          </>
        )}

        {itemType === 'SERVICES' && (
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Service Date / Timeline *
            </label>
            <input
              type="text"
              required
              value={formData.serviceDate}
              onChange={(e) => setFormData({ ...formData, serviceDate: e.target.value })}
              className="w-full px-4 py-3 glass-light border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
              placeholder="e.g., January 15, 2024 or Within 2 weeks"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-white/70 mb-2">
            Notes (optional)
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="w-full px-4 py-3 glass-light border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all resize-none"
            rows={2}
            placeholder="Additional notes..."
          />
        </div>

        <PremiumButton type="submit" disabled={loading} className="w-full">
          {loading ? 'Creating...' : 'Create Rift'}
        </PremiumButton>
      </form>
    </GlassCard>
  )
}
