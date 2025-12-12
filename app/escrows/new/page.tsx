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

export default function NewEscrow() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [step, setStep] = useState<'select' | 'form'>('select')
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

  const handleTypeSelect = (type: ItemType) => {
    setSelectedType(type)
    setStep('form')
  }

  const handleBack = () => {
    setStep('select')
    setSelectedType(null)
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
        {step === 'select' ? (
          <>
            <div className="mb-12">
              <h1 className="text-5xl md:text-6xl font-light text-white mb-3 tracking-tight">
                Create New Rift
              </h1>
              <p className="text-white/60 font-light">Start a secure transaction</p>
            </div>
            <ItemTypeSelection onSelect={handleTypeSelect} />
          </>
        ) : (
          <>
            <div className="mb-12">
              <button
                onClick={handleBack}
                className="text-white/60 hover:text-white/90 font-light mb-4 transition-colors flex items-center gap-2"
              >
                ← Back to selection
              </button>
              <h1 className="text-5xl md:text-6xl font-light text-white mb-3 tracking-tight">
                Create New Rift
              </h1>
              <p className="text-white/60 font-light">Complete the form below</p>
            </div>
            {selectedType && <CreateEscrowForm users={users} itemType={selectedType} />}
          </>
        )}
      </div>
    </div>
  )
}

