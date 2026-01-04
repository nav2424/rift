/**
 * Tamper-evident Vault Event Logging
 * Implements hash chaining for immutable audit trail
 */

import { prisma } from './prisma'
import { VaultEventType, VaultActorRole } from '@prisma/client'
import { createHash, randomUUID } from 'crypto'

export interface VaultEventInput {
  riftId: string
  assetId?: string
  actorId?: string
  actorRole: VaultActorRole
  eventType: VaultEventType
  ipHash?: string
  userAgentHash?: string
  sessionId?: string
  deviceFingerprint?: string
  assetHash?: string
  metadata?: Record<string, any>
}

/**
 * Hash a string (for IP, user agent, etc.)
 */
export function hashString(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

/**
 * Compute log entry hash
 */
function computeLogHash(eventData: {
  riftId: string
  assetId?: string | null
  actorId?: string | null
  actorRole: string
  eventType: string
  timestampUtc: Date
  ipHash?: string | null
  userAgentHash?: string | null
  sessionId?: string | null
  deviceFingerprint?: string | null
  assetHash?: string | null
  prevLogHash?: string | null
  metadata?: any
}): string {
  // Create a deterministic string representation
  const dataString = JSON.stringify({
    riftId: eventData.riftId,
    assetId: eventData.assetId || null,
    actorId: eventData.actorId || null,
    actorRole: eventData.actorRole,
    eventType: eventData.eventType,
    timestampUtc: eventData.timestampUtc.toISOString(),
    ipHash: eventData.ipHash || null,
    userAgentHash: eventData.userAgentHash || null,
    sessionId: eventData.sessionId || null,
    deviceFingerprint: eventData.deviceFingerprint || null,
    assetHash: eventData.assetHash || null,
    prevLogHash: eventData.prevLogHash || null,
    metadata: eventData.metadata || null,
  })

  return createHash('sha256').update(dataString).digest('hex')
}

/**
 * Log a vault event with tamper-evident hash chaining
 */
export async function logVaultEvent(input: VaultEventInput): Promise<string> {
  // Get the previous log entry for this Rift to chain hashes
  const previousEvent = await prisma.vault_events.findFirst({
    where: { riftId: input.riftId },
    orderBy: { timestampUtc: 'desc' },
    select: { logHash: true },
  })

  const prevLogHash = previousEvent?.logHash || null

  // Create the event record (without logHash first)
  const timestampUtc = new Date()

  // Compute the log hash
  const logHash = computeLogHash({
    riftId: input.riftId,
    assetId: input.assetId || null,
    actorId: input.actorId || null,
    actorRole: input.actorRole,
    eventType: input.eventType,
    timestampUtc,
    ipHash: input.ipHash || null,
    userAgentHash: input.userAgentHash || null,
    sessionId: input.sessionId || null,
    deviceFingerprint: input.deviceFingerprint || null,
    assetHash: input.assetHash || null,
    prevLogHash,
      metadata: input.metadata || undefined,
  })

  // Create the event with computed hash
  const event = await prisma.vault_events.create({
    data: {
      id: randomUUID(),
      riftId: input.riftId,
      assetId: input.assetId,
      actorId: input.actorId,
      actorRole: input.actorRole,
      eventType: input.eventType,
      timestampUtc,
      ipHash: input.ipHash,
      userAgentHash: input.userAgentHash,
      sessionId: input.sessionId,
      deviceFingerprint: input.deviceFingerprint,
      assetHash: input.assetHash,
      prevLogHash,
      logHash,
      metadata: input.metadata || undefined,
    },
  })

  return event.id
}

/**
 * Verify log chain integrity for a Rift
 * Returns true if chain is valid, false if tampered
 */
export async function verifyLogChain(riftId: string): Promise<{
  valid: boolean
  events: Array<{ id: string; valid: boolean; expectedHash: string; actualHash: string }>
}> {
  const events = await prisma.vault_events.findMany({
    where: { riftId },
    orderBy: { timestampUtc: 'asc' },
  })

  const results: Array<{
    id: string
    valid: boolean
    expectedHash: string
    actualHash: string
  }> = []

  let prevHash: string | null = null
  let allValid = true

  for (const event of events) {
    // Compute expected hash
    const expectedHash = computeLogHash({
      riftId: event.riftId,
      assetId: event.assetId,
      actorId: event.actorId,
      actorRole: event.actorRole,
      eventType: event.eventType,
      timestampUtc: event.timestampUtc,
      ipHash: event.ipHash,
      userAgentHash: event.userAgentHash,
      sessionId: event.sessionId,
      deviceFingerprint: event.deviceFingerprint,
      assetHash: event.assetHash,
      prevLogHash: prevHash,
      metadata: event.metadata,
    })

    const valid = expectedHash === event.logHash
    if (!valid) {
      allValid = false
    }

    results.push({
      id: event.id,
      valid,
      expectedHash,
      actualHash: event.logHash,
    })

    prevHash = event.logHash
  }

  return {
    valid: allValid,
    events: results,
  }
}

/**
 * Get vault event history for a Rift
 */
export async function getVaultEventHistory(
  riftId: string,
  options?: {
    assetId?: string
    eventType?: VaultEventType
    actorRole?: VaultActorRole
    limit?: number
  }
): Promise<any[]> {
  const events = await prisma.vault_events.findMany({
    where: {
      riftId,
      assetId: options?.assetId,
      eventType: options?.eventType,
      actorRole: options?.actorRole,
    },
    orderBy: { timestampUtc: 'desc' },
    take: options?.limit || 100,
    include: {
      vault_assets: {
        select: {
          id: true,
          assetType: true,
          fileName: true,
        },
      },
    },
  })

  return events.map((event) => ({
    id: event.id,
    eventType: event.eventType,
    actorRole: event.actorRole,
    timestampUtc: event.timestampUtc,
    assetId: event.assetId,
    asset: event.vault_assets,
    metadata: event.metadata,
  }))
}

