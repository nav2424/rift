'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function BrandCampaignsRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/brand/requests')
  }, [router])
  return null
}
