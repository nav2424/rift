/**
 * Admin API: Check for duplicate proofs across transactions
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkDuplicateProofs } from '@/lib/duplicate-proof-detection'

/**
 * POST /api/admin/vault/duplicate-check
 * Check if asset hashes are duplicated across transactions
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { assetHashes, riftId, sellerId } = body

    if (!assetHashes || !Array.isArray(assetHashes) || assetHashes.length === 0) {
      return NextResponse.json(
        { error: 'Asset hashes array is required' },
        { status: 400 }
      )
    }

    if (!riftId) {
      return NextResponse.json(
        { error: 'Rift ID is required' },
        { status: 400 }
      )
    }

    const result = await checkDuplicateProofs(
      assetHashes,
      riftId,
      sellerId || ''
    )

    // Get detailed information about duplicate Rifts
    if (result.duplicateRiftIds.length > 0) {
      const duplicateRifts = await prisma.riftTransaction.findMany({
        where: { id: { in: result.duplicateRiftIds } },
        include: {
          buyer: { select: { id: true, email: true, name: true } },
          seller: { select: { id: true, email: true, name: true } },
          proofs: { where: { status: 'VALID' }, take: 1 },
        },
      })

      return NextResponse.json({
        ...result,
        duplicateRifts: duplicateRifts.map(r => ({
          id: r.id,
          riftNumber: r.riftNumber,
          itemTitle: r.itemTitle,
          status: r.status,
          buyer: r.buyer,
          seller: r.seller,
          createdAt: r.createdAt,
          proofSubmittedAt: r.proofSubmittedAt,
        })),
      })
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Duplicate check error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to check duplicates' },
      { status: 500 }
    )
  }
}
