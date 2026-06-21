'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function CreatorHubRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/creator/assignments')
  }, [router])
  return null
}
