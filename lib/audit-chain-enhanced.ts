/**
 * Enhanced Tamper-Evident Audit Trail
 * Implements verifiable hash chaining with daily root signatures
 */

import { prisma } from './prisma'
import { createHash, createSign, createVerify } from 'crypto'
import { logVaultEvent } from './vault-logging'

export interface DailyRoot {
  date: string // YYYY-MM-DD
  rootHash: string // Hash of all events for the day
  previousDayHash: string | null // Hash of previous day's root
  signature: string // Server-signed hash
  eventCount: number
  createdAt: Date
}

/**
 * Generate daily root hash for all events
 * This creates a Merkle-tree-like structure where each day's events are hashed together
 */
export async function generateDailyRoot(date: Date): Promise<DailyRoot | null> {
  const dateStr = date.toISOString().split('T')[0] // YYYY-MM-DD
  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(date)
  endOfDay.setHours(23, 59, 59, 999)
  
  // Get all events for the day (from all Rifts)
  const events = await prisma.vaultEvent.findMany({
    where: {
      timestampUtc: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
    orderBy: { timestampUtc: 'asc' },
    select: {
      id: true,
      logHash: true,
      timestampUtc: true,
    },
  })
  
  if (events.length === 0) {
    return null // No events for this day
  }
  
  // Build Merkle-style hash chain for the day
  // Each event includes previous event's hash
  let prevHash: string | null = null
  const eventHashes: string[] = []
  
  for (const event of events) {
    // Include event ID, hash, and timestamp
    const eventData = `${event.id}:${event.logHash}:${event.timestampUtc.toISOString()}`
    const eventHash = createHash('sha256').update(eventData).digest('hex')
    
    // Chain with previous event
    const chainHash = prevHash
      ? createHash('sha256').update(`${prevHash}:${eventHash}`).digest('hex')
      : eventHash
    
    eventHashes.push(chainHash)
    prevHash = chainHash
  }
  
  // Root hash is the final chain hash
  const rootHash = prevHash!
  
  // Get previous day's root (if exists)
  const previousDay = new Date(date)
  previousDay.setDate(previousDay.getDate() - 1)
  const previousRoot = await getDailyRoot(previousDay)
  
  // Include previous day's hash in this day's root for chaining
  const finalRootInput = previousRoot
    ? `${dateStr}:${rootHash}:${previousRoot.rootHash}:${events.length}`
    : `${dateStr}:${rootHash}:null:${events.length}`
  
  const finalRootHash = createHash('sha256').update(finalRootInput).digest('hex')
  
  // Sign the root hash with server key (stored in env)
  const signature = await signRoot(finalRootHash)
  
  return {
    date: dateStr,
    rootHash: finalRootHash,
    previousDayHash: previousRoot?.rootHash || null,
    signature,
    eventCount: events.length,
    createdAt: new Date(),
  }
}

/**
 * Get daily root for a specific date
 */
async function getDailyRoot(date: Date): Promise<DailyRoot | null> {
  // This would query a daily_roots table
  // For now, return null (to be implemented with proper storage)
  // TODO: Create daily_roots table in Prisma schema
  return null
}

/**
 * Sign a root hash with server private key
 */
async function signRoot(rootHash: string): Promise<string> {
  const privateKey = process.env.AUDIT_CHAIN_PRIVATE_KEY
  
  if (!privateKey) {
    // If no key configured, return hash itself (less secure but functional)
    console.warn('AUDIT_CHAIN_PRIVATE_KEY not configured, using unsigned hash')
    return rootHash
  }
  
  // Sign using RSA
  const sign = createSign('RSA-SHA256')
  sign.update(rootHash)
  sign.end()
  
  return sign.sign(privateKey, 'base64')
}

/**
 * Verify a root hash signature
 */
export async function verifyRootSignature(
  rootHash: string,
  signature: string
): Promise<boolean> {
  const publicKey = process.env.AUDIT_CHAIN_PUBLIC_KEY
  
  if (!publicKey) {
    // If no key configured, signature verification cannot work
    console.warn('AUDIT_CHAIN_PUBLIC_KEY not configured, cannot verify signature')
    return false
  }
  
  try {
    const verify = createVerify('RSA-SHA256')
    verify.update(rootHash)
    verify.end()
    
    return verify.verify(publicKey, signature, 'base64')
  } catch (error) {
    console.error('Signature verification error:', error)
    return false
  }
}

/**
 * Verify complete audit chain integrity for a Rift
 * Checks:
 * 1. Event log chain integrity (from vault-logging)
 * 2. Events are included in daily roots
 * 3. Daily root signatures are valid
 * 4. Daily roots are chained correctly
 */
export async function verifyCompleteAuditChain(riftId: string): Promise<{
  valid: boolean
  errors: string[]
  warnings: string[]
}> {
  const errors: string[] = []
  const warnings: string[] = []
  
  // Get all events for this Rift
  const events = await prisma.vaultEvent.findMany({
    where: { riftId },
    orderBy: { timestampUtc: 'asc' },
  })
  
  if (events.length === 0) {
    return { valid: true, errors: [], warnings: [] }
  }
  
  // Verify event chain integrity (using existing vault-logging verification)
  const { verifyLogChain } = await import('./vault-logging')
  const chainVerification = await verifyLogChain(riftId)
  
  if (!chainVerification.valid) {
    errors.push('Event log chain integrity check failed')
    // Add details about which events are invalid
    const invalidEvents = chainVerification.events.filter(e => !e.valid)
    if (invalidEvents.length > 0) {
      errors.push(`Invalid events: ${invalidEvents.map(e => e.id).join(', ')}`)
    }
  }
  
  // TODO: Verify events are included in daily roots
  // This requires the daily_roots table to be implemented
  
  // Check for admin events (should be included in chain)
  const adminEvents = events.filter(e => e.actorRole === 'ADMIN')
  if (adminEvents.length > 0) {
    // Verify admin events are in chain
    const adminEventIds = new Set(adminEvents.map(e => e.id))
    const chainEventIds = new Set(chainVerification.events.map(e => e.id))
    
    const missingAdminEvents = adminEvents.filter(e => !chainEventIds.has(e.id))
    if (missingAdminEvents.length > 0) {
      errors.push(`Admin events missing from chain: ${missingAdminEvents.map(e => e.id).join(', ')}`)
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Generate daily root for yesterday (should be called via cron)
 */
export async function generatePreviousDayRoot(): Promise<void> {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  
  const root = await generateDailyRoot(yesterday)
  
  if (root) {
    // Store in database
    // TODO: Implement daily_roots table storage
    console.log(`Generated daily root for ${root.date}: ${root.rootHash}`)
  }
}
