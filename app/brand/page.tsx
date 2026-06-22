'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function BrandHubRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/brand/requests')
  }, [router])
  return null
}
