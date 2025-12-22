'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Component that scrolls to top of page on route change
 */
export default function ScrollToTop() {
  const pathname = usePathname()

  useEffect(() => {
    // Immediately scroll to top when pathname changes
    const scrollToTop = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
      if (document.documentElement) {
        document.documentElement.scrollTop = 0
      }
      if (document.body) {
        document.body.scrollTop = 0
      }
    }

    // Scroll immediately
    scrollToTop()

    // Also scroll after multiple delays to prevent any components from overriding
    const timeouts = [
      setTimeout(scrollToTop, 0),
      setTimeout(scrollToTop, 50),
      setTimeout(scrollToTop, 100),
      setTimeout(scrollToTop, 200),
      setTimeout(scrollToTop, 500),
    ]

    return () => {
      timeouts.forEach(clearTimeout)
    }
  }, [pathname])

  return null
}
