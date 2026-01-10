/**
 * Admin Vault Console API
 * Provides admin access to vault assets, logs, and review capabilities
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getSecureFileUrl, decryptSensitiveData } from '@/lib/vault'
import { logVaultEvent } from '@/lib/vault-logging'
import { verifyRiftProofs } from '@/lib/vault-verification'
import { transitionRiftState } from '@/lib/rift-state'

/**
 * GET /api/admin/vault/[riftId]
 * Get all vault assets for a Rift with full admin view
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ riftId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { riftId } = await params

    // Get Rift with all related data
    // Use explicit select to avoid schema mismatch issues with archive fields
    const rift = await prisma.riftTransaction.findUnique({
      where: { id: riftId },
      select: {
        id: true,
        riftNumber: true,
        itemTitle: true,
        itemDescription: true,
        itemType: true,
        amount: true,
        currency: true,
        status: true,
        buyerId: true,
        sellerId: true,
        createdAt: true,
        updatedAt: true,
        subtotal: true,
        buyerFee: true,
        sellerFee: true,
        buyer: {
          select: {
            id: true,
            name: true,
            email: true,
            riftUserId: true,
          },
        },
        seller: {
          select: {
            id: true,
            name: true,
            email: true,
            riftUserId: true,
          },
        },
        vault_assets: {
          orderBy: { createdAt: 'asc' },
        },
        vault_events: {
          orderBy: { timestampUtc: 'desc' },
          take: 50,
          select: {
            id: true,
            eventType: true,
            timestampUtc: true,
            actorRole: true,
            actorId: true,
            metadata: true,
            vault_assets: {
              select: {
                id: true,
                assetType: true,
                fileName: true,
              },
            },
          },
        },
        admin_reviews: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            status: true,
            notes: true,
            reasonsJson: true,
            createdAt: true,
            resolvedAt: true,
            User: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    })

    if (!rift) {
      return NextResponse.json({ error: 'Rift not found' }, { status: 404 })
    }

    // Get buyer access history for each asset
    const assetsWithHistory = await Promise.all(
      rift.vault_assets.map(async (asset) => {
        const buyerEvents = await prisma.vault_events.findMany({
          where: {
            assetId: asset.id,
            actorRole: 'BUYER',
            eventType: {
              in: [
                'BUYER_OPENED_ASSET',
                'BUYER_DOWNLOADED_FILE',
                'BUYER_REVEALED_LICENSE_KEY',
                'BUYER_VIEWED_QR',
                'BUYER_VIEWED_TRACKING',
              ],
            },
          },
          orderBy: { timestampUtc: 'desc' },
        })

        return {
          ...asset,
          buyerAccessHistory: buyerEvents.map((e) => ({
            eventType: e.eventType,
            timestampUtc: e.timestampUtc,
            ipHash: e.ipHash,
            sessionId: e.sessionId,
          })),
        }
      })
    )

    return NextResponse.json({
      rift: {
        id: rift.id,
        riftNumber: rift.riftNumber,
        status: rift.status,
        itemType: rift.itemType,
        itemTitle: rift.itemTitle,
        buyer: rift.buyer,
        seller: rift.seller,
      },
      assets: assetsWithHistory,
      events: rift.vault_events,
      reviews: rift.admin_reviews,
    })
  } catch (error: any) {
    console.error('Admin vault GET error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch vault data' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/vault/[riftId]/view-asset
 * Admin views an asset (same as buyer would see)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ riftId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { riftId } = await params
    const body = await request.json()
    const { assetId, action } = body

    if (!assetId) {
      return NextResponse.json({ error: 'Asset ID required' }, { status: 400 })
    }

    const asset = await prisma.vault_assets.findUnique({
      where: { id: assetId },
    })

    if (!asset || asset.riftId !== riftId) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    // Log admin view
    await logVaultEvent({
      riftId,
      assetId,
      actorId: session.user.id,
      actorRole: 'ADMIN',
      eventType: action === 'download' ? 'ADMIN_DOWNLOADED_RAW' : 'ADMIN_VIEWED_ASSET',
    })

    // Return appropriate content
    if (asset.storagePath) {
      const url = await getSecureFileUrl(asset.storagePath, action === 'download' ? 3600 : 300)
      return NextResponse.json({ url, assetType: asset.assetType })
    }

    if (asset.url) {
      return NextResponse.json({ url: asset.url, assetType: asset.assetType })
    }

    if (asset.textContent) {
      return NextResponse.json({ content: asset.textContent, assetType: asset.assetType })
    }

    if (asset.trackingNumber) {
      return NextResponse.json({
        trackingNumber: asset.trackingNumber,
        assetType: asset.assetType,
      })
    }

    if (asset.encryptedData && asset.assetType === 'LICENSE_KEY') {
      // Decrypt license key for admin using proper decryption
      try {
        const key = await decryptSensitiveData(asset.encryptedData)
        return NextResponse.json({ licenseKey: key, assetType: asset.assetType })
      } catch (decryptError: any) {
        console.error('License key decryption error:', decryptError)
        return NextResponse.json(
          { error: 'Failed to decrypt license key' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({ error: 'Asset has no accessible content' }, { status: 400 })
  } catch (error: any) {
    console.error('Admin vault view asset error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to view asset' },
      { status: 500 }
    )
  }
}

