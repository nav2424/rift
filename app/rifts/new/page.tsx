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

  return (
    <div className="min-h-screen relative overflow-hidden bg-black">
      {/* Enhanced background with gradient orbs */}
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
        backgroundSize: '50px 50px'
      }} />
      
      {/* Animated gradient orbs */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse pointer-events-none" style={{ animationDuration: '8s' }} />
      <div className="fixed bottom-0 right-1/4 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-3xl animate-pulse pointer-events-none" style={{ animationDuration: '12s', animationDelay: '2s' }} />
      <div className="fixed top-1/2 left-0 w-72 h-72 bg-purple-500/5 rounded-full blur-3xl animate-pulse pointer-events-none" style={{ animationDuration: '10s', animationDelay: '4s' }} />

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-20">
        {/* Enhanced Header */}
        <div className="mb-12 text-center">
          <h1 className="text-5xl md:text-6xl font-light text-white mb-4 tracking-tight bg-clip-text">
            Create New Rift
          </h1>
          <p className="text-white/70 font-light text-xl max-w-2xl mx-auto">
            Start a new protected transaction
          </p>
          <p className="text-white/50 font-light text-sm mt-2">
            Your funds are secured until delivery is confirmed
          </p>
        </div>

        {/* Step 1: Enhanced Role Selection */}
        {!creatorRole && (
          <div className="mb-12">
            <GlassCard className="p-8 md:p-12 mb-6 border border-white/10 bg-white/5 backdrop-blur-xl">
              <div className="text-center mb-10">
                <h2 className="text-3xl md:text-4xl font-light text-white mb-3">Are you buying or selling?</h2>
                <p className="text-white/60 font-light text-base">Select your role to get started</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-6 justify-center max-w-2xl mx-auto">
                <button
                  onClick={() => setCreatorRole('BUYER')}
                  className="group relative px-12 py-10 rounded-2xl transition-all duration-300 border-2 border-white/10 hover:border-cyan-500/50 bg-white/[0.03] hover:bg-gradient-to-br hover:from-cyan-500/10 hover:to-blue-500/5 backdrop-blur-sm overflow-hidden shadow-lg hover:shadow-cyan-500/20 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/0 to-blue-500/0 group-hover:from-cyan-500/10 group-hover:to-blue-500/5 transition-all duration-300" />
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl transform translate-x-1/2 -translate-y-1/2" />
                  </div>
                  <div className="relative flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-gradient-to-br from-white/5 to-white/0 group-hover:bg-gradient-to-br group-hover:from-cyan-500/30 group-hover:to-blue-500/20 border border-white/10 group-hover:border-cyan-500/40 transition-all duration-300 shadow-lg">
                      <svg className="w-8 h-8 text-white/60 group-hover:text-cyan-400 transition-all duration-300 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                      </svg>
                    </div>
                    <span className="font-light text-white/80 group-hover:text-white text-lg">I'm Buying</span>
                    <span className="text-white/50 font-light text-xs group-hover:text-white/70">I'll select a seller</span>
                  </div>
                </button>
                <button
                  onClick={() => setCreatorRole('SELLER')}
                  className="group relative px-12 py-10 rounded-2xl transition-all duration-300 border-2 border-white/10 hover:border-emerald-500/50 bg-white/[0.03] hover:bg-gradient-to-br hover:from-emerald-500/10 hover:to-green-500/5 backdrop-blur-sm overflow-hidden shadow-lg hover:shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/0 to-green-500/0 group-hover:from-emerald-500/10 group-hover:to-green-500/5 transition-all duration-300" />
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl transform translate-x-1/2 -translate-y-1/2" />
                  </div>
                  <div className="relative flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-gradient-to-br from-white/5 to-white/0 group-hover:bg-gradient-to-br group-hover:from-emerald-500/30 group-hover:to-green-500/20 border border-white/10 group-hover:border-emerald-500/40 transition-all duration-300 shadow-lg">
                      <span className="text-3xl font-light text-white/60 group-hover:text-emerald-400 transition-all duration-300 group-hover:scale-110">$</span>
                    </div>
                    <span className="font-light text-white/80 group-hover:text-white text-lg">I'm Selling</span>
                    <span className="text-white/50 font-light text-xs group-hover:text-white/70">I'll select a buyer</span>
                  </div>
                </button>
              </div>
            </GlassCard>
          </div>
        )}

        {/* Step 2: Item Type Selection (only shown after role is selected) */}
        {creatorRole && !itemType && (
          <div className="transition-all duration-500 ease-out">
            <div className="mb-8 flex items-center justify-between px-2">
              <button
                onClick={() => setCreatorRole(null)}
                className="text-white/60 hover:text-white font-light text-sm flex items-center gap-2 transition-all hover:gap-3 group"
              >
                <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Role
              </button>
              <div className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white/70 font-light">
                {creatorRole === 'BUYER' ? 'Buying' : 'Selling'}
              </div>
            </div>
            <ItemTypeSelection onSelect={setItemType} role={creatorRole} />
          </div>
        )}

        {/* Step 3: Create Form (only shown after item type is selected) */}
        {creatorRole && itemType && (
          <div className="transition-all duration-500 ease-out">
            <div className="mb-8 flex items-center justify-between px-2">
              <button
                onClick={() => setItemType(null)}
                className="text-white/60 hover:text-white font-light text-sm flex items-center gap-2 transition-all hover:gap-3 group"
              >
                <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Item Type
              </button>
              <div className="flex items-center gap-3">
                <div className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white/70 font-light">
                  {creatorRole === 'BUYER' ? 'Buying' : 'Selling'}
                </div>
                <div className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500/20 to-blue-500/10 border border-cyan-500/30 text-sm text-cyan-400 font-light">
                  {itemType.replace(/_/g, ' ')}
                </div>
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
