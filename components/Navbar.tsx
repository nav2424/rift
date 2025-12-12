'use client'

import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import PremiumButton from './ui/PremiumButton'
import RiftLogo from './RiftLogo'

export default function Navbar() {
  const { data: session } = useSession()

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black border-b border-white/8" style={{ backgroundColor: '#000000' }}>
      <div className="max-w-7xl mx-auto pl-2 sm:pl-4 lg:pl-6 pr-4 sm:pr-6 lg:pr-8">
        <div className="flex justify-between items-center h-20">
          <div className="flex items-center">
            <Link 
              href={session ? "/dashboard" : "/"} 
              className="flex items-center hover:opacity-80 transition-opacity" 
              style={{ 
                background: '#000000', 
                backgroundColor: '#000000',
                marginRight: '3rem',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                lineHeight: 0,
                height: '100%'
              }}
            >
              <RiftLogo size="md" />
            </Link>
            <div className="hidden md:flex space-x-8 ml-4">
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
                    <Link href="/admin" className="text-white/60 hover:text-white transition-colors duration-200 font-medium text-sm relative group">
                      Admin
                      <span className="absolute bottom-0 left-0 w-0 h-px bg-white group-hover:w-full transition-all duration-300"></span>
                    </Link>
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
          <div className="flex items-center space-x-6">
            {session ? (
              <>
                <span className="text-white/60 text-sm font-medium">{session.user.email}</span>
                <button
                  onClick={() => signOut()}
                  className="text-white/60 hover:text-white transition-colors duration-200 font-medium text-sm px-4 py-2 rounded-lg hover:bg-white/5"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link href="/auth/signin" className="text-white/60 hover:text-white transition-colors duration-200 font-medium text-sm">
                  Sign In
                </Link>
                <Link href="/auth/signup" className="text-white/60 hover:text-white transition-colors duration-200 font-medium text-sm">
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
