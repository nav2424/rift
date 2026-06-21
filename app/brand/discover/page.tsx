'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** Brands no longer discover creators directly — Rift assigns internally. */
export default function DiscoverCreatorsRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/brand/campaigns')
  }, [router])
  return null
}
