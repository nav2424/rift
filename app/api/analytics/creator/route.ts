import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Get all rifts where this user is the seller (creator)
    const deals = await prisma.riftTransaction.findMany({
      where: { sellerId: auth.userId },
      select: {
        id: true, riftNumber: true, itemTitle: true, subtotal: true,
        sellerFee: true, sellerNet: true, currency: true, status: true, createdAt: true,
        buyer: { select: { id: true, name: true } },
        DealAnalytics: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    // Aggregate
    const totalEarnings = deals.reduce((sum, d) => sum + (d.sellerNet || 0), 0)
    const completedDeals = deals.filter(d => d.status === 'RELEASED' || d.status === 'PAID_OUT')
    const activeDeals = deals.filter(d => !['RELEASED','PAID_OUT','CANCELED','REFUNDED'].includes(d.status))
    const avgDealSize = completedDeals.length > 0 ? completedDeals.reduce((s, d) => s + (d.subtotal || 0), 0) / completedDeals.length : 0

    // Per-brand breakdown
    const brandMap = new Map<string, { name: string; totalEarnings: number; dealCount: number; deals: any[] }>()
    for (const deal of deals) {
      const bid = deal.buyer.id
      if (!brandMap.has(bid)) {
        brandMap.set(bid, { name: deal.buyer.name || 'Unknown', totalEarnings: 0, dealCount: 0, deals: [] })
      }
      const entry = brandMap.get(bid)!
      entry.totalEarnings += (deal.sellerNet || 0)
      entry.dealCount++
      entry.deals.push({ id: deal.id, title: deal.itemTitle, amount: deal.subtotal, net: deal.sellerNet, status: deal.status, date: deal.createdAt })
    }

    return NextResponse.json({
      summary: { totalEarnings, totalDeals: deals.length, completedDeals: completedDeals.length, activeDeals: activeDeals.length, avgDealSize },
      brands: Array.from(brandMap.entries()).map(([id, data]) => ({ id, ...data })).sort((a, b) => b.totalEarnings - a.totalEarnings),
      deals: deals.map(d => ({ id: d.id, riftNumber: d.riftNumber, title: d.itemTitle, amount: d.subtotal, fee: d.sellerFee, net: d.sellerNet, status: d.status, buyer: d.buyer, date: d.createdAt })),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
