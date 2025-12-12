'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import GlassCard from '@/components/ui/GlassCard'

interface Dispute {
  id: string
  status: string
  reason: string
  createdAt: string
  escrow: {
    id: string
    itemTitle: string
    status: string
    amount: number
    currency: string
    buyer: {
      id: string
      name: string | null
      email: string
    }
    seller: {
      id: string
      name: string | null
      email: string
    }
  }
  raisedBy: {
    id: string
    name: string | null
    email: string
  }
}

export default function DisputesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }

    if (status === 'authenticated') {
      loadDisputes()
    }
  }, [status, router])

  const loadDisputes = async () => {
    try {
      const response = await fetch('/api/me/disputes', {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setDisputes(data.disputes || [])
      }
    } catch (error) {
      console.error('Error loading disputes:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const getStatusBadge = (status: string) => {
    const colors = {
      OPEN: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      RESOLVED: 'bg-green-500/20 text-green-400 border-green-500/30',
      CLOSED: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    }
    return colors[status as keyof typeof colors] || colors.OPEN
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-black flex items-center justify-center">
        <div className="text-white/60 font-light">Loading...</div>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return null
  }

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

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="mb-8">
          <Link 
            href="/account"
            className="text-white/60 hover:text-white/90 font-light mb-6 transition-colors flex items-center gap-2 inline-block"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Account
          </Link>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-500/20 to-yellow-500/10 flex items-center justify-center border border-yellow-500/20">
              <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h1 className="text-5xl md:text-6xl font-light text-white mb-2 tracking-tight">
                Your Disputes
              </h1>
              <p className="text-white/60 font-light">View and manage your disputes</p>
            </div>
          </div>
        </div>

        {disputes.length === 0 ? (
          <GlassCard>
            <div className="p-12 text-center">
              <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-light text-white mb-2">No disputes yet</h3>
              <p className="text-white/60 font-light text-sm">
                All your transactions are running smoothly
              </p>
            </div>
          </GlassCard>
        ) : (
          <div className="space-y-4">
            {disputes.map((dispute) => (
              <Link key={dispute.id} href={`/escrows/${dispute.escrow.id}`}>
                <GlassCard className="hover:bg-white/5 transition-colors cursor-pointer">
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-light text-white mb-2">
                          {dispute.escrow.itemTitle}
                        </h3>
                        <p className="text-white/80 font-light text-sm mb-3">
                          {formatCurrency(dispute.escrow.amount, dispute.escrow.currency)}
                        </p>
                        <p className="text-white/60 font-light text-sm">
                          Raised by: {dispute.raisedBy.name || dispute.raisedBy.email}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-light border ${getStatusBadge(dispute.status)}`}>
                        {dispute.status}
                      </span>
                    </div>
                    
                    {dispute.reason && (
                      <div className="pt-4 border-t border-white/10">
                        <p className="text-white/60 font-light text-sm">
                          <span className="text-white/40">Reason: </span>
                          {dispute.reason}
                        </p>
                      </div>
                    )}

                    <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center">
                      <span className="text-white/40 font-light text-xs">
                        {new Date(dispute.createdAt).toLocaleDateString()}
                      </span>
                      <span className="text-white/60 font-light text-sm flex items-center gap-2">
                        View Transaction
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </span>
                    </div>
                  </div>
                </GlassCard>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
