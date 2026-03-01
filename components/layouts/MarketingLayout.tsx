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
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : 'unset'
    return () => { document.body.style.overflow = 'unset' }
  }, [mobileMenuOpen])

  const navLinks = [
    { label: 'Product', href: '/' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'About', href: '/about' },
  ]

  return (
    <div className="min-h-screen bg-white text-[#1d1d1f]">
      {/* ─── Navigation ─── */}
      <header
        className={`fixed top-0 z-50 w-full transition-all duration-500 ${
          scrolled
            ? 'bg-white/70 backdrop-blur-2xl backdrop-saturate-[1.8] border-b border-black/[0.04] shadow-[0_1px_3px_rgba(0,0,0,0.04)]'
            : 'bg-white/0'
        }`}
      >
        <div className="mx-auto max-w-[1120px] px-5 sm:px-8">
          <div className="flex h-12 items-center justify-between">
            {/* Logo */}
            <Link href="/" className="relative flex items-center hover:opacity-60 transition-opacity duration-200">
              <RiftLogo size="md" />
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center">
              <div className="flex items-center gap-0.5">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="px-3.5 py-1.5 text-[13px] text-[#1d1d1f]/50 hover:text-[#1d1d1f] transition-colors duration-200 rounded-md"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>

              <div className="ml-5 flex items-center gap-3">
                {session ? (
                  <Link
                    href="/dashboard"
                    className="text-[13px] text-[#1d1d1f]/50 hover:text-[#1d1d1f] transition-colors duration-200"
                  >
                    Dashboard
                  </Link>
                ) : (
                  <>
                    <Link
                      href="/auth/signin"
                      className="text-[13px] text-[#1d1d1f]/50 hover:text-[#1d1d1f] transition-colors duration-200"
                    >
                      Sign in
                    </Link>
                    <Link
                      href="/auth/signup"
                      className="rounded-full bg-[#1d1d1f] px-4 py-[7px] text-[13px] font-medium text-white hover:bg-[#000] transition-colors duration-200"
                    >
                      Get started
                    </Link>
                  </>
                )}
              </div>
            </nav>

            {/* Mobile button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden -mr-1 p-2 text-[#1d1d1f]/40 hover:text-[#1d1d1f] transition-colors rounded-lg"
              aria-label="Menu"
            >
              {mobileMenuOpen ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" /></svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" /></svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ─── Mobile menu ─── */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-white/95 backdrop-blur-xl md:hidden animate-in fade-in duration-200"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div className="flex flex-col pt-16 px-6" onClick={(e) => e.stopPropagation()}>
            <div className="space-y-0">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block py-3 text-[#1d1d1f] text-base font-light border-b border-gray-100/80"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              {session ? (
                <Link href="/dashboard" className="block py-3 text-[#1d1d1f] text-base font-light border-b border-gray-100/80" onClick={() => setMobileMenuOpen(false)}>
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link href="/auth/signin" className="block py-3 text-[#1d1d1f] text-base font-light border-b border-gray-100/80" onClick={() => setMobileMenuOpen(false)}>
                    Sign in
                  </Link>
                  <Link href="/auth/signup" className="mt-5 block rounded-full bg-[#1d1d1f] py-3 text-center text-sm text-white font-medium" onClick={() => setMobileMenuOpen(false)}>
                    Get started
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Content ─── */}
      <main className="pt-12">{children}</main>

      {/* ─── Footer ─── */}
      <footer className="border-t border-black/[0.04]">
        <div className="max-w-[1120px] mx-auto px-5 sm:px-8 py-10">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
            <div className="col-span-2 md:col-span-2">
              <RiftLogo size="sm" />
              <p className="mt-3 text-[#86868b] text-[13px] leading-relaxed max-w-[240px]">
                The execution layer for creator-brand deals.
              </p>
            </div>
            {[
              { title: 'Product', links: [{ label: 'How it works', href: '/' }, { label: 'Pricing', href: '/pricing' }, { label: 'About', href: '/about' }] },
              { title: 'Legal', links: [{ label: 'Terms', href: '/terms' }, { label: 'Privacy', href: '/privacy' }] },
              { title: 'Support', links: [{ label: 'Help Center', href: '/support' }, { label: 'Contact', href: '/contact' }] },
            ].map((col) => (
              <div key={col.title}>
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#86868b] mb-3">{col.title}</h3>
                <ul className="space-y-2">
                  {col.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className="text-[13px] text-[#86868b] hover:text-[#1d1d1f] transition-colors duration-200">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-8 pt-6 border-t border-black/[0.04]">
            <p className="text-[#86868b] text-[11px]">
              Copyright © {new Date().getFullYear()} Rift. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
