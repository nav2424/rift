'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { ReactNode } from 'react'

type NavLink = { href: string; label: string }

export default function FocusLayout({
  children,
  nav,
  title,
  flush,
}: {
  children: ReactNode
  nav: NavLink[]
  title?: string
  flush?: boolean
}) {
  const pathname = usePathname()
  const { data: session } = useSession()

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#18181B] flex">
      <aside className="w-52 shrink-0 border-r border-[#E4E4E7] bg-white flex flex-col">
        <div className="h-14 flex items-center px-5 border-b border-[#E4E4E7]">
          <Link href={nav[0]?.href || '/'} className="text-sm font-medium tracking-tight">
            Rift
          </Link>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-0.5">
          {nav.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(`${item.href}/`)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block px-3 py-2 text-sm rounded ${
                  active ? 'bg-[#FAFAFA] text-[#18181B] font-medium' : 'text-[#71717A] hover:text-[#18181B]'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="p-4 border-t border-[#E4E4E7] text-xs text-[#71717A]">
          <p className="truncate mb-2">{session?.user?.email}</p>
          <button type="button" onClick={() => signOut()} className="text-[#18181B] hover:underline">
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 flex flex-col">
        {title && (
          <header className="h-14 border-b border-[#E4E4E7] bg-white flex items-center px-8">
            <h1 className="text-sm font-medium">{title}</h1>
          </header>
        )}
        <div className={`flex-1 ${flush ? '' : 'p-8'}`}>{children}</div>
      </main>
    </div>
  )
}
