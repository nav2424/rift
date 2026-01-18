'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import ItemTypeSelection, { ItemType } from '@/components/ItemTypeSelection'
import CreateRiftForm from '@/components/CreateRiftForm'
import GlassCard from '@/components/ui/GlassCard'
import { getItemTypeLabel } from '@/lib/item-type-labels'

interface User {
  id: string
  name: string | null
  email: string
  riftUserId: string | null
}

export default function CreateRiftPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [itemType, setItemType] = useState<ItemType | null>(null)
  const [creatorRole, setCreatorRole] = useState<'BUYER' | 'SELLER' | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }

    if (status === 'authenticated') {
      loadUsers()
    }
  }, [status, router])

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/users', {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users || [])
      }
    } catch (error) {
      console.error('Error loading users:', error)
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500/20 via-blue-500/10 to-purple-500/10 border border-cyan-500/20 flex items-center justify-center animate-pulse">
            <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <div className="text-white/60 font-light">Loading...</div>
        </div>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return null
  }

  const step = creatorRole ? (itemType ? 3 : 2) : 1
  const progress = (step / 3) * 100

  return (
    <div className="space-y-10 md:space-y-12">
      <div className="space-y-6">
        <div className="flex flex-col gap-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-light text-white/70 w-fit">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400/80" />
            New Rift
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-light text-white tracking-tight">
              Create a new Rift
          </h1>
            <p className="text-white/70 font-light text-base sm:text-lg max-w-2xl">
              Start a new brand deal or creator partnership with protected payments and clear approvals.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-white/30 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-white/50 font-light">
            <span>Step {step} of 3</span>
            <span>Role → Type → Details</span>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <GlassCard className="p-4 border border-white/10 bg-white/5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg border border-cyan-500/20 bg-cyan-500/10 text-cyan-300 flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-white">Payment protection</p>
                <p className="text-xs text-white/60 font-light">Funds secured upfront</p>
              </div>
            </div>
          </GlassCard>
          <GlassCard className="p-4 border border-white/10 bg-white/5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg border border-blue-500/20 bg-blue-500/10 text-blue-300 flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-white">Approval workflow</p>
                <p className="text-xs text-white/60 font-light">Release after sign-off</p>
              </div>
            </div>
          </GlassCard>
          <GlassCard className="p-4 border border-white/10 bg-white/5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg border border-purple-500/20 bg-purple-500/10 text-purple-300 flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 2.21-1.79 4-4 4H5l-3 3v-3a4 4 0 014-4h2c2.21 0 4-1.79 4-4V5a4 4 0 014-4h3a4 4 0 014 4v2c0 2.21-1.79 4-4 4h-3c-2.21 0-4 1.79-4 4z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-white">Clear collaboration</p>
                <p className="text-xs text-white/60 font-light">Milestones and notes</p>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>

      {!creatorRole && (
        <GlassCard className="p-6 sm:p-8 border border-white/10 bg-white/5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] text-white/40">Step 1</p>
              <h2 className="text-xl sm:text-2xl font-light text-white">Choose your role</h2>
              <p className="text-sm text-white/60 font-light">Are you hiring a creator or delivering content?</p>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
                <button
                  onClick={() => setCreatorRole('BUYER')}
              className="text-left group transition-all duration-200"
            >
              <GlassCard className="p-6 h-full border border-white/10 bg-white/5 hover:border-cyan-400/40 hover:bg-white/10">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-300 flex items-center justify-center group-hover:bg-cyan-500/20 group-hover:border-cyan-400/40 transition-colors">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                      </svg>
                    </div>
                  <div className="space-y-2">
                    <p className="text-lg text-white font-light">Brand / Agency</p>
                    <p className="text-sm text-white/60 font-light">I&apos;m commissioning content or services.</p>
                    <span className="text-xs text-white/40 font-light">Pay securely, approve deliverables.</span>
                  </div>
                </div>
              </GlassCard>
                </button>
                <button
                  onClick={() => setCreatorRole('SELLER')}
              className="text-left group transition-all duration-200"
            >
              <GlassCard className="p-6 h-full border border-white/10 bg-white/5 hover:border-emerald-400/40 hover:bg-white/10">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 flex items-center justify-center group-hover:bg-emerald-500/20 group-hover:border-emerald-400/40 transition-colors">
                    <span className="text-xl font-light">$</span>
                  </div>
                  <div className="space-y-2">
                    <p className="text-lg text-white font-light">Creator</p>
                    <p className="text-sm text-white/60 font-light">I&apos;m delivering content or services.</p>
                    <span className="text-xs text-white/40 font-light">Get paid after approvals.</span>
                  </div>
              </div>
            </GlassCard>
            </button>
          </div>
        </GlassCard>
        )}

        {creatorRole && !itemType && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
              <button
                onClick={() => setCreatorRole(null)}
                className="text-white/60 hover:text-white font-light text-sm flex items-center gap-2 transition-all hover:gap-3 group"
              >
                <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Role
              </button>
            <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/70 font-light">
                {creatorRole === 'BUYER' ? 'Buying' : 'Selling'}
              </div>
          </div>
          <GlassCard className="p-6 sm:p-8 border border-white/10 bg-white/5">
            <div className="space-y-2 mb-6">
              <p className="text-xs uppercase tracking-[0.2em] text-white/40">Step 2</p>
              <h2 className="text-xl sm:text-2xl font-light text-white">Select deliverable type</h2>
              <p className="text-sm text-white/60 font-light">Pick the workflow that matches your collaboration.</p>
            </div>
            <ItemTypeSelection onSelect={setItemType} role={creatorRole} />
          </GlassCard>
          </div>
        )}

        {creatorRole && itemType && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <button
                onClick={() => setItemType(null)}
                className="text-white/60 hover:text-white font-light text-sm flex items-center gap-2 transition-all hover:gap-3 group"
              >
                <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Item Type
              </button>
            <div className="flex flex-wrap items-center gap-2">
              <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/70 font-light">
                  {creatorRole === 'BUYER' ? 'Buying' : 'Selling'}
                </div>
              <div className="px-3 py-1 rounded-full bg-gradient-to-r from-cyan-500/20 to-blue-500/10 border border-cyan-500/30 text-xs text-cyan-200 font-light">
                  {getItemTypeLabel(itemType)}
              </div>
            </div>
          </div>
          <GlassCard className="p-6 sm:p-8 border border-white/10 bg-white/5">
            <div className="space-y-2 mb-6">
              <p className="text-xs uppercase tracking-[0.2em] text-white/40">Step 3</p>
              <h2 className="text-xl sm:text-2xl font-light text-white">Add deal details</h2>
              <p className="text-sm text-white/60 font-light">Define scope, milestones, and payment terms.</p>
            </div>
            <CreateRiftForm 
              users={users} 
              itemType={itemType} 
              creatorRole={creatorRole}
            />
          </GlassCard>
          </div>
        )}
    </div>
  )
}
