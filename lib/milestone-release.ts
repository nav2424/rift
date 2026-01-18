import { prisma } from '@/lib/prisma'
import { calculateSellerFee, calculateSellerNet, roundCurrency } from '@/lib/fees'
import { createRiftTransfer } from '@/lib/stripe'
import { creditSellerOnRelease } from '@/lib/wallet'
import { logEvent } from '@/lib/rift-events'
import { RiftEventActorType } from '@prisma/client'
import { acquireMilestoneReleaseLock, completeReleaseLock, releaseFailedLock } from '@/lib/release-concurrency'
import { normalizeMilestones, getLatestReleasedAt } from '@/lib/milestone-utils'

type ReleaseOptions = {
  riftId: string
  milestoneIndex: number
  releasedById: string | null
  actorType: RiftEventActorType
  requestMeta?: Record<string, unknown>
  allowedStatuses: Array<'FUNDED' | 'PROOF_SUBMITTED' | 'UNDER_REVIEW'>
  requireBuyer?: boolean
  requireProofAfterLastRelease?: boolean
  allowPendingProof?: boolean
  autoRelease?: boolean
}

export async function releaseMilestone(options: ReleaseOptions) {
  const {
    riftId,
    milestoneIndex,
    releasedById,
    actorType,
    requestMeta,
    allowedStatuses,
    requireBuyer = false,
    requireProofAfterLastRelease = false,
    allowPendingProof = true,
    autoRelease = false,
  } = options

  const rift = await prisma.riftTransaction.findUnique({
    where: { id: riftId },
    include: {
      seller: {
        select: {
          id: true,
          stripeConnectAccountId: true,
        },
      },
      MilestoneRelease: true,
    },
  })

  if (!rift) {
    throw new Error('Rift not found')
  }

  if (requireBuyer && rift.buyerId !== releasedById) {
    throw new Error('Only buyer can release milestone funds')
  }

  if (!allowedStatuses.includes(rift.status as any)) {
    throw new Error(`Cannot release milestone funds. Rift status is ${rift.status}`)
  }

  if (rift.itemType !== 'SERVICES' || !rift.allowsPartialRelease) {
    throw new Error('This rift does not support milestone-based releases')
  }

  const milestones = normalizeMilestones(rift.milestones)
  if (!milestones || milestones.length === 0) {
    throw new Error('No milestones found for this rift')
  }

  if (milestoneIndex < 0 || milestoneIndex >= milestones.length) {
    throw new Error(`Milestone index ${milestoneIndex} is out of range`)
  }

  const milestone = milestones[milestoneIndex]

  // Check dispute freeze before releasing
  const { checkDisputeFreeze } = await import('@/lib/dispute-freeze')
  const freezeCheck = await checkDisputeFreeze(riftId)
  if (freezeCheck.frozen) {
    throw new Error(`Cannot release funds: ${freezeCheck.reason}`)
  }

  // Check if this milestone has already been released
  const existingRelease = rift.MilestoneRelease.find(
    (r) => r.milestoneIndex === milestoneIndex && r.status === 'RELEASED'
  )
  if (existingRelease) {
    return {
      alreadyReleased: true,
      milestoneReleaseId: existingRelease.id,
      allMilestonesReleased: rift.MilestoneRelease.filter((r) => r.status === 'RELEASED').length >= milestones.length,
    }
  }

  if (requireProofAfterLastRelease) {
    const lastReleaseAt = getLatestReleasedAt(rift.MilestoneRelease)
    if (lastReleaseAt) {
      const proofAfterLastRelease = await prisma.proof.findFirst({
        where: {
          riftId,
          status: { in: allowPendingProof ? ['VALID', 'PENDING'] : ['VALID'] },
          submittedAt: {
            gt: lastReleaseAt,
          },
        },
        orderBy: {
          submittedAt: 'desc',
        },
      })

      if (!proofAfterLastRelease) {
        throw new Error('Proof is required again after the previous milestone was released.')
      }
    }
  }

  const lock = await acquireMilestoneReleaseLock(riftId, milestoneIndex)
  if (!lock) {
    throw new Error('Failed to acquire release lock')
  }

  if (lock.status === 'CREATED') {
    return {
      alreadyReleased: true,
      milestoneReleaseId: lock.releaseId,
      allMilestonesReleased: false,
    }
  }

  const milestoneAmount = milestone.amount
  const sellerFee = calculateSellerFee(milestoneAmount)
  const sellerNet = calculateSellerNet(milestoneAmount)

  let milestoneSellerPayout: number = sellerNet
  let stripeTransferId: string | null = null

  if (rift.stripePaymentIntentId && rift.subtotal && rift.subtotal > 0) {
    try {
      const { stripe } = await import('@/lib/stripe')
      if (stripe) {
        const paymentIntent = await stripe.paymentIntents.retrieve(rift.stripePaymentIntentId)
        const totalSellerPayout = parseFloat(paymentIntent.metadata?.sellerPayout || '0')
        const milestoneRatio = milestoneAmount / rift.subtotal
        milestoneSellerPayout = roundCurrency(totalSellerPayout * milestoneRatio)
      }
    } catch (error) {
      console.error(`Error retrieving PaymentIntent for milestone ${milestoneIndex} of rift ${riftId}:`, error)
    }
  }

  const milestoneRelease = await prisma.milestoneRelease.update({
    where: { id: lock.releaseId },
    data: {
      milestoneTitle: milestone.title,
      milestoneAmount: roundCurrency(milestoneAmount),
      releasedAmount: roundCurrency(milestoneAmount),
      sellerFee: roundCurrency(sellerFee),
      sellerNet: roundCurrency(sellerNet),
      releasedBy: releasedById || 'system',
      status: 'CREATING',
    },
  })

  if (milestoneSellerPayout > 0 && rift.seller.stripeConnectAccountId) {
    try {
      stripeTransferId = await createRiftTransfer(
        milestoneSellerPayout,
        rift.currency,
        rift.seller.stripeConnectAccountId,
        riftId,
        milestoneRelease.id,
        null
      )

      if (stripeTransferId) {
        await completeReleaseLock(lock, stripeTransferId, {
          milestoneTitle: milestone.title,
          milestoneAmount: roundCurrency(milestoneAmount),
          releasedAmount: roundCurrency(milestoneAmount),
          sellerFee: roundCurrency(sellerFee),
          sellerNet: roundCurrency(sellerNet),
          releasedBy: releasedById || 'system',
        })
      } else {
        await prisma.milestoneRelease.update({
          where: { id: milestoneRelease.id },
          data: { status: 'RELEASED' },
        })
      }
    } catch (error: any) {
      console.error(`Error creating Stripe transfer for milestone ${milestoneIndex} of rift ${riftId}:`, error)
      await releaseFailedLock(lock)

      if (error.message?.includes('Insufficient Stripe balance')) {
        throw new Error(`Cannot release funds: ${error.message}`)
      }

      await prisma.milestoneRelease.update({
        where: { id: milestoneRelease.id },
        data: { status: 'RELEASED' },
      })
    }
  } else {
    await prisma.milestoneRelease.update({
      where: { id: milestoneRelease.id },
      data: {
        status: 'RELEASED',
        payoutId: stripeTransferId,
      },
    })
  }

  if (stripeTransferId && !milestoneRelease.payoutId) {
    await prisma.milestoneRelease.update({
      where: { id: milestoneRelease.id },
      data: { payoutId: stripeTransferId },
    })
  }

  await creditSellerOnRelease(
    riftId,
    rift.sellerId,
    sellerNet,
    rift.currency,
    {
      riftNumber: rift.riftNumber,
      itemTitle: `${rift.itemTitle} - Milestone: ${milestone.title}`,
      milestoneIndex,
    }
  )

  await logEvent(
    riftId,
    actorType,
    releasedById,
    autoRelease ? 'MILESTONE_AUTO_RELEASED' : 'MILESTONE_RELEASED',
    {
      milestoneIndex,
      milestoneTitle: milestone.title,
      milestoneAmount,
      sellerFee,
      sellerNet,
      stripeTransferId,
      autoRelease,
    },
    requestMeta
  )

  await prisma.timelineEvent.create({
    data: {
      id: crypto.randomUUID(),
      escrowId: riftId,
      type: autoRelease ? 'MILESTONE_AUTO_RELEASED' : 'MILESTONE_RELEASED',
      message: autoRelease
        ? `Milestone "${milestone.title}" auto-released after the review window. Amount: ${rift.currency} ${milestoneAmount.toFixed(2)}`
        : `Milestone "${milestone.title}" released. Amount: ${rift.currency} ${milestoneAmount.toFixed(2)}`,
      createdById: releasedById,
    },
  })

  const releasedCount = await prisma.milestoneRelease.count({
    where: {
      riftId,
      status: 'RELEASED',
    },
  })
  const allMilestonesReleased = releasedCount >= milestones.length

  if (milestoneIndex === 0 && !allMilestonesReleased) {
    await prisma.riftTransaction.update({
      where: { id: riftId },
      data: {
        status: 'FUNDED',
        proofSubmittedAt: null,
        autoReleaseScheduled: false,
        autoReleaseAt: null,
      },
    })

    await prisma.timelineEvent.create({
      data: {
        id: crypto.randomUUID(),
        escrowId: riftId,
        type: 'PROOF_REQUIRED_AGAIN',
        message: `First milestone "${milestone.title}" released. Creator must submit proof again for remaining milestones.`,
        createdById: releasedById,
      },
    })
  } else {
    await prisma.riftTransaction.update({
      where: { id: riftId },
      data: {
        autoReleaseScheduled: false,
        autoReleaseAt: null,
      },
    })
  }

  if (allMilestonesReleased) {
    await prisma.riftTransaction.update({
      where: { id: riftId },
      data: {
        status: 'RELEASED',
        releasedAt: new Date(),
      },
    })

    await prisma.timelineEvent.create({
      data: {
        id: crypto.randomUUID(),
        escrowId: riftId,
        type: 'FUNDS_RELEASED',
        message: 'All milestones completed. Full payment released.',
        createdById: releasedById,
      },
    })
  }

  return {
    milestoneReleaseId: milestoneRelease.id,
    allMilestonesReleased,
    milestoneTitle: milestone.title,
    milestoneAmount,
    sellerNet,
  }
}
