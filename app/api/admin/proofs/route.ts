import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * Admin endpoint to list all proofs requiring review
 * Returns proofs with PENDING status
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'PENDING'

    // Get all proofs with the specified status
    const proofs = await prisma.proof.findMany({
      where: {
        status: status as any,
      },
      include: {
        rift: {
          include: {
            buyer: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            seller: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        submittedAt: 'desc',
      },
    })

    return NextResponse.json({
      proofs,
      count: proofs.length,
    })
  } catch (error: any) {
    console.error('List proofs error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
