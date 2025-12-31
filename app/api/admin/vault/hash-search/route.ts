/**
 * Admin API: Search for proofs by hash across all transactions
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/admin/vault/hash-search?hash=SHA256_HASH
 * Search for all transactions using a specific proof hash
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const hash = searchParams.get('hash')

    if (!hash) {
      return NextResponse.json(
        { error: 'Hash parameter is required' },
        { status: 400 }
      )
    }

    // Find all assets with this hash
    const assets = await prisma.vaultAsset.findMany({
      where: { sha256: hash },
      include: {
        rift: {
          include: {
            buyer: { select: { id: true, email: true, name: true } },
            seller: { select: { id: true, email: true, name: true } },
            proofs: { where: { status: 'VALID' }, take: 1 },
          },
        },
        uploader: { select: { id: true, email: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    if (assets.length === 0) {
      return NextResponse.json({
        hash,
        found: false,
        assets: [],
        rifts: [],
      })
    }

    // Group by Rift
    const riftsMap = new Map()
    for (const asset of assets) {
      const riftId = asset.riftId
      if (!riftsMap.has(riftId)) {
        riftsMap.set(riftId, {
          rift: asset.rift,
          assets: [],
        })
      }
      riftsMap.get(riftId).assets.push({
        id: asset.id,
        assetType: asset.assetType,
        fileName: asset.fileName,
        createdAt: asset.createdAt,
        uploader: asset.uploader,
      })
    }

    const rifts = Array.from(riftsMap.values()).map(({ rift, assets }) => ({
      id: rift.id,
      riftNumber: rift.riftNumber,
      itemTitle: rift.itemTitle,
      itemType: rift.itemType,
      status: rift.status,
      buyer: rift.buyer,
      seller: rift.seller,
      createdAt: rift.createdAt,
      proofSubmittedAt: rift.proofSubmittedAt,
      assets,
    }))

    return NextResponse.json({
      hash,
      found: true,
      totalAssets: assets.length,
      totalRifts: rifts.length,
      rifts,
    })
  } catch (error: any) {
    console.error('Hash search error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to search hash' },
      { status: 500 }
    )
  }
}
