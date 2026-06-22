'use client'

import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import MarketingLayout from './MarketingLayout'
import AppLayout from './AppLayout'
import { BackgroundLayer } from '@/components/BackgroundLayer'

interface LayoutWrapperProps {
  children: React.ReactNode
}

const MARKETING_ROUTES = [
  '/',
  '/landing',
  '/pricing',
  '/about',
  '/auth/signin',
  '/auth/signup',
  '/auth/forgot-password',
  '/auth/reset-password',
]

function isFocusRoute(pathname: string | null) {
  return pathname?.startsWith('/admin') || pathname?.startsWith('/brand')
}

export default function LayoutWrapper({ children }: LayoutWrapperProps) {
  const pathname = usePathname()
  const { status } = useSession()

  const isMarketingRoute = MARKETING_ROUTES.includes(pathname || '')
  const isOnboardingRoute = pathname?.startsWith('/onboarding')
  const isFocus = isFocusRoute(pathname)
  const isAuthenticated = status === 'authenticated'

  if (status === 'loading') {
    if (isFocus) {
      return (
        <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
          <div className="text-sm text-[#71717A]">Loading…</div>
        </div>
      )
    }
    return (
      <>
        <BackgroundLayer />
        <div className="min-h-screen bg-white flex flex-col items-center justify-center">
          <div className="text-gray-400 font-light">Loading...</div>
        </div>
      </>
    )
  }

  if (isFocus) {
    return <>{children}</>
  }

  return (
    <>
      <BackgroundLayer />
      {isAuthenticated && !isMarketingRoute ? (
        isOnboardingRoute ? children : <AppLayout>{children}</AppLayout>
      ) : (
        <MarketingLayout>{children}</MarketingLayout>
      )}
    </>
  )
}
