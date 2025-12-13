'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import ItemTypeSelection, { ItemType } from '@/components/ItemTypeSelection'
import CreateEscrowForm from '@/components/CreateEscrowForm'

interface User {
  id: string
  name: string | null
  email: string
}

type CreatorRole = 'BUYER' | 'SELLER' | null

export default function NewEscrow() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [step, setStep] = useState<'role' | 'select' | 'form'>('role')
  const [creatorRole, setCreatorRole] = useState<CreatorRole>(null)
  const [selectedType, setSelectedType] = useState<ItemType | null>(null)
  const [users, setUsers] = useState<User[]>([])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }

    if (status === 'authenticated') {
      // Fetch users
      fetch('/api/users')
        .then(res => res.json())
        .then(data => {
          if (data.users) {
            setUsers(data.users)
          }
        })
        .catch(console.error)
    }
  }, [status, router])

  // Ensure role is always selected first - reset if somehow bypassed
  useEffect(() => {
    if (step !== 'role' && !creatorRole) {
      setStep('role')
      setSelectedType(null)
    }
  }, [step, creatorRole])

  const handleRoleSelect = (role: 'BUYER' | 'SELLER') => {
    setCreatorRole(role)
    setStep('select')
  }

  const handleTypeSelect = (type: ItemType) => {
    setSelectedType(type)
    setStep('form')
  }

  const handleBack = () => {
    if (step === 'form') {
      setStep('select')
      setSelectedType(null)
    } else if (step === 'select') {
      setStep('role')
      setCreatorRole(null)
    }
  }

  if (status === 'loading') {
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

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        {step === 'role' ? (
          <>
            <div className="mb-16 text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-8">
                <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span className="text-white/80 font-light text-sm">New Transaction</span>
              </div>
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-light text-white mb-4 tracking-tight">
                Create New Rift
              </h1>
              <p className="text-xl text-white/70 font-light max-w-2xl mx-auto mb-12">Are you buying or selling?</p>
            </div>
            <div className="max-w-2xl mx-auto grid md:grid-cols-2 gap-6">
              <button
                onClick={() => handleRoleSelect('BUYER')}
                className="group p-8 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/10 transition-all duration-300 text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/10 border border-blue-500/30 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-light text-white mb-2">I'm the Buyer</h3>
                <p className="text-white/60 font-light">I'm purchasing an item or service from someone</p>
              </button>
              <button
                onClick={() => handleRoleSelect('SELLER')}
                className="group p-8 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/10 transition-all duration-300 text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/10 border border-purple-500/30 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-light text-white mb-2">I'm the Seller</h3>
                <p className="text-white/60 font-light">I'm selling an item or service to someone</p>
              </button>
            </div>
          </>
        ) : step === 'select' && creatorRole ? (
          <>
            <div className="mb-12">
              <button
                onClick={handleBack}
                className="text-white/60 hover:text-white/90 font-light mb-6 transition-colors flex items-center gap-2 group"
              >
                <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
              <h1 className="text-5xl md:text-6xl font-light text-white mb-4 tracking-tight">
                Select Item Type
              </h1>
              <p className="text-white/60 font-light">What type of transaction is this?</p>
            </div>
            <ItemTypeSelection onSelect={handleTypeSelect} />
          </>
        ) : step === 'form' && creatorRole && selectedType ? (
          <>
            <div className="mb-12">
              <button
                onClick={handleBack}
                className="text-white/60 hover:text-white/90 font-light mb-6 transition-colors flex items-center gap-2 group"
              >
                <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to selection
              </button>
              <h1 className="text-5xl md:text-6xl font-light text-white mb-3 tracking-tight">
                Create New Rift
              </h1>
              <p className="text-white/60 font-light">Complete the form below</p>
            </div>
            <CreateEscrowForm 
              users={users} 
              itemType={selectedType} 
              creatorRole={creatorRole}
            />
          </>
        ) : (
          // Fallback: if somehow we're in an invalid state, show role selection
          <>
            <div className="mb-16 text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-8">
                <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span className="text-white/80 font-light text-sm">New Transaction</span>
              </div>
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-light text-white mb-4 tracking-tight">
                Create New Rift
              </h1>
              <p className="text-xl text-white/70 font-light max-w-2xl mx-auto mb-12">Are you buying or selling?</p>
            </div>
            <div className="max-w-2xl mx-auto grid md:grid-cols-2 gap-6">
              <button
                onClick={() => handleRoleSelect('BUYER')}
                className="group p-8 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/10 transition-all duration-300 text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/10 border border-blue-500/30 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-light text-white mb-2">I'm the Buyer</h3>
                <p className="text-white/60 font-light">I'm purchasing an item or service from someone</p>
              </button>
              <button
                onClick={() => handleRoleSelect('SELLER')}
                className="group p-8 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/10 transition-all duration-300 text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/10 border border-purple-500/30 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-light text-white mb-2">I'm the Seller</h3>
                <p className="text-white/60 font-light">I'm selling an item or service to someone</p>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

