'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminCampaignsRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/admin/requests')
  }, [router])
  return null
}
