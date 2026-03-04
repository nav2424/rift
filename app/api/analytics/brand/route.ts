import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Get all rifts where this user is the buyer (brand)
    const deals = await prisma.riftTransaction.findMany({
      where: { buyerId: auth.userId },
      select: {
        id: true, riftNumber: true, itemTitle: true, subtotal: true,
        buyerFee: true, currency: true, status: true, createdAt: true,
        seller: { select: { id: true, name: true } },
        DealAnalytics: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    // Aggregate
    const totalSpend = deals.reduce((sum, d) => sum + (d.subtotal || 0) + (d.buyerFee || 0), 0)
    const completedDeals = deals.filter(d => d.status === 'RELEASED' || d.status === 'PAID_OUT')
    const activeDeals = deals.filter(d => !['RELEASED','PAID_OUT','CANCELED','REFUNDED'].includes(d.status))
    const avgDealSize = completedDeals.length > 0 ? completedDeals.reduce((s, d) => s + (d.subtotal || 0), 0) / completedDeals.length : 0

    // Per-influencer breakdown
    const influencerMap = new Map<string, { name: string; totalSpend: number; dealCount: number; deals: any[] }>()
    for (const deal of deals) {
      const sid = deal.seller.id
      if (!influencerMap.has(sid)) {
        influencerMap.set(sid, { name: deal.seller.name || 'Unknown', totalSpend: 0, dealCount: 0, deals: [] })
      }
      const entry = influencerMap.get(sid)!
      entry.totalSpend += (deal.subtotal || 0) + (deal.buyerFee || 0)
      entry.dealCount++
      entry.deals.push({ id: deal.id, title: deal.itemTitle, amount: deal.subtotal, status: deal.status, date: deal.createdAt })
    }

    return NextResponse.json({
      summary: { totalSpend, totalDeals: deals.length, completedDeals: completedDeals.length, activeDeals: activeDeals.length, avgDealSize },
      influencers: Array.from(influencerMap.entries()).map(([id, data]) => ({ id, ...data })).sort((a, b) => b.totalSpend - a.totalSpend),
      deals: deals.map(d => ({ id: d.id, riftNumber: d.riftNumber, title: d.itemTitle, amount: d.subtotal, fee: d.buyerFee, status: d.status, seller: d.seller, date: d.createdAt })),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
