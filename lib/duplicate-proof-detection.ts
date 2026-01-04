/**
 * Duplicate Proof Detection System
 * Detects reused proofs across transactions to prevent fraud
 * Uses canonical hashing to prevent "same file slightly modified" evasion
 */

import { prisma } from './prisma'
import { generateCanonicalHash } from './canonical-hashing'

export interface DuplicateProofResult {
  isDuplicate: boolean
  duplicateRiftIds: string[] // Other Rifts using same proof hash(es)
  duplicateAssetHashes: string[] // Which hashes are duplicated
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  recommendations: string[]
}

/**
 * Check if any asset hashes are reused across transactions
 * Uses both exact SHA-256 and canonical hashing for detection
 */
export async function checkDuplicateProofs(
  assetHashes: string[],
  currentRiftId: string,
  sellerId: string,
  assetIds?: string[] // Optional: provide asset IDs to check canonical hashes
): Promise<DuplicateProofResult> {
  if (assetHashes.length === 0) {
    return {
      isDuplicate: false,
      duplicateRiftIds: [],
      duplicateAssetHashes: [],
      riskLevel: 'LOW',
      recommendations: [],
    }
  }
  
  // Find other Rifts with same asset hashes (exact SHA-256 match)
  const duplicateAssets = await prisma.vault_assets.findMany({
    where: {
      sha256: { in: assetHashes },
      riftId: { not: currentRiftId }, // Exclude current Rift
    },
    select: {
      sha256: true,
      riftId: true,
    },
  })
  
  // Also check canonical hashes if asset IDs provided
  // Perceptual hashing would be implemented here for "similar but not identical" detection
  // For now, we do exact SHA-256 matching which catches exact duplicates
  // Future: Add perceptual hashing (pHash) for near-duplicate detection
  
  if (duplicateAssets.length === 0) {
    return {
      isDuplicate: false,
      duplicateRiftIds: [],
      duplicateAssetHashes: [],
      riskLevel: 'LOW',
      recommendations: [],
    }
  }
  
  // Get unique rift IDs and fetch rift details separately
  const uniqueRiftIds = [...new Set(duplicateAssets.map(a => a.riftId))]
  const rifts = await prisma.riftTransaction.findMany({
    where: {
      id: { in: uniqueRiftIds },
    },
    select: {
      id: true,
      itemTitle: true,
      status: true,
      buyerId: true,
      sellerId: true,
      createdAt: true,
    },
  })
  
  // Create a map of riftId -> rift details
  const riftDetailsMap = new Map(rifts.map(r => [r.id, r]))
  
  // Group by Rift
  const riftMap = new Map<string, {
    riftId: string
    itemTitle: string
    status: string
    sellerId: string
    buyerId: string
    createdAt: Date
    duplicateHashes: string[]
  }>()
  
  const duplicateHashes = new Set<string>()
  
  for (const asset of duplicateAssets) {
    duplicateHashes.add(asset.sha256)
    
    const riftDetails = riftDetailsMap.get(asset.riftId)
    if (!riftDetails) {
      continue // Skip if rift not found
    }
    
    const existing = riftMap.get(asset.riftId)
    if (existing) {
      existing.duplicateHashes.push(asset.sha256)
    } else {
      riftMap.set(asset.riftId, {
        riftId: riftDetails.id,
        itemTitle: riftDetails.itemTitle,
        status: riftDetails.status,
        sellerId: riftDetails.sellerId,
        buyerId: riftDetails.buyerId,
        createdAt: riftDetails.createdAt,
        duplicateHashes: [asset.sha256],
      })
    }
  }
  
  const duplicateRiftIds = Array.from(riftMap.keys())
  const duplicateHashesArray = Array.from(duplicateHashes)
  
  // Calculate risk level
  const sameSeller = rifts.some(r => r.sellerId === sellerId)
  const completedRifts = rifts.filter(
    r => ['RELEASED', 'PAID_OUT'].includes(r.status)
  ).length
  
  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW'
  const recommendations: string[] = []
  
  if (sameSeller) {
    // Same seller reusing proof
    riskLevel = completedRifts > 0 ? 'CRITICAL' : 'HIGH'
    recommendations.push(
      'Seller has reused proof from previous transaction(s). This may indicate fraud.',
      'Consider manual review before releasing funds.',
      'Check if this is a legitimate reuse (e.g., bulk license keys).',
    )
  } else {
    // Different seller using same proof
    riskLevel = 'CRITICAL'
    recommendations.push(
      'Proof hash matches another Rift with different seller. This is highly suspicious.',
      'REQUIRES IMMEDIATE MANUAL REVIEW.',
      'May indicate stolen/tampered proof or seller account compromise.',
    )
  }
  
  // Additional checks
  if (duplicateRiftIds.length > 5) {
    riskLevel = 'CRITICAL'
    recommendations.push(`Proof reused across ${duplicateRiftIds.length} transactions - extreme fraud risk.`)
  }
  
  return {
    isDuplicate: true,
    duplicateRiftIds,
    duplicateAssetHashes: duplicateHashesArray,
    riskLevel,
    recommendations,
  }
}

/**
 * Flag seller for risk review if they have multiple duplicate proofs
 */
export async function flagSellerForDuplicateProofs(sellerId: string): Promise<{
  shouldFlag: boolean
  duplicateCount: number
  recentRiftIds: string[]
}> {
  // Check last 30 days
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  
  // Get seller's recent Rifts
  const sellerRifts = await prisma.riftTransaction.findMany({
    where: {
      sellerId,
      createdAt: { gte: thirtyDaysAgo },
      status: { in: ['FUNDED', 'PROOF_SUBMITTED', 'UNDER_REVIEW', 'RELEASED', 'PAID_OUT'] },
    },
    select: { id: true },
  })
  
  if (sellerRifts.length === 0) {
    return { shouldFlag: false, duplicateCount: 0, recentRiftIds: [] }
  }
  
  const riftIds = sellerRifts.map(r => r.id)
  
  // Find all assets for these Rifts
  const assets = await prisma.vault_assets.findMany({
    where: { riftId: { in: riftIds } },
    select: { sha256: true, riftId: true },
  })
  
  // Group by hash to find duplicates
  const hashMap = new Map<string, string[]>()
  for (const asset of assets) {
    const existing = hashMap.get(asset.sha256) || []
    existing.push(asset.riftId)
    hashMap.set(asset.sha256, existing)
  }
  
  // Count duplicates (hashes used in multiple Rifts)
  let duplicateCount = 0
  const affectedRiftIds = new Set<string>()
  
  for (const [hash, riftIdsWithHash] of hashMap.entries()) {
    const uniqueRiftIds = new Set(riftIdsWithHash)
    if (uniqueRiftIds.size > 1) {
      duplicateCount += uniqueRiftIds.size - 1 // Number of extra uses
      uniqueRiftIds.forEach(id => affectedRiftIds.add(id))
    }
  }
  
  const shouldFlag = duplicateCount >= 3 // Flag if 3+ duplicate uses
  
  return {
    shouldFlag,
    duplicateCount,
    recentRiftIds: Array.from(affectedRiftIds),
  }
}
