import { getAuthenticatedUser } from './mobile-auth'
import { prisma } from './prisma'
import { NextRequest } from 'next/server'

export async function requireRequestAuth(request: NextRequest) {
  const auth = await getAuthenticatedUser(request)
  if (!auth) return { error: 'Unauthorized' as const, status: 401 as const }
  return { auth }
}

export async function loadRequestForUser(requestId: string, userId: string, role: 'USER' | 'ADMIN') {
  const videoRequest = await prisma.videoRequest.findUnique({
    where: { id: requestId },
    include: {
      brand: { select: { id: true, name: true, email: true, createdAt: true } },
      milestones: { orderBy: { sortOrder: 'asc' } },
      deliverables: { orderBy: { uploadedAt: 'desc' } },
    },
  })
  if (!videoRequest) return null
  if (role !== 'ADMIN' && videoRequest.brandId !== userId) return null
  return videoRequest
}

export async function isBrandUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { platformRole: true, role: true, BrandProfile: { select: { id: true } } },
  })
  if (!user) return false
  if (user.role === 'ADMIN') return true
  return user.platformRole === 'BRAND' || !!user.BrandProfile
}
