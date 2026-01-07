'use client'

import { ReactNode } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import RiftLogo from '@/components/RiftLogo'

interface MarketingLayoutProps {
  children: ReactNode
}

/**
 * MarketingLayout for public pages (Home, Landing, Pricing, About)
 * Features: Top nav with Rift logo, Product, Pricing, About, Sign in, primary CTA "Create a Rift"
 */
export default function MarketingLayout({ children }: MarketingLayoutProps) {
  const { data: session } = useSession()

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Top Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-sm border-b border-white/8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center hover:opacity-80 transition-opacity">
              <RiftLogo size="md" />
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              <Link
                href="/"
                className="text-white/60 hover:text-white transition-colors text-sm font-light"
              >
                Product
              </Link>
              <Link
                href="/pricing"
                className="text-white/60 hover:text-white transition-colors text-sm font-light"
              >
                Pricing
              </Link>
              <Link
                href="/about"
                className="text-white/60 hover:text-white transition-colors text-sm font-light"
              >
                About
              </Link>

              {session ? (
                <Link
                  href="/dashboard"
                  className="text-white/60 hover:text-white transition-colors text-sm font-light"
                >
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    href="/auth/signin"
                    className="text-white/60 hover:text-white transition-colors text-sm font-light"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/auth/signup"
                    className="px-4 py-2 rounded-lg bg-white text-black hover:bg-white/90 transition-colors text-sm font-medium"
                  >
                    Create a Rift
                  </Link>
                </>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2 text-white/80 hover:text-white transition-colors"
              aria-label="Menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main>{children}</main>
    </div>
  )
}

