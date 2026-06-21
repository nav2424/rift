import { prisma } from './prisma'
import { createCampaignPaymentIntent } from './stripe'

export async function createCampaignPayment(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      brand: { select: { email: true } },
    },
  })

  if (!campaign) {
    throw new Error('Campaign not found')
  }

  if (campaign.paidAt) {
    throw new Error('Campaign is already paid')
  }

  if (campaign.stripePaymentIntentId) {
    const { stripe } = await import('./stripe')
    if (stripe) {
      const existing = await stripe.paymentIntents.retrieve(campaign.stripePaymentIntentId)
      if (existing.client_secret) {
        return {
          clientSecret: existing.client_secret,
          paymentIntentId: existing.id,
        }
      }
    }
  }

  const result = await createCampaignPaymentIntent({
    budget: campaign.budget,
    currency: campaign.currency,
    campaignId: campaign.id,
    brandEmail: campaign.brand.email,
  })

  if (!result) {
    throw new Error('Failed to create payment intent')
  }

  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      stripePaymentIntentId: result.paymentIntentId,
      status: 'AWAITING_PAYMENT',
    },
  })

  return result
}

export async function markCampaignPaid(campaignId: string, paymentIntent: { id: string; charges?: { data?: Array<{ id: string }> } }) {
  const charges = paymentIntent.charges?.data || []
  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      stripePaymentIntentId: paymentIntent.id,
      stripeChargeId: charges[0]?.id || null,
      paidAt: new Date(),
      status: 'UNDER_REVIEW',
    },
  })

  const { completeCampaignMilestone } = await import('./campaigns')
  await completeCampaignMilestone(campaignId, 'brief_submitted', prisma)
}
