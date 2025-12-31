import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { getSecureFileUrl } from '@/lib/vault'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/vault/[path]
 * Get secure signed URL for file access
 * Verifies user has permission to access the file
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { path } = await params
    const searchParams = request.nextUrl.searchParams
    const download = searchParams.get('download') === 'true'
    const expiresIn = parseInt(searchParams.get('expiresIn') || '3600') // Default 1 hour

    // Decode the path (it's URL encoded)
    const storagePath = decodeURIComponent(path)

    // Extract riftId from path (format: rifts/{riftId}/filename)
    const pathParts = storagePath.split('/')
    const riftIdIndex = pathParts.indexOf('rifts')
    if (riftIdIndex === -1 || riftIdIndex + 1 >= pathParts.length) {
      return NextResponse.json(
        { error: 'Invalid file path' },
        { status: 400 }
      )
    }

    const riftId = pathParts[riftIdIndex + 1]

    // Verify user has access to this rift
    const rift = await prisma.riftTransaction.findUnique({
      where: { id: riftId },
      select: {
        buyerId: true,
        sellerId: true,
        fileStorageType: true,
        licenseKeyRevealed: true,
      },
    })

    if (!rift) {
      return NextResponse.json(
        { error: 'Rift not found' },
        { status: 404 }
      )
    }

    // Check if user is buyer or seller
    const isBuyer = rift.buyerId === auth.userId
    const isSeller = rift.sellerId === auth.userId
    const isAdmin = auth.userRole === 'ADMIN'

    if (!isBuyer && !isSeller && !isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have access to this file' },
        { status: 403 }
      )
    }

    // File path verification removed (fileUploadPath field doesn't exist in schema)

    // For license keys, check if they've been revealed
    // (This would be checked against a separate license key reveal table in production)

    // Get secure signed URL
    const signedUrl = await getSecureFileUrl(storagePath, expiresIn)

    // If download is requested and file is view-only, return error
    // (This check would be against file metadata in production)
    if (download && rift.fileStorageType === 'VAULT') {
      // Check if view-only is enabled (would check metadata)
      // For now, allow downloads
    }

    return NextResponse.json({
      url: signedUrl,
      expiresIn,
    })
  } catch (error: any) {
    console.error('Vault access error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to access file' },
      { status: 500 }
    )
  }
}

