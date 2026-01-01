/**
 * Vault Intelligence System
 * Auto-generates evidence packets, summarizes content, detects sensitive data
 */

import { prisma } from '../prisma'

export interface EvidencePacket {
  riftId: string
  timeline: TimelineEvent[]
  chatExcerpts: ChatExcerpt[]
  uploads: UploadSummary[]
  accessLogs: AccessLog[]
  keyReveals: KeyReveal[]
  hashes: HashRecord[]
  summary: string
  riskFlags: string[]
  exportable: boolean
}

export interface TimelineEvent {
  timestamp: Date
  type: string
  message: string
  actor: string
}

export interface ChatExcerpt {
  timestamp: Date
  sender: string
  message: string
  relevance: 'HIGH' | 'MEDIUM' | 'LOW'
}

export interface UploadSummary {
  assetId: string
  fileName: string
  uploadTime: Date
  assetType: string
  size: number
  hash: string
  verified: boolean
}

export interface AccessLog {
  timestamp: Date
  actor: string
  action: string
  assetId?: string
}

export interface KeyReveal {
  timestamp: Date
  assetId: string
  keyType: string
  revealed: boolean
}

export interface HashRecord {
  assetId: string
  sha256: string
  verified: boolean
}

/**
 * Generate comprehensive evidence packet for disputes
 */
