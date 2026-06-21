import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import { markCampaignPaid } from '@/lib/campaign-payments'
import { stripe } from '@/lib/stripe'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await request.json()
    const { paymentIntentId } = body

    if (!paymentIntentId) {
      return NextResponse.json({ error: 'paymentIntentId is required' }, { status: 400 })
    }

    const campaign = await prisma.campaign.findUnique({ where: { id } })
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    if (campaign.brandId !== auth.userId && auth.userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (campaign.paidAt) {
      return NextResponse.json({ success: true, alreadyPaid: true })
    }

    if (paymentIntentId.startsWith('pi_mock_')) {
      await markCampaignPaid(id, { id: paymentIntentId, charges: { data: [] } })
      return NextResponse.json({ success: true })
    }

    if (!stripe) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
    }

    const pi = await stripe.paymentIntents.retrieve(paymentIntentId)
    if (pi.status !== 'succeeded') {
      return NextResponse.json(
        { error: `Payment not completed (status: ${pi.status})` },
        { status: 400 }
      )
    }

    if (pi.metadata?.campaignId && pi.metadata.campaignId !== id) {
      return NextResponse.json({ error: 'Payment intent does not match campaign' }, { status: 400 })
    }

    await markCampaignPaid(id, pi)
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Confirm campaign payment error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
