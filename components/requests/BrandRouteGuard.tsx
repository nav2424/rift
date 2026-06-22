'use client'

import { useEffect, useState, ReactNode } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function BrandRouteGuard({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    if (status === 'loading') return
    if (status !== 'authenticated') {
      router.replace('/auth/signin')
      return
    }
    if (session?.user?.role === 'ADMIN') {
      router.replace('/admin')
      return
    }
    fetch('/api/me/role', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (d.platformRole === 'CREATOR') {
          router.replace('/dashboard')
          return
        }
        setAllowed(true)
      })
      .catch(() => setAllowed(true))
  }, [status, session, router])

  if (!allowed) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <p className="text-sm text-[#71717A]">Loading…</p>
      </div>
    )
  }

  return <>{children}</>
}
