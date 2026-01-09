/**
 * Buyer Vault Access API
 * Allows buyers to view and access vault assets (files, license keys, tracking numbers, etc.)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getVaultAssets, buyerOpenAsset, buyerRevealLicenseKey } from '@/lib/vault-enhanced'
import { logVaultEvent } from '@/lib/vault-logging'
import { checkProofRateLimit } from '@/lib/rate-limits-proof'

/**
 * GET /api/rifts/[id]/vault
 * Get all vault assets accessible to the buyer
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limit: Vault views (100/15min)
    // Set userId in request for rate limiter
    ;(request as any).userId = session.user.id
    const rateLimitResult = checkProofRateLimit(request as any, 'view')
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: rateLimitResult.error || 'Too many vault views. Please try again later.',
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': '100',
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString(),
            'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
          },
        }
      )
    }

    const { id: riftId } = await params

    // Try Prisma first, fallback to raw SQL if enum validation fails or columns don't exist
    let rift: any
    try {
      rift = await prisma.riftTransaction.findUnique({
        where: { id: riftId },
      })
    } catch (findError: any) {
      const isEnumError = findError?.message?.includes('enum') || 
                          findError?.message?.includes('not found in enum') ||
                          findError?.message?.includes("Value 'TICKETS'") ||
                          findError?.message?.includes("Value 'DIGITAL'")
      const isColumnError = findError?.code === 'P2022' || 
                            findError?.message?.includes('does not exist in the current database') ||
                            (findError?.message?.includes('column') && findError?.message?.includes('does not exist'))
      
      if (isEnumError || isColumnError) {
        // Fetch rift using raw SQL with text casting to avoid enum/column validation
        const fetchedRifts = await prisma.$queryRawUnsafe<any[]>(`
          SELECT id, "buyerId", "sellerId", status::text as status
          FROM "EscrowTransaction"
          WHERE id = $1
        `, riftId)
        
        if (!fetchedRifts || fetchedRifts.length === 0) {
          return NextResponse.json({ error: 'Rift not found' }, { status: 404 })
        }
        
        rift = fetchedRifts[0]
      } else {
        throw findError
      }
    }

    if (!rift) {
      return NextResponse.json({ error: 'Rift not found' }, { status: 404 })
    }

    // Determine user role
    const isBuyer = rift.buyerId === session.user.id
    const isSeller = rift.sellerId === session.user.id
    const isAdmin = session.user.role === 'ADMIN'

    if (!isBuyer && !isSeller && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const viewerRole = isAdmin ? 'ADMIN' : isBuyer ? 'BUYER' : 'SELLER'
    const assets = await getVaultAssets(riftId, session.user.id, viewerRole)

    // For buyers, check which license keys have been revealed
    if (isBuyer) {
      for (const asset of assets) {
        if (asset.assetType === 'LICENSE_KEY') {
          // Check if license key has been revealed
          const revealEvent = await prisma.vault_events.findFirst({
            where: {
              assetId: asset.id,
              actorId: session.user.id,
              actorRole: 'BUYER',
              eventType: 'BUYER_REVEALED_LICENSE_KEY',
            },
          })
          asset.isRevealed = !!revealEvent
        }
      }
    }

    return NextResponse.json({ assets })
  } catch (error: any) {
    console.error('Get vault assets error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get vault assets' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/rifts/[id]/vault/open
 * Buyer opens an asset (file viewer, tracking number, etc.)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: riftId } = await params
    const body = await request.json()
    const { assetId, action } = body

    if (!assetId) {
      return NextResponse.json({ error: 'Asset ID required' }, { status: 400 })
    }

    // Rate limit based on action type
    // Set userId in request for rate limiter
    ;(request as any).userId = session.user.id
    const operation = action === 'reveal_license_key' ? 'reveal' : 'download'
    const rateLimitResult = checkProofRateLimit(request as any, operation)
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: rateLimitResult.error || `Too many ${operation} operations. Please try again later.`,
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': operation === 'reveal' ? '5' : '50',
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString(),
            'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
          },
        }
      )
    }

    // Try Prisma first, fallback to raw SQL if enum validation fails or columns don't exist
    let rift: any
    try {
      rift = await prisma.riftTransaction.findUnique({
        where: { id: riftId },
      })
    } catch (findError: any) {
      const isEnumError = findError?.message?.includes('enum') || 
                          findError?.message?.includes('not found in enum') ||
                          findError?.message?.includes("Value 'TICKETS'") ||
                          findError?.message?.includes("Value 'DIGITAL'")
      const isColumnError = findError?.code === 'P2022' || 
                            findError?.message?.includes('does not exist in the current database') ||
                            (findError?.message?.includes('column') && findError?.message?.includes('does not exist'))
      
      if (isEnumError || isColumnError) {
        // Fetch rift using raw SQL with text casting to avoid enum/column validation
        const fetchedRifts = await prisma.$queryRawUnsafe<any[]>(`
          SELECT id, "buyerId", "sellerId", status::text as status
          FROM "EscrowTransaction"
          WHERE id = $1
        `, riftId)
        
        if (!fetchedRifts || fetchedRifts.length === 0) {
          return NextResponse.json({ error: 'Rift not found' }, { status: 404 })
        }
        
        rift = fetchedRifts[0]
      } else {
        throw findError
      }
    }

    if (!rift) {
      return NextResponse.json({ error: 'Rift not found' }, { status: 404 })
    }

    // Only buyers can open assets
    if (rift.buyerId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const ip = request.headers.get('x-forwarded-for') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Handle license key reveal
    if (action === 'reveal_license_key') {
      const key = await buyerRevealLicenseKey(riftId, assetId, session.user.id, {
        ipHash: ip,
        userAgentHash: userAgent,
        sessionId: session.user.id,
      })
      return NextResponse.json({ licenseKey: key })
    }

    // Handle regular asset opening
    const result = await buyerOpenAsset(riftId, assetId, session.user.id, {
      ipHash: ip,
      userAgentHash: userAgent,
      sessionId: session.user.id,
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Open vault asset error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to open asset' },
      { status: 500 }
    )
  }
}

