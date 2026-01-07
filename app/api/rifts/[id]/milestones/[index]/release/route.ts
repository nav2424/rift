import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { calculateSellerFee, calculateSellerNet, roundCurrency } from '@/lib/fees'
import { createRiftTransfer } from '@/lib/stripe'
import { creditSellerOnRelease } from '@/lib/wallet'
import { logEvent, extractRequestMetadata } from '@/lib/rift-events'
import { RiftEventActorType } from '@prisma/client'

/**
 * Release funds for a specific milestone
 * Only buyers can release milestone funds
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; index: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, index } = await params
    const milestoneIndex = parseInt(index)

    if (isNaN(milestoneIndex) || milestoneIndex < 0) {
      return NextResponse.json(
        { error: 'Invalid milestone index' },
        { status: 400 }
      )
    }

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

    // Verify rift is funded
    if (rift.status !== 'FUNDED' && rift.status !== 'PROOF_SUBMITTED' && rift.status !== 'UNDER_REVIEW') {
      return NextResponse.json(
        { error: `Cannot release milestone funds. Rift status is ${rift.status}` },
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

    if (milestoneIndex >= milestones.length) {
      return NextResponse.json(
        { error: `Milestone index ${milestoneIndex} is out of range` },
        { status: 400 }
      )
    }

    const milestone = milestones[milestoneIndex]

    // Check dispute freeze before releasing
    const { checkDisputeFreeze } = await import('@/lib/dispute-freeze')
    const freezeCheck = await checkDisputeFreeze(id)
    
    if (freezeCheck.frozen) {
      return NextResponse.json(
        { error: `Cannot release funds: ${freezeCheck.reason}` },
        { status: 400 }
      )
    }

    // Check if this milestone has already been released
    const existingRelease = rift.MilestoneRelease.find(
      (r) => r.milestoneIndex === milestoneIndex && r.status === 'RELEASED'
    )

    if (existingRelease) {
      return NextResponse.json(
        { error: 'This milestone has already been released' },
        { status: 400 }
      )
    }

    // Acquire concurrency lock for milestone release
    const { acquireMilestoneReleaseLock, completeReleaseLock, releaseFailedLock } = await import('@/lib/release-concurrency')
    const lock = await acquireMilestoneReleaseLock(id, milestoneIndex)
    
    if (!lock) {
      return NextResponse.json(
        { error: 'Failed to acquire release lock' },
        { status: 500 }
      )
    }

    // If already released, return existing result
    if (lock.status === 'CREATED') {
      return NextResponse.json({
        success: true,
        milestoneRelease: {
          id: lock.releaseId,
          milestoneIndex,
          alreadyReleased: true,
        },
      })
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
          // If milestone is X% of total, sellerPayout is X% of total sellerPayout
          const milestoneRatio = milestoneAmount / rift.subtotal
          milestoneSellerPayout = roundCurrency(totalSellerPayout * milestoneRatio)
        }
      } catch (error) {
        console.error(`Error retrieving PaymentIntent for milestone ${milestoneIndex} of rift ${id}:`, error)
        // Fall back to calculated sellerNet
      }
    }

    // Update the lock record with actual data (it was created with placeholder values)
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
          milestoneRelease.id, // milestoneId for tracking
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
            data: { status: 'RELEASED' }, // Release without transfer
          })
        }
      } catch (error: any) {
        console.error(`Error creating Stripe transfer for milestone ${milestoneIndex} of rift ${id}:`, error)
        
        // Release failed lock on error
        await releaseFailedLock(lock)
        
        // If balance insufficient, return error
        if (error.message?.includes('Insufficient Stripe balance')) {
          return NextResponse.json(
            { error: `Cannot release funds: ${error.message}` },
            { status: 400 }
          )
        }
        
        // Continue with release even if transfer fails (funds stay in wallet)
        await prisma.milestoneRelease.update({
          where: { id: milestoneRelease.id },
          data: { status: 'RELEASED' }, // Release without transfer
        })
      }
    } else {
      // No Stripe account - just mark as released
      await prisma.milestoneRelease.update({
        where: { id: milestoneRelease.id },
        data: { status: 'RELEASED' },
      })
    }

    // Create milestone release record
    const milestoneRelease = await prisma.milestoneRelease.create({
      data: {
        id: crypto.randomUUID(),
        riftId: id,
        milestoneIndex,
        milestoneTitle: milestone.title,
        milestoneAmount: roundCurrency(milestoneAmount),
        releasedAmount: roundCurrency(milestoneAmount),
        sellerFee: roundCurrency(sellerFee),
        sellerNet: roundCurrency(sellerNet),
        releasedBy: auth.userId,
        status: 'RELEASED',
        payoutId: stripeTransferId, // Store transfer ID as payoutId for tracking
      },
    })

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

    // Log event
    const requestMeta = extractRequestMetadata(request)
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
      },
      requestMeta
    )

    // Create timeline event
    await prisma.timelineEvent.create({
      data: {
        id: crypto.randomUUID(),
        escrowId: id,
        type: 'MILESTONE_RELEASED',
        message: `Milestone "${milestone.title}" released. Amount: ${rift.currency} ${milestoneAmount.toFixed(2)}`,
        createdById: auth.userId,
      },
    })

    // Check if all milestones have been released
    const releasedMilestones = rift.MilestoneRelease.filter((r) => r.status === 'RELEASED').length + 1
    const allMilestonesReleased = releasedMilestones >= milestones.length

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

    return NextResponse.json({
      success: true,
      milestoneRelease: {
        id: milestoneRelease.id,
        milestoneIndex,
        milestoneTitle: milestone.title,
        amount: milestoneAmount,
        sellerNet,
        allMilestonesReleased,
      },
    })
  } catch (error: any) {
    console.error('Milestone release error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

