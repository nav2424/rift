/**
 * Verification Queue
 * Handles asynchronous proof verification
 */

import { getQueue, QUEUE_NAMES } from './config'
import { VerificationJobData, VerificationJobResult } from './jobs'
import { verifyRiftProofs } from '../vault-verification'
import { prisma } from '../prisma'
import { EscrowStatus } from '@prisma/client'
import { transitionRiftState } from '../rift-state'

const queue = getQueue<VerificationJobData>(QUEUE_NAMES.VERIFICATION)

/**
 * Add verification job to queue
 */
export async function queueVerificationJob(
  riftId: string,
  assetIds: string[],
  options?: {
    triggeredBy?: VerificationJobData['triggeredBy']
    triggeredByUserId?: string
    priority?: number
  }
): Promise<string> {
  const job = await queue.add(
    'verify-rift-proofs',
    {
      riftId,
      assetIds,
      triggeredBy: options?.triggeredBy || 'proof-submission',
      triggeredByUserId: options?.triggeredByUserId,
    },
    {
      priority: options?.priority || 0,
      jobId: `verification-${riftId}-${Date.now()}`, // Unique job ID
    }
  )

  return job.id!
}

/**
 * Get verification job status
 */
export async function getVerificationJobStatus(jobId: string) {
  const job = await queue.getJob(jobId)
  
  if (!job) {
    return null
  }

  const state = await job.getState()
  const progress = job.progress
  const result = job.returnvalue as VerificationJobResult | undefined
  const failedReason = job.failedReason

  return {
    jobId,
    state, // 'completed', 'active', 'waiting', 'failed', 'delayed'
    progress,
    result,
    failedReason,
    timestamp: job.timestamp,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
  }
}

/**
 * Get verification status for a Rift
 */
export async function getRiftVerificationStatus(riftId: string) {
  const jobs = await queue.getJobs(['active', 'waiting', 'completed', 'failed'], 0, -1)
  
  // Find the most recent job for this rift
  const riftJobs = jobs
    .filter((job) => job.data.riftId === riftId)
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))

  if (riftJobs.length === 0) {
    return null
  }

  const latestJob = riftJobs[0]
  return getVerificationJobStatus(latestJob.id!)
}

/**
 * Verification job processor
 * This will be used by the worker to process jobs
 */
export async function processVerificationJob(data: VerificationJobData): Promise<VerificationJobResult> {
  try {
    // Get the rift
    const rift = await prisma.riftTransaction.findUnique({
      where: { id: data.riftId },
      select: {
        id: true,
        status: true,
        riskScore: true,
      },
    })

    if (!rift) {
      throw new Error(`Rift ${data.riftId} not found`)
    }

    // Run verification
    const verificationResult = await verifyRiftProofs(data.riftId)

    // Auto-approve if verification passed with high confidence
    if (
      verificationResult.allPassed &&
      !verificationResult.shouldRouteToReview &&
      verificationResult.results.every((r) => r.qualityScore >= 90 && r.reasons.length === 0) &&
      rift.riskScore <= 30 &&
      rift.status === 'PROOF_SUBMITTED'
    ) {
      // Update proof status to VALID (if there's a proof record)
      // This would require querying for the proof record
      // For now, we'll just transition to UNDER_REVIEW if needed
      
      // If all passed and shouldn't route to review, we could transition to a different state
      // But let's keep it safe and route to review for now
      // TODO: Add auto-approval logic here if needed
    }

    // Transition to UNDER_REVIEW if needed
    if (
      verificationResult.shouldRouteToReview &&
      rift.status === 'PROOF_SUBMITTED'
    ) {
      await transitionRiftState(data.riftId, 'UNDER_REVIEW', {
        userId: data.triggeredByUserId || 'system',
        reason: 'Quality check flagged for review',
      })
    }

    // Get asset IDs for results
    const assets = await prisma.vaultAsset.findMany({
      where: { riftId: data.riftId },
      select: { id: true },
    })

    return {
      success: true,
      allPassed: verificationResult.allPassed,
      shouldRouteToReview: verificationResult.shouldRouteToReview,
      results: verificationResult.results.map((r, index) => ({
        assetId: assets[index]?.id || '',
        passed: r.passed,
        qualityScore: r.qualityScore,
        issues: r.reasons,
      })),
    }
  } catch (error: any) {
    console.error('Verification job error:', error)
    return {
      success: false,
      allPassed: false,
      shouldRouteToReview: true,
      error: error.message || 'Unknown error',
    }
  }
}

