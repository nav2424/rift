/**
 * Risk tier calculation and payout delay logic
 */

import { prisma } from './prisma'
import { RiskTier } from '@prisma/client'

/**
 * Calculate risk tier for a seller
 */
export async function calculateRiskTier(userId: string): Promise<RiskTier> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      createdAt: true,
      idVerified: true,
      emailVerified: true,
      phoneVerified: true,
    },
  })

  if (!user) {
    return RiskTier.TIER0_NEW
  }

  // Get or create risk profile
  let riskProfile = await prisma.userRiskProfile.findUnique({
    where: { userId },
  })

  if (!riskProfile) {
    riskProfile = await prisma.userRiskProfile.create({
      data: {
        userId,
        tier: RiskTier.TIER0_NEW,
        completedRifts: 0,
        accountAgeDays: 0,
        chargebacksLast60Days: 0,
        disputesLast60Days: 0,
        totalVolume: 0,
      },
    })
  }

  // Check for Tier 3 (manual approval)
  if (riskProfile.tier3Approved) {
    return RiskTier.TIER3_PRO
  }

  // Calculate account age
  const accountAgeMs = Date.now() - user.createdAt.getTime()
  const accountAgeDays = Math.floor(accountAgeMs / (1000 * 60 * 60 * 24))

  // Get completed transactions
  const completedRifts = await prisma.riftTransaction.count({
    where: {
      sellerId: userId,
      status: {
        in: ['RELEASED', 'PAID_OUT'],
      },
    },
  })

  // Get chargebacks and disputes in last 60 days
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
  
  const recentChargebacks = await prisma.walletLedgerEntry.count({
    where: {
      walletAccount: { userId },
      type: 'DEBIT_CHARGEBACK',
      createdAt: { gte: sixtyDaysAgo },
    },
  })

  const recentDisputes = await prisma.dispute.count({
    where: {
      rift: { sellerId: userId },
      createdAt: { gte: sixtyDaysAgo },
      status: 'OPEN',
    },
  })

  // Update risk profile
  await prisma.userRiskProfile.update({
    where: { userId },
    data: {
      completedRifts,
      accountAgeDays,
      chargebacksLast60Days: recentChargebacks,
      disputesLast60Days: recentDisputes,
    },
  })

  // Determine tier
  const isVerified = user.idVerified && user.emailVerified && user.phoneVerified

  // Tier 0: <2 completed rifts OR account age < 7 days OR not verified
  if (completedRifts < 2 || accountAgeDays < 7 || !isVerified) {
    await prisma.userRiskProfile.update({
      where: { userId },
      data: { tier: RiskTier.TIER0_NEW },
    })
    return RiskTier.TIER0_NEW
  }

  // Tier 2: verified + >=10 completed + account age >=30 days + 0 chargebacks/disputes in last 60 days
  if (
    isVerified &&
    completedRifts >= 10 &&
    accountAgeDays >= 30 &&
    recentChargebacks === 0 &&
    recentDisputes === 0
  ) {
    await prisma.userRiskProfile.update({
      where: { userId },
      data: { tier: RiskTier.TIER2_TRUSTED },
    })
    return RiskTier.TIER2_TRUSTED
  }

  // Tier 1: verified + >=2 completed (default for verified sellers)
  if (isVerified && completedRifts >= 2) {
    await prisma.userRiskProfile.update({
      where: { userId },
      data: { tier: RiskTier.TIER1_NORMAL },
    })
    return RiskTier.TIER1_NORMAL
  }

  // Default to Tier 0
  await prisma.userRiskProfile.update({
    where: { userId },
    data: { tier: RiskTier.TIER0_NEW },
  })
  return RiskTier.TIER0_NEW
}

/**
 * Get payout delay in business days based on risk tier and category
 */
export function getPayoutDelayBusinessDays(
  tier: RiskTier,
  itemType: string,
  isInstantPayout: boolean = false
): number {
  // Tier 3 with instant payout option
  if (tier === RiskTier.TIER3_PRO && isInstantPayout) {
    return 0 // Same day
  }

  // High-risk categories (tickets, digital keys, high-value electronics)
  const highRiskCategories = ['TICKETS', 'DIGITAL']
  const isHighRiskCategory = highRiskCategories.includes(itemType)

  // High-risk categories have minimum 3 business days unless Tier 3 + instant
  if (isHighRiskCategory && tier !== RiskTier.TIER3_PRO) {
    return 3
  }

  // Standard delays by tier
  switch (tier) {
    case RiskTier.TIER0_NEW:
      return 5
    case RiskTier.TIER1_NORMAL:
      return 3
    case RiskTier.TIER2_TRUSTED:
      return 1
    case RiskTier.TIER3_PRO:
      return 1
    default:
      return 5
  }
}

/**
 * Calculate business days from a date
 */
export function addBusinessDays(startDate: Date, businessDays: number): Date {
  const result = new Date(startDate)
  let daysToAdd = businessDays

  while (daysToAdd > 0) {
    result.setDate(result.getDate() + 1)
    // Skip weekends (Saturday = 6, Sunday = 0)
    if (result.getDay() !== 0 && result.getDay() !== 6) {
      daysToAdd--
    }
  }

  return result
}

/**
 * Schedule payout for a seller after release
 */
export async function schedulePayout(
  riftId: string,
  sellerId: string,
  amount: number,
  currency: string = 'CAD'
): Promise<string> {
  const tier = await calculateRiskTier(sellerId)
  const rift = await prisma.riftTransaction.findUnique({
    where: { id: riftId },
    select: { itemType: true, releasedAt: true },
  })

  if (!rift || !rift.releasedAt) {
    throw new Error('Rift not found or not released')
  }

  const delayDays = getPayoutDelayBusinessDays(tier, rift.itemType)
  const scheduledAt = addBusinessDays(rift.releasedAt, delayDays)

  const payout = await prisma.payout.create({
    data: {
      userId: sellerId,
      riftId,
      amount,
      currency,
      status: 'PENDING',
      scheduledAt,
    },
  })

  return payout.id
}
