'use client'

import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { useState, useEffect } from 'react'
import PremiumButton from './ui/PremiumButton'
import RiftLogo from './RiftLogo'
import { getAppNavItems, getAdminNavItems } from '@/lib/nav-items'

export default function Navbar() {
  const { data: session } = useSession()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [platformRole, setPlatformRole] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return
    fetch('/api/me/role', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setPlatformRole(d.platformRole || null))
      .catch(() => {})
  }, [session])

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

  const appNav = session ? getAppNavItems(platformRole) : []
  const adminNav = session?.user?.role === 'ADMIN' ? getAdminNavItems() : []

  const navLinks = session ? (
    <>
      {appNav.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="block py-3 px-6 text-gray-700 hover:text-[#1d1d1f] hover:bg-gray-50 transition-colors duration-200 font-medium text-base border-b border-gray-200 text-right w-full"
          onClick={() => setMobileMenuOpen(false)}
        >
          {item.label}
        </Link>
      ))}
      {adminNav.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="block py-3 px-6 text-gray-700 hover:text-[#1d1d1f] hover:bg-gray-50 transition-colors duration-200 font-medium text-base border-b border-gray-200 text-right w-full"
          onClick={() => setMobileMenuOpen(false)}
        >
          {item.label}
        </Link>
      ))}
      <div className="p-4 border-t border-gray-200 mt-4 w-full">
        <p className="text-[#86868b] text-sm mb-2 px-6 text-right">{session.user.email}</p>
        <button
          onClick={() => {
            setMobileMenuOpen(false)
            signOut()
          }}
          className="w-full text-right py-3 px-6 text-gray-700 hover:text-[#1d1d1f] hover:bg-gray-50 transition-colors duration-200 font-medium text-base rounded-lg"
        >
          Sign Out
        </button>
      </div>
    </>
  ) : (
    <>
      <Link 
        href="/" 
        className="block py-3 px-6 text-gray-700 hover:text-[#1d1d1f] hover:bg-gray-50 transition-colors duration-200 font-medium text-base border-b border-gray-200 text-right w-full"
        onClick={() => setMobileMenuOpen(false)}
      >
        Home
      </Link>
      <Link 
        href="/pricing" 
        className="block py-3 px-6 text-gray-700 hover:text-[#1d1d1f] hover:bg-gray-50 transition-colors duration-200 font-medium text-base border-b border-gray-200 text-right w-full"
        onClick={() => setMobileMenuOpen(false)}
      >
        Pricing
      </Link>
      <div className="p-4 border-t border-gray-200 mt-4 space-y-2 w-full">
        <Link 
          href="/auth/signin" 
          className="block w-full text-right py-3 px-6 text-gray-700 hover:text-[#1d1d1f] hover:bg-gray-50 transition-colors duration-200 font-medium text-base rounded-lg"
          onClick={() => setMobileMenuOpen(false)}
        >
          Sign In
        </Link>
        <Link 
          href="/auth/signup" 
          className="block w-full text-right py-3 px-6 bg-gray-100 hover:bg-gray-200 text-[#1d1d1f] transition-colors duration-200 font-medium text-base rounded-lg border border-gray-300"
          onClick={() => setMobileMenuOpen(false)}
        >
          Get Started
        </Link>
      </div>
    </>
  )

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200" style={{ backgroundColor: '#ffffff', position: 'relative' }} data-onboarding="navigation">
              <Link 
                href={session ? "/dashboard" : "/"} 
                className="flex items-center hover:opacity-80 transition-opacity" 
                style={{ 
                  background: '#ffffff', 
                  backgroundColor: '#ffffff',
            margin: 0,
                  padding: 0,
            paddingLeft: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  lineHeight: 0,
            height: '100%',
            position: 'absolute',
            left: 0,
            top: 0,
            zIndex: 10
                }}
              >
                <RiftLogo size="md" />
              </Link>
        <div className="max-w-7xl mx-auto pl-28 pr-0">
          <div className="flex justify-between items-center h-16 sm:h-20">
            <div className="flex items-center">
              <div className="hidden md:flex space-x-8">
                {session ? (
                  <>
                    {appNav.map((item) => (
                      <Link key={item.href} href={item.href} className="text-[#86868b] hover:text-[#1d1d1f] transition-colors duration-200 font-medium text-sm relative group">
                        {item.label}
                        <span className="absolute bottom-0 left-0 w-0 h-px bg-[#1d1d1f] group-hover:w-full transition-all duration-300"></span>
                      </Link>
                    ))}
                    {adminNav.map((item) => (
                      <Link key={item.href} href={item.href} className="text-[#86868b] hover:text-[#1d1d1f] transition-colors duration-200 font-medium text-sm relative group">
                        {item.label}
                        <span className="absolute bottom-0 left-0 w-0 h-px bg-[#1d1d1f] group-hover:w-full transition-all duration-300"></span>
                      </Link>
                    ))}
                  </>
                ) : (
                  <>
                    <Link href="/" className="text-[#86868b] hover:text-[#1d1d1f] transition-colors duration-200 font-medium text-sm relative group">
                      Home
                      <span className="absolute bottom-0 left-0 w-0 h-px bg-[#1d1d1f] group-hover:w-full transition-all duration-300"></span>
                    </Link>
                    <Link href="/pricing" className="text-[#86868b] hover:text-[#1d1d1f] transition-colors duration-200 font-medium text-sm relative group">
                      Pricing
                      <span className="absolute bottom-0 left-0 w-0 h-px bg-[#1d1d1f] group-hover:w-full transition-all duration-300"></span>
                    </Link>
                  </>
                )}
              </div>
            </div>
            <div className="hidden md:flex items-center space-x-6">
              {session ? (
                <>
                  <span className="text-[#86868b] text-sm font-medium hidden lg:inline">{session.user.email}</span>
                  <button
                    onClick={() => signOut()}
                    className="text-[#86868b] hover:text-[#1d1d1f] transition-colors duration-200 font-medium text-sm px-4 py-2 rounded-lg hover:bg-gray-50 min-h-[44px] min-w-[44px] flex items-center justify-center"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <Link href="/auth/signin" className="text-[#86868b] hover:text-[#1d1d1f] transition-colors duration-200 font-medium text-sm min-h-[44px] min-w-[44px] flex items-center justify-center">
                    Sign In
                  </Link>
                  <Link href="/auth/signup" className="text-[#86868b] hover:text-[#1d1d1f] transition-colors duration-200 font-medium text-sm min-h-[44px] min-w-[44px] flex items-center justify-center">
                    Get Started
                  </Link>
                </>
              )}
            </div>
            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-gray-700 hover:text-[#1d1d1f] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Toggle menu"
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
      </nav>

      {/* Mobile Menu Overlay - Full Screen with Right-Aligned Options */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-white/95 backdrop-blur-sm md:hidden"
          onClick={() => setMobileMenuOpen(false)}
          style={{
            animation: 'slideInRight 0.3s ease-out',
          }}
        >
          <div 
            className="fixed inset-0 bg-white overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with close button */}
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <div className="flex items-center">
                <RiftLogo size="md" />
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 text-gray-700 hover:text-[#1d1d1f] transition-colors"
                aria-label="Close menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Navigation Links - Right Aligned */}
            <div className="flex flex-col items-end pt-8 px-4">
              <div className="w-full max-w-sm flex flex-col items-end">
                {navLinks}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
