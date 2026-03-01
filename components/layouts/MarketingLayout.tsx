'use client'

import { ReactNode, useState, useEffect } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import RiftLogo from '@/components/RiftLogo'

interface MarketingLayoutProps {
  children: ReactNode
}

export default function MarketingLayout({ children }: MarketingLayoutProps) {
  const { data: session } = useSession()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : 'unset'
    return () => { document.body.style.overflow = 'unset' }
  }, [mobileMenuOpen])

  return (
    <div className="min-h-screen bg-white text-[#1d1d1f]">
      {/* Navigation */}
      <header className={`fixed top-0 z-50 w-full transition-all duration-300 ${scrolled ? 'bg-white/80 backdrop-blur-xl border-b border-gray-200/60 shadow-sm' : 'bg-transparent'}`}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex h-14 sm:h-16 items-center justify-between">
            <Link href="/" className="flex items-center hover:opacity-70 transition-opacity">
              <RiftLogo size="md" />
            </Link>

            {/* Desktop */}
            <nav className="hidden md:flex items-center gap-1 text-sm">
              <Link href="/" className="px-4 py-2 text-[#1d1d1f]/60 hover:text-[#1d1d1f] transition-colors rounded-lg font-light min-h-[44px] flex items-center">
                Product
              </Link>
              <Link href="/pricing" className="px-4 py-2 text-[#1d1d1f]/60 hover:text-[#1d1d1f] transition-colors rounded-lg font-light min-h-[44px] flex items-center">
                Pricing
              </Link>
              <Link href="/about" className="px-4 py-2 text-[#1d1d1f]/60 hover:text-[#1d1d1f] transition-colors rounded-lg font-light min-h-[44px] flex items-center">
                About
              </Link>
              {session ? (
                <Link href="/dashboard" className="px-4 py-2 text-[#1d1d1f]/60 hover:text-[#1d1d1f] transition-colors rounded-lg font-light ml-2 min-h-[44px] flex items-center">
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link href="/auth/signin" className="px-4 py-2 text-[#1d1d1f]/60 hover:text-[#1d1d1f] transition-colors rounded-lg font-light ml-4 min-h-[44px] flex items-center">
                    Sign In
                  </Link>
                  <Link href="/auth/signup" className="ml-2 rounded-full bg-[#1d1d1f] px-5 py-2.5 text-sm font-medium text-[#1d1d1f] hover:bg-[#1d1d1f]/90 transition min-h-[44px] flex items-center">
                    Get Started
                  </Link>
                </>
              )}
            </nav>

            {/* Mobile burger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2.5 text-[#1d1d1f]/60 hover:text-[#1d1d1f] transition-colors rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Menu"
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-white md:hidden" onClick={() => setMobileMenuOpen(false)}>
          <div className="flex flex-col pt-20 px-6" onClick={(e) => e.stopPropagation()}>
            {['Product', 'Pricing', 'About'].map((item) => (
              <Link key={item} href={item === 'Product' ? '/' : `/${item.toLowerCase()}`}
                className="py-4 text-[#1d1d1f] text-lg font-light border-b border-gray-100"
                onClick={() => setMobileMenuOpen(false)}>
                {item}
              </Link>
            ))}
            {session ? (
              <Link href="/dashboard" className="py-4 text-[#1d1d1f] text-lg font-light border-b border-gray-100" onClick={() => setMobileMenuOpen(false)}>Dashboard</Link>
            ) : (
              <>
                <Link href="/auth/signin" className="py-4 text-[#1d1d1f] text-lg font-light border-b border-gray-100" onClick={() => setMobileMenuOpen(false)}>Sign In</Link>
                <Link href="/auth/signup" className="mt-6 rounded-full bg-[#1d1d1f] py-4 text-center text-[#1d1d1f] font-medium" onClick={() => setMobileMenuOpen(false)}>Get Started</Link>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main */}
      <main className="pt-14 sm:pt-16">{children}</main>

      {/* Footer */}
      <footer className="border-t border-gray-200/60 bg-[#f5f5f7]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <RiftLogo size="md" />
              <p className="mt-4 text-[#86868b] text-sm font-light">The execution layer for creator-brand deals.</p>
            </div>
            <div>
              <h3 className="text-[#1d1d1f] text-xs font-semibold uppercase tracking-wider mb-4">Product</h3>
              <ul className="space-y-3">
                <li><Link href="/" className="text-[#86868b] hover:text-[#1d1d1f] transition-colors text-sm">How it works</Link></li>
                <li><Link href="/pricing" className="text-[#86868b] hover:text-[#1d1d1f] transition-colors text-sm">Pricing</Link></li>
                <li><Link href="/about" className="text-[#86868b] hover:text-[#1d1d1f] transition-colors text-sm">About</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-[#1d1d1f] text-xs font-semibold uppercase tracking-wider mb-4">Legal</h3>
              <ul className="space-y-3">
                <li><Link href="/terms" className="text-[#86868b] hover:text-[#1d1d1f] transition-colors text-sm">Terms of Service</Link></li>
                <li><Link href="/privacy" className="text-[#86868b] hover:text-[#1d1d1f] transition-colors text-sm">Privacy Policy</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-[#1d1d1f] text-xs font-semibold uppercase tracking-wider mb-4">Support</h3>
              <ul className="space-y-3">
                <li><Link href="/support" className="text-[#86868b] hover:text-[#1d1d1f] transition-colors text-sm">Help Center</Link></li>
                <li><Link href="/contact" className="text-[#86868b] hover:text-[#1d1d1f] transition-colors text-sm">Contact</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-200/60 text-center">
            <p className="text-[#86868b] text-xs">© {new Date().getFullYear()} Rift. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
