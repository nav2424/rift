'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import GlassCard from '@/components/ui/GlassCard'
import { useToast } from '@/components/ui/Toast'
import { signOut } from 'next-auth/react'

export default function DeleteAccountPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const { showToast } = useToast()
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [checked, setChecked] = useState(false)

  const handleDelete = async () => {
    if (!checked) {
      showToast('Please confirm that you understand the consequences', 'error')
      return
    }

    if (confirmText !== 'DELETE') {
      showToast('Please type DELETE to confirm', 'error')
      return
    }

    try {
      setDeleting(true)
      const response = await fetch('/api/me/delete-account', {
        method: 'DELETE',
        credentials: 'include',
      })

      const data = await response.json()

      if (response.ok) {
        showToast('Account deleted successfully', 'success')
        // Sign out and redirect to home
        await signOut({ callbackUrl: '/' })
        router.push('/')
      } else {
        showToast(data.message || data.error || 'Failed to delete account', 'error')
      }
    } catch (error) {
      console.error('Error deleting account:', error)
      showToast('Failed to delete account. Please try again.', 'error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-black">
      <div className="fixed inset-0 opacity-[0.02] pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
        backgroundSize: '50px 50px'
      }} />

      <div className="relative max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-20">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="flex-1">
              <h1 className="text-3xl md:text-4xl font-light text-white mb-2 tracking-tight">
                Delete Account
              </h1>
              <p className="text-white/60 font-light">Permanently delete your account and all associated data</p>
            </div>
            <Link
              href="/account"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white/70 hover:text-white font-light transition-all duration-200 group flex-shrink-0 mt-1"
            >
              <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Account
            </Link>
          </div>
        </div>

        <GlassCard>
          <div className="p-6 space-y-6">
            {/* Warning */}
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
              <h3 className="text-red-400 font-light text-lg mb-2">⚠️ Warning: This action cannot be undone</h3>
              <p className="text-white/80 font-light text-sm">
                Deleting your account will permanently remove all your data including:
              </p>
              <ul className="mt-3 space-y-1 text-white/70 font-light text-sm list-disc list-inside">
                <li>Your profile and account information</li>
                <li>All transaction history</li>
                <li>Wallet balance and ledger entries</li>
                <li>Messages and conversations</li>
                <li>Badges and milestones</li>
                <li>All other associated data</li>
              </ul>
            </div>

            {/* Requirements */}
            <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
              <h3 className="text-yellow-400 font-light text-lg mb-2">Before you delete</h3>
              <p className="text-white/80 font-light text-sm mb-2">
                Make sure you have:
              </p>
              <ul className="space-y-1 text-white/70 font-light text-sm list-disc list-inside">
                <li>Completed or cancelled all active transactions</li>
                <li>Withdrawn all funds from your wallet</li>
                <li>Downloaded any data you want to keep</li>
              </ul>
            </div>

            {/* Confirmation checkbox */}
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="confirm"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-white/20 bg-white/5 text-red-500 focus:ring-red-500 focus:ring-offset-0"
              />
              <label htmlFor="confirm" className="flex-1 text-white/80 font-light text-sm">
                I understand that this action is permanent and cannot be undone. I have completed all active transactions and withdrawn my funds.
              </label>
            </div>

            {/* Type DELETE to confirm */}
            <div>
              <label htmlFor="delete-confirm" className="block text-white/80 font-light text-sm mb-2">
                Type <span className="font-semibold text-white">DELETE</span> to confirm:
              </label>
              <input
                type="text"
                id="delete-confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/20 text-white font-light focus:outline-none focus:border-white/40 transition-colors"
                disabled={deleting}
              />
            </div>

            {/* Delete button */}
            <div className="pt-4">
              <button
                onClick={handleDelete}
                disabled={deleting || !checked || confirmText !== 'DELETE'}
                className="w-full px-6 py-3 rounded-xl bg-red-500/20 hover:bg-red-500/30 transition-colors border border-red-500/30 text-red-400 font-light disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-red-500/20"
              >
                {deleting ? 'Deleting Account...' : 'Permanently Delete My Account'}
              </button>
            </div>

            {/* Cancel link */}
            <div className="text-center pt-4">
              <Link
                href="/account"
                className="text-white/60 hover:text-white font-light text-sm transition-colors"
              >
                Cancel and return to account settings
              </Link>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  )
}

