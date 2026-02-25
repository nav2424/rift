/**
 * Immutable deal timeline for UGC: log events with metadata for dispute evidence.
 */

import { prisma } from '@/lib/prisma'

export type DealTimelineEventType =
  | 'MILESTONE_CREATED'
  | 'MILESTONE_UPDATED'
  | 'MILESTONE_FUNDED'
  | 'DELIVERY_SUBMITTED'
  | 'REVISION_REQUESTED'
  | 'MILESTONE_APPROVED'
  | 'MILESTONE_AUTO_APPROVED'
  | 'MILESTONE_RELEASED'
  | 'DISPUTE_OPENED'
  | 'DISPUTE_UPDATED'
  | 'DISPUTE_CLOSED'
  | 'MESSAGE_SENT'
  | 'CONTRACT_AMENDMENT_PROPOSED'
  | 'CONTRACT_AMENDMENT_ACCEPTED'
  | 'CONTRACT_AMENDMENT_REJECTED'

export interface TimelineMetadata {
  milestoneId?: string
  milestoneIndex?: number
  fileIds?: string[]
  revisionNumber?: number
  approvedBy?: string
  approvedAt?: string
  disputeId?: string
  reasonCode?: string
  messageId?: string
  amendmentId?: string
  [key: string]: unknown
}

export async function logDealTimelineEvent(
  riftId: string,
  type: DealTimelineEventType | string,
  actorId: string | null,
  metadata?: TimelineMetadata
): Promise<void> {
  await prisma.dealTimelineEvent.create({
    data: {
      id: crypto.randomUUID(),
      riftId,
      type,
      actorId: actorId ?? undefined,
      metadataJson: metadata ? (metadata as object) : undefined,
    },
  })
}
