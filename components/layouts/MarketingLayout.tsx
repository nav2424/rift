'use client'

import { ReactNode, useState, useEffect } from 'react'
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Close mobile menu when clicking outside
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [mobileMenuOpen])

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Top Navigation */}
      <header className="fixed top-0 z-50 w-full border-b border-white/5 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-3 sm:px-4 md:px-6">
          <div className="flex h-14 sm:h-16 items-center justify-between gap-2">
            {/* Logo */}
            <Link 
              href="/" 
              className="flex items-center hover:opacity-80 transition-opacity flex-shrink-0"
            >
              <RiftLogo size="md" />
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1 text-sm">
              <Link 
                href="/" 
                className="px-4 py-2 text-white/60 hover:text-white transition-colors rounded-lg hover:bg-white/5 font-light min-h-[44px] flex items-center"
              >
                Product
              </Link>
              <Link 
                href="/pricing" 
                className="px-4 py-2 text-white/60 hover:text-white transition-colors rounded-lg hover:bg-white/5 font-light min-h-[44px] flex items-center"
              >
                Pricing
              </Link>
              <Link 
                href="/about" 
                className="px-4 py-2 text-white/60 hover:text-white transition-colors rounded-lg hover:bg-white/5 font-light min-h-[44px] flex items-center"
              >
                About
              </Link>
              {session ? (
                <Link 
                  href="/dashboard" 
                  className="px-4 py-2 text-white/60 hover:text-white transition-colors rounded-lg hover:bg-white/5 font-light ml-2 min-h-[44px] flex items-center"
                >
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link 
                    href="/auth/signin" 
                    className="px-4 py-2 text-white/60 hover:text-white transition-colors rounded-lg hover:bg-white/5 font-light ml-4 min-h-[44px] flex items-center"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/auth/signup"
                    className="ml-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:opacity-90 transition shadow-sm min-h-[44px] flex items-center"
                  >
                    Create a Rift
                  </Link>
                </>
              )}
            </nav>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2.5 text-white/60 hover:text-white transition-colors rounded-lg hover:bg-white/5 min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Menu"
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/95 backdrop-blur-sm md:hidden"
          onClick={() => setMobileMenuOpen(false)}
          style={{
            animation: 'slideInRight 0.3s ease-out',
          }}
        >
          <div 
            className="fixed inset-0 bg-black overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with close button */}
            <div className="flex justify-between items-center p-4 border-b border-white/8">
              <div className="flex items-center">
                <RiftLogo size="md" />
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 text-white/80 hover:text-white transition-colors"
                aria-label="Close menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Navigation Links */}
            <div className="flex flex-col pt-6 sm:pt-8 px-4">
              <Link 
                href="/" 
                className="block py-3.5 sm:py-4 px-4 sm:px-6 text-white/80 hover:text-white hover:bg-white/5 transition-colors duration-200 font-medium text-base border-b border-white/10 min-h-[44px] flex items-center"
                onClick={() => setMobileMenuOpen(false)}
              >
                Product
              </Link>
              <Link 
                href="/pricing" 
                className="block py-3.5 sm:py-4 px-4 sm:px-6 text-white/80 hover:text-white hover:bg-white/5 transition-colors duration-200 font-medium text-base border-b border-white/10 min-h-[44px] flex items-center"
                onClick={() => setMobileMenuOpen(false)}
              >
                Pricing
              </Link>
              <Link 
                href="/about" 
                className="block py-3.5 sm:py-4 px-4 sm:px-6 text-white/80 hover:text-white hover:bg-white/5 transition-colors duration-200 font-medium text-base border-b border-white/10 min-h-[44px] flex items-center"
                onClick={() => setMobileMenuOpen(false)}
              >
                About
              </Link>
              {session ? (
                <Link 
                  href="/dashboard" 
                  className="block py-3.5 sm:py-4 px-4 sm:px-6 text-white/80 hover:text-white hover:bg-white/5 transition-colors duration-200 font-medium text-base border-b border-white/10 min-h-[44px] flex items-center"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link 
                    href="/auth/signin" 
                    className="block py-3.5 sm:py-4 px-4 sm:px-6 text-white/80 hover:text-white hover:bg-white/5 transition-colors duration-200 font-medium text-base border-b border-white/10 min-h-[44px] flex items-center"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/auth/signup"
                    className="block py-3.5 sm:py-4 px-4 sm:px-6 bg-white text-black hover:opacity-90 transition-colors duration-200 font-medium text-base rounded-lg mt-4 text-center min-h-[44px] flex items-center justify-center"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Create a Rift
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="pt-14 sm:pt-16 md:pt-20">{children}</main>
      
      {/* Footer */}
      <footer className="border-t border-white/8 bg-black/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <RiftLogo size="md" />
              <p className="mt-4 text-white/60 font-light text-sm">
                The execution layer for creator-brand deals.
              </p>
            </div>
            <div>
              <h3 className="text-white font-light mb-4">Product</h3>
              <ul className="space-y-2">
                <li>
                  <Link href="/" className="text-white/60 hover:text-white transition-colors text-sm font-light">
                    How it works
                  </Link>
                </li>
                <li>
                  <Link href="/pricing" className="text-white/60 hover:text-white transition-colors text-sm font-light">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link href="/about" className="text-white/60 hover:text-white transition-colors text-sm font-light">
                    About
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-light mb-4">Legal</h3>
              <ul className="space-y-2">
                <li>
                  <Link href="/terms" className="text-white/60 hover:text-white transition-colors text-sm font-light">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="text-white/60 hover:text-white transition-colors text-sm font-light">
                    Privacy Policy
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-light mb-4">Support</h3>
              <ul className="space-y-2">
                <li>
                  <Link href="/support" className="text-white/60 hover:text-white transition-colors text-sm font-light">
                    Help Center
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="text-white/60 hover:text-white transition-colors text-sm font-light">
                    Contact
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-white/8 text-center">
            <p className="text-white/60 font-light text-sm">
              © {new Date().getFullYear()} Rift. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

