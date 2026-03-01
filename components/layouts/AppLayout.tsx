'use client'

import { ReactNode, useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { usePathname, useRouter } from 'next/navigation'
import RiftLogo from '@/components/RiftLogo'

interface AppLayoutProps {
  children: ReactNode
}

/**
 * AppLayout for logged-in pages (Dashboard, Rifts, Messages, Activity)
 * Features: Left sidebar navigation, top bar with search + profile dropdown
 */
export default function AppLayout({ children }: AppLayoutProps) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const router = useRouter()
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  // Get search params from URL
  const getSearchParams = () => {
    if (typeof window === 'undefined') return new URLSearchParams()
    return new URLSearchParams(window.location.search)
  }

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { href: '/rifts', label: 'Rifts', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
    { href: '/messages', label: 'Messages', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
    { href: '/activity', label: 'Activity', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  ]

  const isActive = (href: string) => pathname === href || pathname?.startsWith(`${href}/`)

  // Initialize search value from URL params and sync on navigation
  useEffect(() => {
    const updateSearchFromURL = () => {
      const params = getSearchParams()
      const searchParam = params.get('search')
      setSearchValue(searchParam || '')
    }
    
    updateSearchFromURL()
    
    // Listen for URL changes (e.g., browser back/forward)
    const handlePopState = () => updateSearchFromURL()
    window.addEventListener('popstate', handlePopState)
    
    return () => window.removeEventListener('popstate', handlePopState)
  }, [pathname])

  // Handle search input with debouncing
  const handleSearchChange = (value: string) => {
    setSearchValue(value)

    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    // Debounce search update
    searchTimeoutRef.current = setTimeout(() => {
      const params = getSearchParams()
      
      if (value.trim()) {
        params.set('search', value.trim())
      } else {
        params.delete('search')
      }
      
      // Update URL without page reload
      const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname
      router.push(newUrl, { scroll: false })
    }, 300) // 300ms debounce
  }

  // Handle Enter key to search immediately
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
      
      const params = getSearchParams()
      if (searchValue.trim()) {
        params.set('search', searchValue.trim())
      } else {
        params.delete('search')
      }
      
      // If not on rifts page, navigate to rifts with search
      if (pathname !== '/rifts') {
        router.push(`/rifts?${params.toString()}`)
      } else {
        const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname
        router.push(newUrl, { scroll: false })
      }
    } else if (e.key === 'Escape') {
      setSearchValue('')
      const params = getSearchParams()
      params.delete('search')
      const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname
      router.push(newUrl, { scroll: false })
      searchInputRef.current?.blur()
    }
  }

  // Keyboard shortcut: Press '/' to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only focus if not typing in an input/textarea
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [])

  return (
    <div className="min-h-screen bg-transparent text-[#1d1d1f] flex">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/10 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Left Sidebar — glassmorphism */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 bg-white/70 backdrop-blur-2xl backdrop-saturate-[1.8] border-r border-black/[0.06] transition-all duration-300 md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } ${sidebarCollapsed ? 'md:w-16' : 'md:w-64'} w-64`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-black/[0.04]">
            <Link 
              href="/dashboard" 
              className={`flex items-center hover:opacity-80 transition-opacity ${sidebarCollapsed ? 'justify-center w-full' : ''}`}
            >
              <RiftLogo size={sidebarCollapsed ? "sm" : "md"} />
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden p-2 text-[#86868b] hover:text-[#1d1d1f] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Navigation */}
          <nav className={`flex-1 py-4 md:py-6 space-y-1 ${sidebarCollapsed ? 'px-2' : 'px-3 md:px-4'}`}>
            {/* Collapse Button */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className={`hidden md:flex items-center rounded-lg transition-colors group w-full mb-2 min-h-[44px] ${
                sidebarCollapsed ? 'justify-center px-2 py-3' : 'gap-3 px-4 py-3'
              } text-[#86868b] hover:text-[#1d1d1f] hover:bg-gray-50`}
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <svg 
                className="w-5 h-5 flex-shrink-0 transition-transform duration-300"
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
                style={{ transform: sidebarCollapsed ? 'rotate(180deg)' : 'rotate(0deg)' }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              {!sidebarCollapsed && (
                <span className="font-light text-sm whitespace-nowrap">Collapse</span>
              )}
            </button>

            {navItems.map((item) => {
              const active = isActive(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center rounded-lg transition-colors group min-h-[44px] ${
                    sidebarCollapsed ? 'justify-center px-2 py-3' : 'gap-3 px-4 py-3'
                  } ${
                    active
                      ? 'bg-black/[0.06] text-[#1d1d1f] font-medium'
                      : 'text-[#86868b] hover:text-[#1d1d1f] hover:bg-black/[0.03]'
                  }`}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                  </svg>
                  {!sidebarCollapsed && (
                    <span className="font-light text-sm whitespace-nowrap">{item.label}</span>
                  )}
                </Link>
              )
            })}
          </nav>

          {/* User Section */}
          {session && (
            <div className={`border-t border-black/[0.04] ${sidebarCollapsed ? 'p-2' : 'p-4'}`}>
              <div className={`flex items-center py-2 ${sidebarCollapsed ? 'justify-center' : 'gap-3 px-4'}`}>
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-medium text-[#1d1d1f]">
                    {session.user?.email?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                {!sidebarCollapsed && (
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-light text-[#1d1d1f] truncate">{session.user?.email}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-white/60 backdrop-blur-2xl backdrop-saturate-[1.8] border-b border-black/[0.04]">
          <div className="flex items-center justify-between h-16 px-3 sm:px-4 md:px-6 lg:px-8 gap-2 sm:gap-3">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f] transition-colors rounded-lg hover:bg-gray-50"
              aria-label="Open menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Search */}
            <div className="flex-1 max-w-xl mx-1 sm:mx-2 md:mx-4 min-w-0">
              <div className="relative">
                <input
                  ref={searchInputRef}
                  type="search"
                  placeholder={pathname === '/rifts' ? 'Search rifts...' : pathname === '/messages' ? 'Search messages...' : 'Search...'}
                  value={searchValue}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 sm:px-4 py-2.5 sm:py-2 pl-9 sm:pl-10 pr-9 sm:pr-10 text-[#1d1d1f] placeholder-gray-400 focus:outline-none focus:border-gray-300 focus:bg-gray-100 transition-all text-sm sm:text-base font-light"
                />
                <svg
                  className="absolute left-2.5 sm:left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {searchValue && (
                  <button
                    onClick={() => handleSearchChange('')}
                    className="absolute right-2.5 sm:right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-[#86868b] transition-colors"
                    aria-label="Clear search"
                  >
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Profile Dropdown */}
            {session && (
              <div className="relative flex-shrink-0">
                <button
                  onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                  className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors min-h-[44px] min-w-[44px] md:min-w-0"
                >
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-medium text-[#1d1d1f]">
                      {session.user?.email?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </div>
                  <svg
                    className={`hidden sm:block w-4 h-4 text-[#86868b] transition-transform flex-shrink-0 ${profileMenuOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {profileMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-xl z-50">
                    <div className="p-2">
                      <Link
                        href="/account"
                        className="block px-4 py-3 text-sm text-gray-700 hover:text-[#1d1d1f] hover:bg-gray-50 rounded-lg transition-colors min-h-[44px] flex items-center"
                        onClick={() => setProfileMenuOpen(false)}
                      >
                        Account
                      </Link>
                      {session.user?.role === 'ADMIN' && (
                        <Link
                          href="/admin"
                          className="block px-4 py-3 text-sm text-gray-700 hover:text-[#1d1d1f] hover:bg-gray-50 rounded-lg transition-colors min-h-[44px] flex items-center"
                          onClick={() => setProfileMenuOpen(false)}
                        >
                          Admin
                        </Link>
                      )}
                      <div className="border-t border-black/[0.04] my-2" />
                      <button
                        onClick={() => {
                          setProfileMenuOpen(false)
                          signOut()
                        }}
                        className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:text-[#1d1d1f] hover:bg-gray-50 rounded-lg transition-colors min-h-[44px] flex items-center"
                      >
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">{children}</div>
        </main>
      </div>

      {/* Close profile menu when clicking outside */}
      {profileMenuOpen && (
        <div
          className="fixed inset-0 z-20"
          onClick={() => setProfileMenuOpen(false)}
        />
      )}
    </div>
  )
}

