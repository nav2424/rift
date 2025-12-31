/**
 * Vault Event Factory
 * Creates test vault events for audit chain testing
 */

import { VaultEventType, VaultActorRole } from '@prisma/client'
import { randomUUID } from 'crypto'
import { createHash } from 'crypto'

export interface EventFactoryOptions {
  riftId: string
  assetId?: string
  actorId?: string
  actorRole?: VaultActorRole
  eventType?: VaultEventType
  timestampUtc?: Date
  ipHash?: string
  userAgentHash?: string
  sessionId?: string
  deviceFingerprint?: string
  assetHash?: string
  prevLogHash?: string | null
  metadata?: Record<string, any>
}

export function createTestEvent(options: EventFactoryOptions) {
  const timestampUtc = options.timestampUtc || new Date()
  
  // Compute log hash (simplified version)
  const dataString = JSON.stringify({
    riftId: options.riftId,
    assetId: options.assetId || null,
    actorId: options.actorId || null,
    actorRole: options.actorRole || 'BUYER',
    eventType: options.eventType || 'BUYER_OPENED_ASSET',
    timestampUtc: timestampUtc.toISOString(),
    ipHash: options.ipHash || null,
    userAgentHash: options.userAgentHash || null,
    sessionId: options.sessionId || null,
    deviceFingerprint: options.deviceFingerprint || null,
    assetHash: options.assetHash || null,
    prevLogHash: options.prevLogHash || null,
    metadata: options.metadata || null,
  })
  
  const logHash = createHash('sha256').update(dataString).digest('hex')
  
  return {
    id: randomUUID(),
    riftId: options.riftId,
    assetId: options.assetId || null,
    actorId: options.actorId || randomUUID(),
    actorRole: options.actorRole || 'BUYER',
    eventType: options.eventType || 'BUYER_OPENED_ASSET',
    timestampUtc,
    ipHash: options.ipHash || hashString('192.168.1.1'),
    userAgentHash: options.userAgentHash || hashString('Mozilla/5.0'),
    sessionId: options.sessionId || randomUUID(),
    deviceFingerprint: options.deviceFingerprint || randomUUID(),
    assetHash: options.assetHash || null,
    prevLogHash: options.prevLogHash || null,
    logHash,
    metadata: options.metadata || null,
  }
}

export function hashString(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

export function createBuyerAccessEvent(
  riftId: string,
  assetId: string,
  buyerId: string,
  prevLogHash: string | null = null
) {
  return createTestEvent({
    riftId,
    assetId,
    actorId: buyerId,
    actorRole: 'BUYER',
    eventType: 'BUYER_OPENED_ASSET',
    prevLogHash,
  })
}

export function createBuyerDownloadEvent(
  riftId: string,
  assetId: string,
  buyerId: string,
  prevLogHash: string | null = null
) {
  return createTestEvent({
    riftId,
    assetId,
    actorId: buyerId,
    actorRole: 'BUYER',
    eventType: 'BUYER_DOWNLOADED_FILE',
    prevLogHash,
  })
}

export function createBuyerRevealEvent(
  riftId: string,
  assetId: string,
  buyerId: string,
  prevLogHash: string | null = null
) {
  return createTestEvent({
    riftId,
    assetId,
    actorId: buyerId,
    actorRole: 'BUYER',
    eventType: 'BUYER_REVEALED_LICENSE_KEY',
    prevLogHash,
  })
}

export function createSellerUploadEvent(
  riftId: string,
  assetId: string,
  sellerId: string,
  prevLogHash: string | null = null
) {
  return createTestEvent({
    riftId,
    assetId,
    actorId: sellerId,
    actorRole: 'SELLER',
    eventType: 'SELLER_UPLOADED_ASSET',
    prevLogHash,
  })
}

export function createAdminViewEvent(
  riftId: string,
  assetId: string,
  adminId: string,
  prevLogHash: string | null = null
) {
  return createTestEvent({
    riftId,
    assetId,
    actorId: adminId,
    actorRole: 'ADMIN',
    eventType: 'ADMIN_VIEWED_ASSET',
    prevLogHash,
  })
}

// Create a chain of events (for audit chain testing)
export function createEventChain(
  riftId: string,
  events: Array<{
    type: VaultEventType
    actorId: string
    actorRole: VaultActorRole
    assetId?: string
  }>
) {
  const chain: ReturnType<typeof createTestEvent>[] = []
  let prevHash: string | null = null
  
  for (const event of events) {
    const testEvent = createTestEvent({
      riftId,
      assetId: event.assetId,
      actorId: event.actorId,
      actorRole: event.actorRole,
      eventType: event.type,
      prevLogHash: prevHash,
    })
    
    chain.push(testEvent)
    prevHash = testEvent.logHash
  }
  
  return chain
}

