import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireAdmin } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/admin/payouts
 * Get comprehensive payout tracking data for admins
 * Returns users with pending payouts, amounts, scheduled dates, etc.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') // PENDING, PROCESSING, COMPLETED, FAILED
    const userId = searchParams.get('userId') // Filter by specific user

    // Build where clause
    const where: any = {}
    if (status) {
      where.status = status
    }
    if (userId) {
      where.userId = userId
    }

    // Get all payouts with user and rift information
    // Use try-catch to handle enum deserialization errors for old itemType values
    let payouts: any[]
    try {
      payouts = await prisma.payout.findMany({
        where,
        include: {
          User: {
            select: {
              id: true,
              name: true,
              email: true,
              riftUserId: true,
              stripeConnectAccountId: true,
            },
          },
          RiftTransaction: {
            select: {
              id: true,
              riftNumber: true,
              itemTitle: true,
              itemType: true,
            },
          },
        },
        orderBy: [
          { scheduledAt: 'asc' },
          { createdAt: 'desc' },
        ],
      })
    } catch (error: any) {
      // Handle enum deserialization errors (e.g., LICENSE_KEYS, DIGITAL, TICKETS)
      const isEnumError = error?.message?.includes('not found in enum') ||
                          error?.message?.includes('ItemType') ||
                          error?.message?.includes("Value 'LICENSE_KEYS'") ||
                          error?.message?.includes("Value 'DIGITAL'") ||
                          error?.message?.includes("Value 'TICKETS'")
      
      if (isEnumError) {
        // Use raw SQL with text casting to avoid enum validation
        const whereConditions: Prisma.Sql[] = []

        if (where.status) {
          whereConditions.push(Prisma.sql`p.status = ${where.status}`)
        }
        if (where.userId) {
          whereConditions.push(Prisma.sql`p."userId" = ${where.userId}`)
        }

        const whereClauseSql = whereConditions.length > 0 
          ? Prisma.sql`WHERE ${Prisma.join(whereConditions, ' AND ')}`
          : Prisma.empty

        const fetchedPayouts = await prisma.$queryRaw<any[]>(
          Prisma.sql`SELECT 
            p.id, p."userId", p."riftId", p.amount, p.currency, p.status,
            p."scheduledAt", p."processedAt", p."createdAt", p."stripePayoutId",
            p."stripeTransferId", p."failureReason",
            u.id as "user_id", u.name as "user_name", u.email as "user_email",
            u."riftUserId" as "user_riftUserId", u."stripeConnectAccountId" as "user_stripeConnectAccountId",
            r.id as "rift_id", r."riftNumber" as "rift_riftNumber", 
            r."itemTitle" as "rift_itemTitle", r."itemType"::text as "rift_itemType"
          FROM "Payout" p
          LEFT JOIN "User" u ON p."userId" = u.id
          LEFT JOIN "EscrowTransaction" r ON p."riftId" = r.id
          ${whereClauseSql}
          ORDER BY p."scheduledAt" ASC NULLS LAST, p."createdAt" DESC
        `)

        // Map raw SQL results to match Prisma structure
        payouts = fetchedPayouts.map(p => ({
          id: p.id,
          userId: p.userId,
          riftId: p.riftId,
          amount: parseFloat(p.amount),
          currency: p.currency,
          status: p.status,
          scheduledAt: p.scheduledAt,
          processedAt: p.processedAt,
          createdAt: p.createdAt,
          stripePayoutId: p.stripePayoutId,
          stripeTransferId: p.stripeTransferId,
          failureReason: p.failureReason,
          User: p.user_id ? {
            id: p.user_id,
            name: p.user_name,
            email: p.user_email,
            riftUserId: p.user_riftUserId,
            stripeConnectAccountId: p.user_stripeConnectAccountId,
          } : null,
          RiftTransaction: p.rift_id ? {
            id: p.rift_id,
            riftNumber: p.rift_riftNumber ? parseInt(p.rift_riftNumber) : null,
            itemTitle: p.rift_itemTitle,
            itemType: p.rift_itemType,
          } : null,
        }))
      } else {
        throw error
      }
    }

    // Get wallet balances for users with payouts
    const userIds = [...new Set(payouts.map(p => p.userId))]
    const walletAccounts = await prisma.walletAccount.findMany({
      where: {
        userId: { in: userIds },
      },
      select: {
        userId: true,
        availableBalance: true,
        pendingBalance: true,
        currency: true,
      },
    })

    const walletMap = new Map(walletAccounts.map(w => [w.userId, w]))

    // Aggregate payouts by user
    const userPayoutMap = new Map<string, {
      userId: string
      userName: string | null
      userEmail: string
      riftUserId: string | null
      stripeConnectAccountId: string | null
      walletBalance: number
      pendingBalance: number
      currency: string
      totalPending: number
      totalProcessing: number
      totalCompleted: number
      totalFailed: number
      nextScheduledDate: Date | null
      payouts: Array<{
        id: string
        amount: number
        currency: string
        status: string
        scheduledAt: Date | null
        processedAt: Date | null
        createdAt: Date
        riftNumber: number | null
        itemTitle: string | null
        riftId: string | null
      }>
    }>()

    for (const payout of payouts) {
      const userId = payout.userId
      const wallet = walletMap.get(userId)

      if (!userPayoutMap.has(userId)) {
        userPayoutMap.set(userId, {
          userId,
          userName: payout.User.name,
          userEmail: payout.User.email,
          riftUserId: payout.User.riftUserId,
          stripeConnectAccountId: payout.User.stripeConnectAccountId,
          walletBalance: wallet?.availableBalance || 0,
          pendingBalance: wallet?.pendingBalance || 0,
          currency: wallet?.currency || payout.currency,
          totalPending: 0,
          totalProcessing: 0,
          totalCompleted: 0,
          totalFailed: 0,
          nextScheduledDate: null,
          payouts: [],
        })
      }

      const userData = userPayoutMap.get(userId)!

      // Aggregate by status
      if (payout.status === 'PENDING') {
        userData.totalPending += payout.amount
      } else if (payout.status === 'PROCESSING') {
        userData.totalProcessing += payout.amount
      } else if (payout.status === 'COMPLETED') {
        userData.totalCompleted += payout.amount
      } else if (payout.status === 'FAILED') {
        userData.totalFailed += payout.amount
      }

      // Track next scheduled date
      if (payout.scheduledAt && (payout.status === 'PENDING' || payout.status === 'PROCESSING')) {
        if (!userData.nextScheduledDate || payout.scheduledAt < userData.nextScheduledDate) {
          userData.nextScheduledDate = payout.scheduledAt
        }
      }

      // Add payout detail
      userData.payouts.push({
        id: payout.id,
        amount: payout.amount,
        currency: payout.currency,
        status: payout.status,
        scheduledAt: payout.scheduledAt,
        processedAt: payout.processedAt,
        createdAt: payout.createdAt,
        riftNumber: payout.RiftTransaction?.riftNumber || null,
        itemTitle: payout.RiftTransaction?.itemTitle || null,
        riftId: payout.riftId || null,
      })
    }

    // Convert map to array and calculate totals
    const userSummaries = Array.from(userPayoutMap.values()).map(user => ({
      ...user,
      totalOwed: user.totalPending + user.totalProcessing,
      totalAllTime: user.totalPending + user.totalProcessing + user.totalCompleted + user.totalFailed,
    }))

    // Calculate global statistics
    const stats = {
      totalUsers: userSummaries.length,
      totalPending: userSummaries.reduce((sum, u) => sum + u.totalPending, 0),
      totalProcessing: userSummaries.reduce((sum, u) => sum + u.totalProcessing, 0),
      totalCompleted: userSummaries.reduce((sum, u) => sum + u.totalCompleted, 0),
      totalFailed: userSummaries.reduce((sum, u) => sum + u.totalFailed, 0),
      totalOwed: userSummaries.reduce((sum, u) => sum + u.totalOwed, 0),
    }

    return NextResponse.json({
      users: userSummaries,
      stats,
      payouts: payouts.map(p => ({
        id: p.id,
        userId: p.userId,
        userName: p.User.name,
        userEmail: p.User.email,
        riftUserId: p.User.riftUserId,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        scheduledAt: p.scheduledAt,
        processedAt: p.processedAt,
        createdAt: p.createdAt,
        stripePayoutId: p.stripePayoutId,
        stripeTransferId: p.stripeTransferId,
        failureReason: p.failureReason,
        riftId: p.riftId,
        riftNumber: p.RiftTransaction?.riftNumber || null,
        itemTitle: p.RiftTransaction?.itemTitle || null,
        itemType: p.RiftTransaction?.itemType || null,
        riftRiftId: p.RiftTransaction?.id || null,
      })),
    })
  } catch (error: any) {
    console.error('Admin payouts error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.statusCode || 500 }
    )
  }
}
