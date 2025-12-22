'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ItemTypeSelection, { ItemType } from '@/components/ItemTypeSelection'
import CreateRiftForm from '@/components/CreateRiftForm'
import GlassCard from '@/components/ui/GlassCard'

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

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-20">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl md:text-5xl font-light text-white mb-3 tracking-tight">
            Create New Rift
          </h1>
          <p className="text-white/60 font-light text-lg">
            Start a new protected transaction
          </p>
        </div>

        {/* Step 1: Role Selection */}
        {!creatorRole && (
          <div className="mb-8">
            <GlassCard className="p-6 mb-6">
              <div className="text-center mb-6">
                <h2 className="text-xl font-light text-white mb-2">Are you buying or selling?</h2>
                <p className="text-white/60 font-light text-sm">Select your role in this transaction</p>
              </div>
              <div className="flex gap-6 justify-center">
                <button
                  onClick={() => setCreatorRole('BUYER')}
                  className="group relative px-10 py-6 rounded-2xl transition-all duration-300 border border-white/10 hover:border-blue-500/40 bg-white/[0.03] hover:bg-gradient-to-br hover:from-blue-500/10 hover:to-cyan-500/5 backdrop-blur-sm overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-cyan-500/0 group-hover:from-blue-500/5 group-hover:to-cyan-500/5 transition-all duration-300" />
                  <div className="relative flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-white/5 group-hover:bg-gradient-to-br group-hover:from-blue-500/20 group-hover:to-cyan-500/10 border border-white/10 group-hover:border-blue-500/30 transition-all duration-300">
                      <svg className="w-6 h-6 text-white/60 group-hover:text-blue-400 transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                      </svg>
                    </div>
                    <span className="font-light text-white/70 group-hover:text-white text-base">I'm Buying</span>
                  </div>
                </button>
                <button
                  onClick={() => setCreatorRole('SELLER')}
                  className="group relative px-10 py-6 rounded-2xl transition-all duration-300 border border-white/10 hover:border-green-500/40 bg-white/[0.03] hover:bg-gradient-to-br hover:from-green-500/10 hover:to-emerald-500/5 backdrop-blur-sm overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-green-500/0 to-emerald-500/0 group-hover:from-green-500/5 group-hover:to-emerald-500/5 transition-all duration-300" />
                  <div className="relative flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-white/5 group-hover:bg-gradient-to-br group-hover:from-green-500/20 group-hover:to-emerald-500/10 border border-white/10 group-hover:border-green-500/30 transition-all duration-300">
                      <span className="text-2xl font-light text-white/60 group-hover:text-green-400 transition-colors duration-300">$</span>
                    </div>
                    <span className="font-light text-white/70 group-hover:text-white text-base">I'm Selling</span>
                  </div>
                </button>
              </div>
            </GlassCard>
          </div>
        )}

        {/* Step 2: Item Type Selection (only shown after role is selected) */}
        {creatorRole && !itemType && (
          <div>
            <div className="mb-6 flex items-center justify-between">
              <button
                onClick={() => setCreatorRole(null)}
                className="text-white/60 hover:text-white font-light text-sm flex items-center gap-2 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Change Role
              </button>
              <div className="text-sm text-white/60 font-light">
                {creatorRole === 'BUYER' ? 'Buying' : 'Selling'}
              </div>
            </div>
            <ItemTypeSelection onSelect={setItemType} role={creatorRole} />
          </div>
        )}

        {/* Step 3: Create Form (only shown after item type is selected) */}
        {creatorRole && itemType && (
          <div>
            <div className="mb-6 flex items-center justify-between">
              <button
                onClick={() => setItemType(null)}
                className="text-white/60 hover:text-white font-light text-sm flex items-center gap-2 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Change Item Type
              </button>
              <div className="text-sm text-white/60 font-light">
                {creatorRole === 'BUYER' ? 'Buying' : 'Selling'} • {itemType}
              </div>
            </div>
            <CreateRiftForm 
              users={users} 
              itemType={itemType} 
              creatorRole={creatorRole}
            />
          </div>
        )}
      </div>
    </div>
  )
}
