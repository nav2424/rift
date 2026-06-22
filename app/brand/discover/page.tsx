'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function BrandDiscoverRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/brand/requests')
  }, [router])
  return null
}
