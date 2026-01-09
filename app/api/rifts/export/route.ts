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

    // Get all rifts for the user - try Prisma first, fallback to raw SQL if enum validation fails
    let rifts: any[]
    try {
      rifts = await prisma.riftTransaction.findMany({
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
    } catch (error: any) {
      // If Prisma fails due to enum deserialization or missing columns (migration not applied), use raw SQL
      if (error?.message?.includes('not found in enum') || 
          error?.message?.includes('ItemType') ||
          error?.code === 'P2022' || // Column doesn't exist
          error?.message?.includes('does not exist in the current database')) {
        console.warn('Prisma enum deserialization failed in export route, using raw SQL:', error.message)
        
        // Map old enum values to new ones
        const mapItemType = (itemType: string): string => {
          if (itemType === 'LICENSE_KEYS' || itemType === 'DIGITAL') return 'DIGITAL_GOODS'
          if (itemType === 'TICKETS') return 'OWNERSHIP_TRANSFER'
          return itemType
        }
        
        // Fetch rifts using raw SQL with text casting
        const fetchedRifts = await prisma.$queryRawUnsafe<any[]>(`
          SELECT 
            id, "riftNumber", "itemTitle", "itemDescription", 
            "itemType"::text as "itemType", amount, subtotal, currency,
            status::text as status, "buyerId", "sellerId", "createdAt", "updatedAt"
          FROM "EscrowTransaction"
          WHERE ("buyerId" = $1 OR "sellerId" = $2)
          ORDER BY "createdAt" DESC
        `, userId, userId)
        
        // Fetch buyer and seller info separately
        const allRiftIds = fetchedRifts.map(r => r.id)
        const allUserIds = [...new Set([...fetchedRifts.map(r => r.buyerId), ...fetchedRifts.map(r => r.sellerId)])]
        
        const users = await prisma.user.findMany({
          where: { id: { in: allUserIds } },
          select: { id: true, name: true, email: true },
        })
        
        const userMap = new Map(users.map(u => [u.id, u]))
        
        // Map the results to match Prisma format
        rifts = fetchedRifts.map(rift => ({
          ...rift,
          itemType: mapItemType(rift.itemType),
          buyer: userMap.get(rift.buyerId) || { id: rift.buyerId, name: null, email: null },
          seller: userMap.get(rift.sellerId) || { id: rift.sellerId, name: null, email: null },
        }))
      } else {
        // Re-throw if it's not an enum error
        throw error
      }
    }

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

