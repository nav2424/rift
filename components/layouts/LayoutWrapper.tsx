'use client'

import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import MarketingLayout from './MarketingLayout'
import AppLayout from './AppLayout'

interface LayoutWrapperProps {
  children: React.ReactNode
}

export default function LayoutWrapper({ children }: LayoutWrapperProps) {
  const pathname = usePathname()
  const { data: session, status } = useSession()

  const isMarketingRoute = [
    '/',
    '/landing',
    '/pricing',
    '/about',
    '/auth/signin',
    '/auth/signup',
    '/auth/forgot-password',
    '/auth/reset-password',
  ].includes(pathname)

  const isAuthenticated = status === 'authenticated'

  // Render loading state if session is still loading
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center">
        <div className="text-white/60 font-light">Loading...</div>
      </div>
    )
  }

  // Conditionally render the appropriate layout
  if (isAuthenticated && !isMarketingRoute) {
    return <AppLayout>{children}</AppLayout>
  }

  return <MarketingLayout>{children}</MarketingLayout>
}

