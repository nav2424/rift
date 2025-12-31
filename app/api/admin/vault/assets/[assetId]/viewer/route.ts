/**
 * Admin Vault Viewer (Safe)
 * View assets in safe renderer
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth, getAdminSessionFromRequest, requirePermission } from '@/lib/admin-auth'
import { AdminPermission } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getSecureFileUrl } from '@/lib/vault'
import { logAdminAction } from '@/lib/admin-audit'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/**
 * GET /api/admin/vault/assets/[assetId]/viewer
 * Get safe viewer URL for asset
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  try {
    // Try new admin auth first, fall back to old admin auth for backward compatibility
    let session = await getAdminSessionFromRequest(request)
    
    if (!session) {
      // Fall back to old admin auth system (for development/backward compatibility)
      const oldSession = await getServerSession(authOptions)
      if (oldSession?.user?.role === 'ADMIN') {
        // For old auth, skip permission check (assume full access)
        // In production, you should require the new admin session
      } else {
        throw new Error('Unauthorized: Admin session required')
      }
    } else {
      // Use new admin auth - check permissions
      requirePermission(session, AdminPermission.VAULT_READ)
    }

    const { assetId } = await params
    const ip = request.headers.get('x-forwarded-for') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    const asset = await prisma.vaultAsset.findUnique({
      where: { id: assetId },
      include: {
        rift: {
          select: {
            id: true,
            riftNumber: true,
            itemTitle: true,
          },
        },
      },
    })

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    let viewerUrl: string | null = null

    if (asset.storagePath) {
      viewerUrl = await getSecureFileUrl(asset.storagePath, 3600) // 1 hour
    } else if (asset.url) {
      viewerUrl = asset.url
    }

    // Log view (only if using new admin auth system)
    if (session) {
      await logAdminAction({
        adminUserId: session.adminUserId,
        action: 'VAULT_VIEWED',
        objectType: 'vault_asset',
        objectId: assetId,
        ip,
        userAgent,
        notes: `Viewed asset in safe viewer`,
      })
    }

    return NextResponse.json({
      asset: {
        id: asset.id,
        assetType: asset.assetType,
        fileName: asset.fileName,
        mimeDetected: asset.mimeDetected,
        scanStatus: asset.scanStatus,
        qualityScore: asset.qualityScore,
        metadataJson: asset.metadataJson,
        sha256: asset.sha256,
        createdAt: asset.createdAt,
        rift: asset.rift,
      },
      viewerUrl,
      textContent: asset.textContent,
      trackingNumber: asset.trackingNumber,
      url: asset.url,
    })
  } catch (error: any) {
    console.error('Admin vault viewer error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get viewer' },
      { status: 500 }
    )
  }
}