export async function generateEvidencePacket(
  riftId: string
): Promise<EvidencePacket> {
  const rift = await prisma.riftTransaction.findUnique({
    where: { id: riftId },
    include: {
      buyer: { select: { name: true, email: true } },
      seller: { select: { name: true, email: true } },
    },
  })

  if (!rift) {
    throw new Error(`Rift not found: ${riftId}`)
  }

  // Gather timeline events
  const timelineEvents = await prisma.timelineEvent.findMany({
    where: { escrowId: riftId },
    include: {
      createdBy: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  const timeline: TimelineEvent[] = timelineEvents.map(e => ({
    timestamp: e.createdAt,
    type: e.type,
    message: e.message,
    actor: e.createdBy?.name || e.createdBy?.email || 'System',
  }))

  // Gather vault assets
  const assets = await prisma.vaultAsset.findMany({
    where: { riftId },
    orderBy: { createdAt: 'asc' },
  })

  const uploads: UploadSummary[] = assets.map(a => ({
    assetId: a.id,
    fileName: a.fileName || 'Unknown',
    uploadTime: a.createdAt,
    assetType: a.assetType || 'UNKNOWN',
    size: (a as any).sizeBytes || 0,
    hash: a.sha256,
    verified: true, // Would verify against blockchain/immutable storage
  }))

  // Gather access logs
  const vaultEvents = await prisma.vaultEvent.findMany({
    where: { riftId },
    // Note: VaultEvent doesn't have an 'actor' relation - actorId is just a string
    orderBy: { timestampUtc: 'asc' },
  })

  const accessLogs: AccessLog[] = vaultEvents.map(e => ({
    timestamp: e.timestampUtc,
    actor: e.actorId || 'Unknown', // actorId is a string, not a relation
    action: e.eventType,
    assetId: e.assetId || undefined,
  }))

  // Gather key reveals (for license keys)
  const keyReveals: KeyReveal[] = []
  for (const asset of assets) {
    if (asset.assetType === 'LICENSE_KEY') {
      // Check for buyer revealed license key events
      const revealEvent = vaultEvents.find(
        e => e.assetId === asset.id && e.eventType === 'BUYER_REVEALED_LICENSE_KEY'
      )
      if (revealEvent) {
        keyReveals.push({
          timestamp: revealEvent.timestampUtc,
          assetId: asset.id,
          keyType: 'LICENSE_KEY',
          revealed: true,
        })
      }
    }
  }

  // Gather hashes
  const hashes: HashRecord[] = assets.map(a => ({
    assetId: a.id,
    sha256: a.sha256,
    verified: true,
  }))

  // Get chat excerpts (would need to fetch from chat system)
  const chatExcerpts: ChatExcerpt[] = [] // Simplified - would fetch from chat API

  // Generate summary
  const summary = generateSummary({
    timeline,
    uploads,
    accessLogs,
    keyReveals,
    rift,
  })

  // Detect risk flags
  const riskFlags = detectRiskFlags({
    timeline,
    uploads,
    accessLogs,
    rift,
  })

  return {
    riftId,
    timeline,
    chatExcerpts,
    uploads,
    accessLogs,
    keyReveals,
    hashes,
    summary,
    riskFlags,
    exportable: true,
  }
}

/**
 * Generate human-readable summary
 */
function generateSummary(params: {
  timeline: TimelineEvent[]
  uploads: UploadSummary[]
  accessLogs: AccessLog[]
  keyReveals: KeyReveal[]
  rift: any
}): string {
  const { timeline, uploads, accessLogs, keyReveals, rift } = params

  const parts: string[] = []

  parts.push(`Rift #${rift.riftNumber || rift.id.slice(-4)}: ${rift.itemTitle}`)
  parts.push(`\nStatus: ${rift.status}`)
  parts.push(`Amount: ${rift.currency} ${rift.subtotal || 0}`)

  parts.push(`\n\nTimeline Events: ${timeline.length}`)
  const keyEvents = timeline.filter(e =>
    ['FUNDED', 'PROOF_SUBMITTED', 'DISPUTE_RAISED'].includes(e.type)
  )
  for (const event of keyEvents.slice(0, 5)) {
    parts.push(`- ${event.timestamp.toISOString()}: ${event.message}`)
  }

  parts.push(`\n\nProof Assets: ${uploads.length}`)
  for (const upload of uploads.slice(0, 3)) {
    parts.push(`- ${upload.fileName} (${upload.assetType}, ${formatBytes(upload.size)})`)
  }

  parts.push(`\n\nVault Access: ${accessLogs.length} events`)
  const buyerAccess = accessLogs.filter(a => a.actor.includes(rift.buyer?.email || ''))
  if (buyerAccess.length > 0) {
    parts.push(`- Buyer accessed vault ${buyerAccess.length} time(s)`)
  }

  if (keyReveals.length > 0) {
    parts.push(`\n\nLicense Keys Revealed: ${keyReveals.length}`)
  }

  return parts.join('\n')
}

/**
 * Detect risk flags in evidence
 */
function detectRiskFlags(params: {
  timeline: TimelineEvent[]
  uploads: UploadSummary[]
  accessLogs: AccessLog[]
  rift: any
}): string[] {
  const flags: string[] = []
  const { uploads, accessLogs, rift } = params

  // No proof submitted
  if (uploads.length === 0 && rift.status !== 'DRAFT') {
    flags.push('NO_PROOF_SUBMITTED')
  }

  // Buyer never accessed vault
  const buyerAccess = accessLogs.filter(a =>
    a.actor.includes(rift.buyer?.email || '')
  )
  if (buyerAccess.length === 0 && uploads.length > 0) {
    flags.push('BUYER_NEVER_ACCESSED_VAULT')
  }

  // Duplicate proof detection (would check hashes)
  const uniqueHashes = new Set(uploads.map(u => u.hash))
  if (uniqueHashes.size < uploads.length) {
    flags.push('DUPLICATE_PROOF_DETECTED')
  }

  // Late proof submission
  const proofSubmitted = params.timeline.find(e => e.type === 'PROOF_SUBMITTED')
  if (proofSubmitted && rift.fundedAt) {
    const daysSinceFunded = Math.floor(
      (proofSubmitted.timestamp.getTime() - rift.fundedAt.getTime()) /
      (1000 * 60 * 60 * 24)
    )
    if (daysSinceFunded > 7) {
      flags.push('LATE_PROOF_SUBMISSION')
    }
  }

  return flags
}

/**
 * Summarize vault content for admins
 */
export async function summarizeVaultContent(
  riftId: string
): Promise<{
  summary: string
  itemType: string
  proofQuality: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR'
  completeness: number // 0-100
  recommendations: string[]
}> {
  const assets = await prisma.vaultAsset.findMany({
    where: { riftId },
  })

  const rift = await prisma.riftTransaction.findUnique({
    where: { id: riftId },
    select: {
      itemType: true,
      serviceDeliverables: true,
      completionCriteria: true,
    },
  })

  if (!rift) {
    throw new Error(`Rift not found: ${riftId}`)
  }

  const summary = `Seller submitted ${assets.length} asset(s) for ${rift.itemType} transaction.`

  // Calculate completeness
  let completeness = 0
  if (rift.itemType === 'SERVICES' && rift.serviceDeliverables) {
    const deliverables = typeof rift.serviceDeliverables === 'string'
      ? JSON.parse(rift.serviceDeliverables)
      : rift.serviceDeliverables
    const found = deliverables.filter((d: string) =>
      assets.some(a => (a.fileName || '').toLowerCase().includes(d.toLowerCase()))
    )
    completeness = deliverables.length > 0
      ? (found.length / deliverables.length) * 100
      : assets.length > 0 ? 70 : 0
  } else {
    completeness = assets.length > 0 ? 80 : 0
  }

  // Determine proof quality
  const proofQuality: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' =
    completeness >= 90 && assets.length >= 2 ? 'EXCELLENT' :
    completeness >= 70 && assets.length >= 1 ? 'GOOD' :
    completeness >= 50 ? 'FAIR' : 'POOR'

  const recommendations: string[] = []
  if (completeness < 70) {
    recommendations.push('Proof appears incomplete - verify all deliverables submitted')
  }
  if (assets.length === 0) {
    recommendations.push('No proof submitted - consider auto-refund')
  }

  return {
    summary,
    itemType: rift.itemType,
    proofQuality,
    completeness,
    recommendations,
  }
}

/**
 * Detect sensitive data in vault assets
 */
export async function detectSensitiveData(
  assetId: string
): Promise<{
  hasSensitiveData: boolean
  types: string[]
  warnings: string[]
}> {
  const asset = await prisma.vaultAsset.findUnique({
    where: { id: assetId },
    select: {
      fileName: true,
      textContent: true,
    },
  })

  if (!asset) {
    throw new Error(`Asset not found: ${assetId}`)
  }

  const text = (asset.textContent || asset.fileName || '').toLowerCase()
  const types: string[] = []
  const warnings: string[] = []

  // Detect passport
  if (text.includes('passport') || text.includes('passport number')) {
    types.push('PASSPORT')
    warnings.push('Passport information detected - auto-redact previews')
  }

  // Detect credit card
  const creditCardPattern = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/
  if (creditCardPattern.test(text)) {
    types.push('CREDIT_CARD')
    warnings.push('Credit card number detected - auto-redact previews')
  }

  // Detect SSN
  const ssnPattern = /\b\d{3}-\d{2}-\d{4}\b/
  if (ssnPattern.test(text)) {
    types.push('SSN')
    warnings.push('SSN detected - auto-redact previews')
  }

  return {
    hasSensitiveData: types.length > 0,
    types,
    warnings,
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

