'use client'

import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { useState, useEffect } from 'react'
import PremiumButton from './ui/PremiumButton'
import RiftLogo from './RiftLogo'

export default function Navbar() {
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

  const navLinks = session ? (
    <>
      <Link 
        href="/dashboard" 
        className="block py-3 px-4 text-white/80 hover:text-white hover:bg-white/5 transition-colors duration-200 font-medium text-base border-b border-white/10"
        onClick={() => setMobileMenuOpen(false)}
      >
        Dashboard
      </Link>
      <Link 
        href="/rifts" 
        className="block py-3 px-4 text-white/80 hover:text-white hover:bg-white/5 transition-colors duration-200 font-medium text-base border-b border-white/10"
        onClick={() => setMobileMenuOpen(false)}
      >
        Rifts
      </Link>
      <Link 
        href="/activity" 
        className="block py-3 px-4 text-white/80 hover:text-white hover:bg-white/5 transition-colors duration-200 font-medium text-base border-b border-white/10"
        onClick={() => setMobileMenuOpen(false)}
      >
        Activity
      </Link>
      <Link 
        href="/messages" 
        className="block py-3 px-4 text-white/80 hover:text-white hover:bg-white/5 transition-colors duration-200 font-medium text-base border-b border-white/10"
        onClick={() => setMobileMenuOpen(false)}
        data-onboarding="messages"
      >
        Messages
      </Link>
      <Link 
        href="/account" 
        className="block py-3 px-4 text-white/80 hover:text-white hover:bg-white/5 transition-colors duration-200 font-medium text-base border-b border-white/10"
        onClick={() => setMobileMenuOpen(false)}
        data-onboarding="account"
      >
        Account
      </Link>
      {session.user.role === 'ADMIN' && (
        <>
        <Link 
          href="/admin" 
          className="block py-3 px-4 text-white/80 hover:text-white hover:bg-white/5 transition-colors duration-200 font-medium text-base border-b border-white/10"
          onClick={() => setMobileMenuOpen(false)}
        >
          Admin
        </Link>
          <Link 
            href="/admin/disputes" 
            className="block py-3 px-4 text-white/80 hover:text-white hover:bg-white/5 transition-colors duration-200 font-medium text-base border-b border-white/10"
            onClick={() => setMobileMenuOpen(false)}
          >
            Disputes
          </Link>
        </>
      )}
      <div className="p-4 border-t border-white/10 mt-4">
        <p className="text-white/60 text-sm mb-2 px-4">{session.user.email}</p>
        <button
          onClick={() => {
            setMobileMenuOpen(false)
            signOut()
          }}
          className="w-full text-left py-3 px-4 text-white/80 hover:text-white hover:bg-white/5 transition-colors duration-200 font-medium text-base rounded-lg"
        >
          Sign Out
        </button>
      </div>
    </>
  ) : (
    <>
      <Link 
        href="/" 
        className="block py-3 px-4 text-white/80 hover:text-white hover:bg-white/5 transition-colors duration-200 font-medium text-base border-b border-white/10"
        onClick={() => setMobileMenuOpen(false)}
      >
        Home
      </Link>
      <Link 
        href="/pricing" 
        className="block py-3 px-4 text-white/80 hover:text-white hover:bg-white/5 transition-colors duration-200 font-medium text-base border-b border-white/10"
        onClick={() => setMobileMenuOpen(false)}
      >
        Pricing
      </Link>
      <div className="p-4 border-t border-white/10 mt-4 space-y-2">
        <Link 
          href="/auth/signin" 
          className="block w-full text-center py-3 px-4 text-white/80 hover:text-white hover:bg-white/5 transition-colors duration-200 font-medium text-base rounded-lg"
          onClick={() => setMobileMenuOpen(false)}
        >
          Sign In
        </Link>
        <Link 
          href="/auth/signup" 
          className="block w-full text-center py-3 px-4 bg-white/10 hover:bg-white/20 text-white transition-colors duration-200 font-medium text-base rounded-lg border border-white/20"
          onClick={() => setMobileMenuOpen(false)}
        >
          Get Started
        </Link>
      </div>
    </>
  )

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black border-b border-white/8" style={{ backgroundColor: '#000000', position: 'relative' }} data-onboarding="navigation">
              <Link 
                href={session ? "/dashboard" : "/"} 
                className="flex items-center hover:opacity-80 transition-opacity" 
                style={{ 
                  background: '#000000', 
                  backgroundColor: '#000000',
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
                    <Link href="/dashboard" className="text-white/60 hover:text-white transition-colors duration-200 font-medium text-sm relative group">
                      Dashboard
                      <span className="absolute bottom-0 left-0 w-0 h-px bg-white group-hover:w-full transition-all duration-300"></span>
                    </Link>
                    <Link href="/rifts" className="text-white/60 hover:text-white transition-colors duration-200 font-medium text-sm relative group">
                      Rifts
                      <span className="absolute bottom-0 left-0 w-0 h-px bg-white group-hover:w-full transition-all duration-300"></span>
                    </Link>
                    <Link href="/activity" className="text-white/60 hover:text-white transition-colors duration-200 font-medium text-sm relative group">
                      Activity
                      <span className="absolute bottom-0 left-0 w-0 h-px bg-white group-hover:w-full transition-all duration-300"></span>
                    </Link>
                    <Link href="/messages" className="text-white/60 hover:text-white transition-colors duration-200 font-medium text-sm relative group">
                      Messages
                      <span className="absolute bottom-0 left-0 w-0 h-px bg-white group-hover:w-full transition-all duration-300"></span>
                    </Link>
                    <Link href="/account" className="text-white/60 hover:text-white transition-colors duration-200 font-medium text-sm relative group">
                      Account
                      <span className="absolute bottom-0 left-0 w-0 h-px bg-white group-hover:w-full transition-all duration-300"></span>
                    </Link>
                    {session.user.role === 'ADMIN' && (
                      <>
                      <Link href="/admin" className="text-white/60 hover:text-white transition-colors duration-200 font-medium text-sm relative group">
                        Admin
                        <span className="absolute bottom-0 left-0 w-0 h-px bg-white group-hover:w-full transition-all duration-300"></span>
                      </Link>
                        <Link href="/admin/disputes" className="text-white/60 hover:text-white transition-colors duration-200 font-medium text-sm relative group">
                          Disputes
                          <span className="absolute bottom-0 left-0 w-0 h-px bg-white group-hover:w-full transition-all duration-300"></span>
                        </Link>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <Link href="/" className="text-white/60 hover:text-white transition-colors duration-200 font-medium text-sm relative group">
                      Home
                      <span className="absolute bottom-0 left-0 w-0 h-px bg-white group-hover:w-full transition-all duration-300"></span>
                    </Link>
                    <Link href="/pricing" className="text-white/60 hover:text-white transition-colors duration-200 font-medium text-sm relative group">
                      Pricing
                      <span className="absolute bottom-0 left-0 w-0 h-px bg-white group-hover:w-full transition-all duration-300"></span>
                    </Link>
                  </>
                )}
              </div>
            </div>
            <div className="hidden md:flex items-center space-x-6">
              {session ? (
                <>
                  <span className="text-white/60 text-sm font-medium hidden lg:inline">{session.user.email}</span>
                  <button
                    onClick={() => signOut()}
                    className="text-white/60 hover:text-white transition-colors duration-200 font-medium text-sm px-4 py-2 rounded-lg hover:bg-white/5 min-h-[44px] min-w-[44px] flex items-center justify-center"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <Link href="/auth/signin" className="text-white/60 hover:text-white transition-colors duration-200 font-medium text-sm min-h-[44px] min-w-[44px] flex items-center justify-center">
                    Sign In
                  </Link>
                  <Link href="/auth/signup" className="text-white/60 hover:text-white transition-colors duration-200 font-medium text-sm min-h-[44px] min-w-[44px] flex items-center justify-center">
                    Get Started
                  </Link>
                </>
              )}
            </div>
            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-white/80 hover:text-white transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
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

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/95 backdrop-blur-sm md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div 
            className="fixed top-16 left-0 right-0 bottom-0 bg-black border-t border-white/8 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="py-2">
              {navLinks}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
