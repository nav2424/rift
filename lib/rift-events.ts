/**
 * Rift Event Logging - Truth Engine
 * 
 * Immutable append-only event log for all Rift transactions.
 * This provides a complete audit trail for disputes, chargebacks, and fraud prevention.
 */

import { prisma } from './prisma'
import { RiftEventActorType } from '@prisma/client'
import crypto from 'crypto'

/**
 * Request metadata extracted from HTTP request
 */
export interface RequestMetadata {
  ip?: string
  userAgent?: string
  deviceFingerprint?: string
}

/**
 * Hash IP address for privacy (SHA256 with salt)
 */
function hashIP(ip: string | undefined): string | null {
  if (!ip) return null
  
  const salt = process.env.IP_HASH_SALT || 'rift-ip-salt-change-in-production'
  return crypto.createHash('sha256').update(ip + salt).digest('hex')
}

/**
 * Log an event to the immutable event log
 * 
 * @param riftId - The Rift transaction ID
 * @param actorType - Who performed the action (BUYER, SELLER, SYSTEM, ADMIN)
 * @param actorId - User ID of the actor (null for SYSTEM events)
 * @param eventType - Type of event (e.g., RIFT_CREATED, PAYMENT_SUCCEEDED)
 * @param payload - Event-specific data (JSON-serializable)
 * @param requestMeta - Request metadata (IP, user agent, device fingerprint)
 */
export async function logEvent(
  riftId: string,
  actorType: RiftEventActorType,
  actorId: string | null,
  eventType: string,
  payload: Record<string, any> = {},
  requestMeta?: RequestMetadata
): Promise<void> {
  try {
    // Validate rift exists
    const rift = await prisma.riftTransaction.findUnique({
      where: { id: riftId },
      select: { id: true },
    })

    if (!rift) {
      console.error(`[RiftEvent] Rift not found: ${riftId}`)
      return
    }

    // Hash IP for privacy
    const ipHash = requestMeta?.ip ? hashIP(requestMeta.ip) : null

    // Create immutable event record
    await prisma.riftEvent.create({
      data: {
        riftId,
        actorType,
        actorId: actorId || null,
        eventType,
        payload: payload as any, // Prisma Json type
        ipHash,
        deviceFingerprint: requestMeta?.deviceFingerprint || null,
        userAgent: requestMeta?.userAgent || null,
      },
    })

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[RiftEvent] ${eventType} on rift ${riftId} by ${actorType}${actorId ? ` (${actorId})` : ''}`)
    }
  } catch (error: any) {
    // Never throw - event logging should not break the main flow
    // But log errors for monitoring
    console.error(`[RiftEvent] Failed to log event ${eventType} for rift ${riftId}:`, error.message)
  }
}

/**
 * Extract request metadata from Next.js request
 */
export function extractRequestMetadata(request: {
  headers: Headers | Record<string, string | string[] | undefined>
  ip?: string
}): RequestMetadata {
  const headers = request.headers instanceof Headers 
    ? Object.fromEntries(request.headers.entries())
    : request.headers

  // Get IP from various headers (X-Forwarded-For, X-Real-IP, or direct)
  const forwardedFor = headers['x-forwarded-for']
  const realIP = headers['x-real-ip']
  const ip = Array.isArray(forwardedFor) 
    ? forwardedFor[0]?.split(',')[0]?.trim()
    : typeof forwardedFor === 'string'
    ? forwardedFor.split(',')[0]?.trim()
    : typeof realIP === 'string'
    ? realIP
    : Array.isArray(realIP)
    ? realIP[0]
    : request.ip
    || undefined

  // Get user agent
  const userAgent = Array.isArray(headers['user-agent'])
    ? headers['user-agent'][0]
    : typeof headers['user-agent'] === 'string'
    ? headers['user-agent']
    : undefined

  // Device fingerprint should be passed from client
  const deviceFingerprint = Array.isArray(headers['x-device-fingerprint'])
    ? headers['device-fingerprint'][0]
    : typeof headers['x-device-fingerprint'] === 'string'
    ? headers['x-device-fingerprint']
    : undefined

  return {
    ip,
    userAgent,
    deviceFingerprint,
  }
}

/**
 * Get all events for a Rift (for admin/internal use)
 */
export async function getRiftEvents(riftId: string) {
  return prisma.riftEvent.findMany({
    where: { riftId },
    orderBy: { createdAt: 'asc' },
  })
}
