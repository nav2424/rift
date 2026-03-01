'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Application error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <h2 className="text-2xl font-bold text-[#1d1d1f] mb-4">Something went wrong</h2>
        <p className="text-gray-400 mb-6">
          An unexpected error occurred. Please try again.
        </p>
        <button
          onClick={reset}
          className="px-6 py-3 bg-[#1d1d1f] text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
