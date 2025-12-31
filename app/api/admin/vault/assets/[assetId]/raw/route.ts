/**
 * Admin Vault Raw Access (Restricted)
 * Download raw files - requires higher permission and re-auth
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth, requirePermission, requireReAuth } from '@/lib/admin-auth'
import { AdminPermission } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getSecureFileUrl } from '@/lib/vault'
import { logAdminAction } from '@/lib/admin-audit'

/**
 * GET /api/admin/vault/assets/[assetId]/raw
 * Get raw download URL (restricted)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  try {
    const session = await requireAdminAuth(request)
    
    // Require raw download permission
    requirePermission(session, AdminPermission.VAULT_DOWNLOAD_RAW)

    const { assetId } = await params
    const { searchParams } = new URL(request.url)
    const reAuthPassword = searchParams.get('reAuthPassword')
    const reasonCode = searchParams.get('reasonCode') || 'ADMIN_REVIEW'

    // Require re-authentication for raw access
    if (!reAuthPassword) {
      return NextResponse.json(
        { error: 'Re-authentication required for raw download', requiresReAuth: true },
        { status: 403 }
      )
    }

    const reAuthValid = await requireReAuth(session, reAuthPassword)
    if (!reAuthValid) {
      return NextResponse.json(
        { error: 'Re-authentication failed' },
        { status: 403 }
      )
    }

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

    if (!asset.storagePath) {
      return NextResponse.json(
        { error: 'Asset has no file to download' },
        { status: 400 }
      )
    }

    // Get raw download URL
    const downloadUrl = await getSecureFileUrl(asset.storagePath, 300) // 5 minutes

    // Log raw download (critical action)
    await logAdminAction({
      adminUserId: session.adminUserId,
      action: 'VAULT_DOWNLOADED_RAW',
      objectType: 'vault_asset',
      objectId: assetId,
      ip,
      userAgent,
      reasonCode,
      notes: `Raw download of ${asset.fileName || asset.assetType}`,
    })

    return NextResponse.json({
      downloadUrl,
      asset: {
        id: asset.id,
        assetType: asset.assetType,
        fileName: asset.fileName,
        sha256: asset.sha256,
        mimeDetected: asset.mimeDetected,
      },
      expiresIn: 300, // 5 minutes
    })
  } catch (error: any) {
    console.error('Admin vault raw download error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get raw download' },
      { status: 500 }
    )
  }
}

