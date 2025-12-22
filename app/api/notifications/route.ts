import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'

/**
 * Get user notifications (recent activities, especially Stripe status changes)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')
    const type = searchParams.get('type') // Optional filter by type

    // Get recent activities for the user
    // We'll filter for Stripe status changes in the processing step
    const activities = await prisma.activity.findMany({
      where: {
        userId: auth.userId,
        ...(type ? { type } : {}),
        // Get all activities, we'll filter for Stripe notifications by metadata
        type: 'PAYMENT_RECEIVED', // This type is used for Stripe status changes
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit * 2, // Get more to filter down to Stripe notifications
    })

    // Parse metadata and format notifications
    // Filter for Stripe status changes specifically
    const notifications = activities
      .map((activity: any) => {
        let metadata = {}
        try {
          metadata = activity.metadata ? JSON.parse(activity.metadata) : {}
        } catch (e) {
          // Invalid JSON, ignore
        }

        const isStripeStatusChange = metadata.type === 'stripe_status_change'
        
        return {
          id: activity.id,
          type: activity.type,
          summary: activity.summary,
          amount: activity.amount,
          metadata,
          createdAt: activity.createdAt,
          isStripeStatusChange,
          stripeStatus: metadata.status,
        }
      })
      .filter(n => n.isStripeStatusChange) // Only return Stripe status notifications
      .slice(0, limit) // Limit to requested amount

    // Get unread count (Stripe status notifications from last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const allRecentActivities = await prisma.activity.findMany({
      where: {
        userId: auth.userId,
        createdAt: { gte: sevenDaysAgo },
        type: 'PAYMENT_RECEIVED',
      },
      select: {
        metadata: true,
      },
    })

    // Count only Stripe status change notifications
    const recentCount = allRecentActivities.filter((activity: any) => {
      try {
        const metadata = activity.metadata ? JSON.parse(activity.metadata) : {}
        return metadata.type === 'stripe_status_change'
      } catch {
        return false
      }
    }).length

    return NextResponse.json({
      notifications,
      unreadCount: recentCount,
      total: notifications.length,
    })
  } catch (error: any) {
    console.error('Get notifications error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
