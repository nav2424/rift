import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { calculateSellerFee, calculateSellerNet, roundCurrency } from '@/lib/fees'
import { createRiftTransfer } from '@/lib/stripe'
import { creditSellerOnRelease } from '@/lib/wallet'
import { logEvent, extractRequestMetadata } from '@/lib/rift-events'
import { RiftEventActorType } from '@prisma/client'

/**
 * Release ALL remaining milestone funds at once
 * Only buyers can release milestone funds
 * This is the "supreme button" - works unconditionally (only requires rift to be FUNDED)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Get rift with milestones
    const rift = await prisma.riftTransaction.findUnique({
      where: { id },
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
      return NextResponse.json(
        { error: 'Rift not found' },
        { status: 404 }
      )
    }

    // Verify buyer
    if (rift.buyerId !== auth.userId) {
      return NextResponse.json(
        { error: 'Only buyer can release milestone funds' },
        { status: 403 }
      )
    }

    // Verify this is a service rift with partial release enabled
    if (rift.itemType !== 'SERVICES' || !rift.allowsPartialRelease) {
      return NextResponse.json(
        { error: 'This rift does not support milestone-based releases' },
        { status: 400 }
      )
    }

    // Verify rift is funded - this is the only requirement (supreme button)
    if (rift.status !== 'FUNDED' && rift.status !== 'PROOF_SUBMITTED' && rift.status !== 'UNDER_REVIEW') {
      return NextResponse.json(
        { error: `Cannot release milestone funds. Rift must be funded. Current status: ${rift.status}` },
        { status: 400 }
      )
    }

    // Parse milestones
    const milestones = rift.milestones as Array<{
      title: string
      description?: string
      amount: number
      dueDate: string
    }> | null

    if (!milestones || !Array.isArray(milestones) || milestones.length === 0) {
      return NextResponse.json(
        { error: 'No milestones found for this rift' },
        { status: 400 }
      )
    }

    // Check dispute freeze before releasing
    const { checkDisputeFreeze } = await import('@/lib/dispute-freeze')
    const freezeCheck = await checkDisputeFreeze(id)
    
    if (freezeCheck.frozen) {
      return NextResponse.json(
        { error: `Cannot release funds: ${freezeCheck.reason}` },
        { status: 400 }
      )
    }

    // Find all unreleased milestones
    const releasedIndices = new Set(
      rift.MilestoneRelease
        .filter((r) => r.status === 'RELEASED')
        .map((r) => r.milestoneIndex)
    )

    const unreleasedMilestones = milestones
      .map((milestone, index) => ({ milestone, index }))
      .filter(({ index }) => !releasedIndices.has(index))

    if (unreleasedMilestones.length === 0) {
      return NextResponse.json(
        { error: 'All milestones have already been released' },
        { status: 400 }
      )
    }

    const requestMeta = extractRequestMetadata(request)
    const releasedMilestoneData: Array<{
      index: number
      title: string
      amount: number
      sellerNet: number
      stripeTransferId: string | null
    }> = []

    // Release each unreleased milestone
    for (const { milestone, index: milestoneIndex } of unreleasedMilestones) {
      // Acquire concurrency lock for milestone release
      const { acquireMilestoneReleaseLock, completeReleaseLock, releaseFailedLock } = await import('@/lib/release-concurrency')
      const lock = await acquireMilestoneReleaseLock(id, milestoneIndex)
      
      if (!lock) {
        console.error(`Failed to acquire lock for milestone ${milestoneIndex}`)
        continue // Skip this milestone if we can't acquire lock
      }

      // If already released (another request got it), skip
      if (lock.status === 'CREATED') {
        continue
      }

      // Calculate fees for this milestone
      const milestoneAmount = milestone.amount
      const sellerFee = calculateSellerFee(milestoneAmount)
      const sellerNet = calculateSellerNet(milestoneAmount)

      // Get sellerPayout from PaymentIntent metadata (proportional to milestone)
      let milestoneSellerPayout: number = sellerNet
      let stripeTransferId: string | null = null

      if (rift.stripePaymentIntentId && rift.subtotal && rift.subtotal > 0) {
        try {
          const { stripe } = await import('@/lib/stripe')
          if (stripe) {
            const paymentIntent = await stripe.paymentIntents.retrieve(rift.stripePaymentIntentId)
            const totalSellerPayout = parseFloat(paymentIntent.metadata?.sellerPayout || '0')
            
            // Calculate proportional sellerPayout for this milestone
            const milestoneRatio = milestoneAmount / rift.subtotal
            milestoneSellerPayout = roundCurrency(totalSellerPayout * milestoneRatio)
          }
        } catch (error) {
          console.error(`Error retrieving PaymentIntent for milestone ${milestoneIndex} of rift ${id}:`, error)
          // Fall back to calculated sellerNet
        }
      }

      // Update the lock record with actual data
      const milestoneRelease = await prisma.milestoneRelease.update({
        where: { id: lock.releaseId },
        data: {
          milestoneTitle: milestone.title,
          milestoneAmount: roundCurrency(milestoneAmount),
          releasedAmount: roundCurrency(milestoneAmount),
          sellerFee: roundCurrency(sellerFee),
          sellerNet: roundCurrency(sellerNet),
          releasedBy: auth.userId,
          status: 'CREATING', // Will be updated to RELEASED after transfer
        },
      })

      // Create Stripe transfer to seller's connected account (if seller has account)
      if (milestoneSellerPayout > 0 && rift.seller.stripeConnectAccountId) {
        try {
          stripeTransferId = await createRiftTransfer(
            milestoneSellerPayout,
            rift.currency,
            rift.seller.stripeConnectAccountId,
            id,
            milestoneRelease.id,
            null // Don't check existing - lock prevents duplicates
          )
          
          // Complete the lock with transfer ID
          if (stripeTransferId) {
            await completeReleaseLock(lock, stripeTransferId, {
              milestoneTitle: milestone.title,
              milestoneAmount: roundCurrency(milestoneAmount),
              releasedAmount: roundCurrency(milestoneAmount),
              sellerFee: roundCurrency(sellerFee),
              sellerNet: roundCurrency(sellerNet),
              releasedBy: auth.userId,
            })
          } else {
            // Transfer failed but release can continue (funds stay in wallet)
            await prisma.milestoneRelease.update({
              where: { id: milestoneRelease.id },
              data: { status: 'RELEASED' },
            })
          }
        } catch (error: any) {
          console.error(`Error creating Stripe transfer for milestone ${milestoneIndex} of rift ${id}:`, error)
          
          // Release failed lock on error
          await releaseFailedLock(lock)
          
          // If balance insufficient, skip this milestone
          if (error.message?.includes('Insufficient Stripe balance')) {
            console.error(`Insufficient balance for milestone ${milestoneIndex}, skipping`)
            continue
          }
          
          // Continue with release even if transfer fails (funds stay in wallet)
          await prisma.milestoneRelease.update({
            where: { id: milestoneRelease.id },
            data: { status: 'RELEASED' },
          })
        }
      } else {
        // No Stripe account - just mark as released
        await prisma.milestoneRelease.update({
          where: { id: milestoneRelease.id },
          data: { 
            status: 'RELEASED',
            payoutId: stripeTransferId,
          },
        })
      }

      // Update with final transfer ID if not already set
      if (stripeTransferId && !milestoneRelease.payoutId) {
        await prisma.milestoneRelease.update({
          where: { id: milestoneRelease.id },
          data: { payoutId: stripeTransferId },
        })
      }

      // Credit seller wallet for this milestone
      await creditSellerOnRelease(
        id,
        rift.sellerId,
        sellerNet,
        rift.currency,
        {
          riftNumber: rift.riftNumber,
          itemTitle: `${rift.itemTitle} - Milestone: ${milestone.title}`,
          milestoneIndex,
        }
      )

      // Log event for this milestone
      await logEvent(
        id,
        RiftEventActorType.BUYER,
        auth.userId,
        'MILESTONE_RELEASED',
        {
          milestoneIndex,
          milestoneTitle: milestone.title,
          milestoneAmount,
          sellerFee,
          sellerNet,
          stripeTransferId,
          releasedVia: 'RELEASE_ALL',
        },
        requestMeta
      )

      // Create timeline event for this milestone
      await prisma.timelineEvent.create({
        data: {
          id: crypto.randomUUID(),
          escrowId: id,
          type: 'MILESTONE_RELEASED',
          message: `Milestone "${milestone.title}" released. Amount: ${rift.currency} ${milestoneAmount.toFixed(2)}`,
          createdById: auth.userId,
        },
      })

      releasedMilestoneData.push({
        index: milestoneIndex,
        title: milestone.title,
        amount: milestoneAmount,
        sellerNet,
        stripeTransferId,
      })
    }

    // Check if all milestones have been released
    const allMilestonesReleased = releasedMilestoneData.length === milestones.length - releasedIndices.size &&
                                  releasedMilestoneData.length + releasedIndices.size >= milestones.length

    // If all milestones are released, update rift status to RELEASED
    if (allMilestonesReleased) {
      await prisma.riftTransaction.update({
        where: { id },
        data: {
          status: 'RELEASED',
          releasedAt: new Date(),
        },
      })

      // Create final release timeline event
      await prisma.timelineEvent.create({
        data: {
          id: crypto.randomUUID(),
          escrowId: id,
          type: 'FUNDS_RELEASED',
          message: `All milestones completed. Full payment released.`,
          createdById: auth.userId,
        },
      })
    }

    // Log event for release all action
    await logEvent(
      id,
      RiftEventActorType.BUYER,
      auth.userId,
      'MILESTONES_RELEASED_ALL',
      {
        releasedCount: releasedMilestoneData.length,
        totalMilestones: milestones.length,
        allMilestonesReleased,
        milestones: releasedMilestoneData,
      },
      requestMeta
    )

    return NextResponse.json({
      success: true,
      releasedCount: releasedMilestoneData.length,
      totalMilestones: milestones.length,
      allMilestonesReleased,
      milestones: releasedMilestoneData,
    })
  } catch (error: any) {
    console.error('Release all milestones error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
