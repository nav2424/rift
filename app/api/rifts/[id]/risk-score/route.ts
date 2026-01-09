/**
 * GET /api/rifts/[id]/risk-score
 * Get enhanced risk score for a rift
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import { computeEnhancedRiskScore } from '@/lib/ai/enhanced-risk-scoring'
import { predictChargebackProbability } from '@/lib/ai/enhanced-risk-scoring'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Verify access - try Prisma first, fallback to raw SQL if enum validation fails or columns don't exist
    let rift: any
    try {
      rift = await prisma.riftTransaction.findUnique({
        where: { id },
        select: {
          buyerId: true,
          sellerId: true,
        },
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
          SELECT id, "buyerId", "sellerId"
          FROM "EscrowTransaction"
          WHERE id = $1
        `, id)
        
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

    // Risk assessment is admin-only
    const isAdmin = auth.userRole === 'ADMIN'

    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    // Get device fingerprint from request
    const deviceFingerprint = {
      deviceId: request.headers.get('x-device-id') || undefined,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    }

    // Compute enhanced risk score
    const riskFactors = await computeEnhancedRiskScore(id, deviceFingerprint)

    // Predict chargeback probability
    const chargebackPrediction = await predictChargebackProbability(id)

    return NextResponse.json({
      riskFactors,
      chargebackPrediction,
    })
  } catch (error: any) {
    console.error('Get risk score error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}

