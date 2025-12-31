import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'

/**
 * Export rifts as CSV
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = auth.userId

    // Get all rifts for the user
    const rifts = await prisma.riftTransaction.findMany({
      where: {
        OR: [
          { buyerId: userId },
          { sellerId: userId },
        ],
      },
      include: {
        buyer: {
          select: {
            name: true,
            email: true,
          },
        },
        seller: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Convert to CSV
    const headers = [
      'Rift Number',
      'Item Title',
      'Item Type',
      'Amount',
      'Currency',
      'Status',
      'Role',
      'Other Party',
      'Created At',
      'Updated At',
    ]

    const rows = rifts.map(rift => {
      const isBuyer = rift.buyerId === userId
      const role = isBuyer ? 'Buyer' : 'Seller'
      const otherParty = isBuyer ? rift.seller : rift.buyer
      const otherPartyName = otherParty.name || otherParty.email

      return [
        rift.riftNumber?.toString() || '',
        escapeCSV(rift.itemTitle),
        rift.itemType,
        (rift.subtotal || rift.amount || 0).toString(),
        rift.currency,
        rift.status,
        role,
        escapeCSV(otherPartyName),
        rift.createdAt.toISOString(),
        rift.updatedAt.toISOString(),
      ]
    })

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n')

    // Return CSV file
    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="rifts-export-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  } catch (error: any) {
    console.error('Export rifts error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

