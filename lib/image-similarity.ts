/**
 * Image Similarity Detection for Visual Duplicate Detection
 * Uses perceptual hashing and feature extraction for similarity matching
 */

import { createServerClient } from './supabase'
import { prisma } from './prisma'
import { createHash } from 'crypto'

/**
 * Generate perceptual hash for image similarity detection
 * Uses average hash algorithm (simplified perceptual hash)
 */
async function generatePerceptualHash(buffer: Buffer): Promise<string> {
  try {
    // Dynamic import to avoid issues
    const sharp = (await import('sharp')).default
    // Resize to 8x8 for hash generation
    const resized = await sharp(buffer)
      .resize(8, 8, { fit: 'fill' })
      .greyscale()
      .raw()
      .toBuffer()
    
    // Calculate average pixel value
    let sum = 0
    for (let i = 0; i < resized.length; i++) {
      sum += resized[i]
    }
    const avg = sum / resized.length
    
    // Generate hash: 1 if pixel > average, 0 otherwise
    let hash = ''
    for (let i = 0; i < resized.length; i++) {
      hash += resized[i] > avg ? '1' : '0'
    }
    
    return hash
  } catch (error) {
    throw new Error(`Failed to generate perceptual hash: ${error}`)
  }
}

/**
 * Calculate Hamming distance between two hashes
 * Lower distance = more similar
 */
function hammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) {
    throw new Error('Hashes must be the same length')
  }
  
  let distance = 0
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) {
      distance++
    }
  }
  
  return distance
}

/**
 * Convert Hamming distance to similarity score (0-1)
 * Distance 0 = 1.0 similarity, distance 64 = 0.0 similarity
 */
function distanceToSimilarity(distance: number, maxDistance: number = 64): number {
  return Math.max(0, 1 - (distance / maxDistance))
}

/**
 * Generate image fingerprint (combination of hash + features)
 */
async function generateImageFingerprint(buffer: Buffer): Promise<{
  perceptualHash: string
  features: {
    width: number
    height: number
    aspectRatio: number
    averageColor: { r: number; g: number; b: number }
    dominantColors?: Array<{ r: number; g: number; b: number }>
  }
}> {
  const sharp = (await import('sharp')).default
  const metadata = await sharp(buffer).metadata()
  const stats = await sharp(buffer).stats()
  
  // Calculate average color
  const channels = stats.channels
  const avgColor = {
    r: Math.round(channels[0]?.mean || 0),
    g: Math.round(channels[1]?.mean || 0),
    b: Math.round(channels[2]?.mean || 0),
  }
  
  const width = metadata.width || 0
  const height = metadata.height || 0
  const aspectRatio = width > 0 && height > 0 ? width / height : 1
  
  // Generate perceptual hash
  const perceptualHash = await generatePerceptualHash(buffer)
  
  return {
    perceptualHash,
    features: {
      width,
      height,
      aspectRatio,
      averageColor: avgColor,
    },
  }
}

/**
 * Calculate similarity between two image fingerprints
 */
function calculateFingerprintSimilarity(
  fp1: Awaited<ReturnType<typeof generateImageFingerprint>>,
  fp2: Awaited<ReturnType<typeof generateImageFingerprint>>
): number {
  // Perceptual hash similarity (weight: 70%)
  const hashDistance = hammingDistance(fp1.perceptualHash, fp2.perceptualHash)
  const hashSimilarity = distanceToSimilarity(hashDistance)
  
  // Aspect ratio similarity (weight: 15%)
  const aspectRatioDiff = Math.abs(fp1.features.aspectRatio - fp2.features.aspectRatio)
  const aspectRatioSimilarity = Math.max(0, 1 - aspectRatioDiff / 2) // Normalize
  
  // Color similarity (weight: 15%)
  const colorDistance = Math.sqrt(
    Math.pow(fp1.features.averageColor.r - fp2.features.averageColor.r, 2) +
    Math.pow(fp1.features.averageColor.g - fp2.features.averageColor.g, 2) +
    Math.pow(fp1.features.averageColor.b - fp2.features.averageColor.b, 2)
  )
  const maxColorDistance = Math.sqrt(3 * Math.pow(255, 2))
  const colorSimilarity = Math.max(0, 1 - colorDistance / maxColorDistance)
  
  // Weighted combination
  const overallSimilarity = 
    hashSimilarity * 0.7 +
    aspectRatioSimilarity * 0.15 +
    colorSimilarity * 0.15
  
  return overallSimilarity
}

/**
 * Get or generate image fingerprint for a vault asset
 */
export async function getImageFingerprint(assetId: string): Promise<{
  perceptualHash: string
  features: any
} | null> {
  try {
    const asset = await prisma.vault_assets.findUnique({
      where: { id: assetId },
      select: {
        id: true,
        storagePath: true,
        metadataJson: true,
      },
    })
    
    if (!asset || !asset.storagePath) {
      return null
    }
    
    // Check if fingerprint is cached in metadata
    const metadata = asset.metadataJson as any
    if (metadata?.imageFingerprint) {
      return metadata.imageFingerprint
    }
    
    // Generate fingerprint
    const supabase = createServerClient()
    const { data, error } = await supabase.storage
      .from('rift-vault')
      .download(asset.storagePath)
    
    if (error || !data) {
      return null
    }
    
    const buffer = Buffer.from(await data.arrayBuffer())
    const fingerprint = await generateImageFingerprint(buffer)
    
    // Cache fingerprint in metadata
    await prisma.vault_assets.update({
      where: { id: assetId },
      data: {
        metadataJson: {
          ...metadata,
          imageFingerprint: fingerprint,
        },
      },
    })
    
    return fingerprint
  } catch (error) {
    console.error('Error generating image fingerprint:', error)
    return null
  }
}

/**
 * Find visually similar images
 */
export async function findSimilarImages(
  assetId: string,
  threshold: number = 0.85 // Similarity threshold (0-1)
): Promise<Array<{
  assetId: string
  riftId: string
  similarity: number
  uploaderId: string
}>> {
  try {
    const currentFingerprint = await getImageFingerprint(assetId)
    if (!currentFingerprint) {
      return []
    }
    
    const currentAsset = await prisma.vault_assets.findUnique({
      where: { id: assetId },
      select: { uploaderId: true, riftId: true },
    })
    
    if (!currentAsset) {
      return []
    }
    
    // Get all other image assets
    const allAssets = await prisma.vault_assets.findMany({
      where: {
        assetType: { in: ['FILE', 'TICKET_PROOF'] },
        mimeDetected: { startsWith: 'image/' },
        id: { not: assetId },
        storagePath: { not: null },
      },
      select: {
        id: true,
        riftId: true,
        uploaderId: true,
        metadataJson: true,
      },
    })
    
    const similarImages: Array<{
      assetId: string
      riftId: string
      similarity: number
      uploaderId: string
    }> = []
    
    for (const asset of allAssets) {
      const fingerprint = await getImageFingerprint(asset.id)
      if (!fingerprint) continue
      
      const similarity = calculateFingerprintSimilarity(currentFingerprint, fingerprint)
      
      if (similarity >= threshold) {
        similarImages.push({
          assetId: asset.id,
          riftId: asset.riftId,
          similarity,
          uploaderId: asset.uploaderId,
        })
      }
    }
    
    // Sort by similarity (highest first)
    return similarImages.sort((a, b) => b.similarity - a.similarity)
  } catch (error) {
    console.error('Error finding similar images:', error)
    return []
  }
}

/**
 * Analyze seller's image style consistency
 */
export async function analyzeSellerImageStyle(
  uploaderId: string,
  currentAssetId: string
): Promise<{
  consistent: boolean
  averageSimilarity: number
  styleDeviation: number
  issues: string[]
}> {
  try {
    const currentFingerprint = await getImageFingerprint(currentAssetId)
    if (!currentFingerprint) {
      return {
        consistent: true,
        averageSimilarity: 0,
        styleDeviation: 0,
        issues: ['Could not generate fingerprint for current image'],
      }
    }
    
    // Get seller's previous image assets
    const previousAssets = await prisma.vault_assets.findMany({
      where: {
        uploaderId,
        id: { not: currentAssetId },
        assetType: { in: ['FILE', 'TICKET_PROOF'] },
        mimeDetected: { startsWith: 'image/' },
        storagePath: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      take: 10, // Last 10 submissions
      select: {
        id: true,
        metadataJson: true,
      },
    })
    
    if (previousAssets.length === 0) {
      return {
        consistent: true,
        averageSimilarity: 0,
        styleDeviation: 0,
        issues: [],
      }
    }
    
    const similarities: number[] = []
    
    for (const asset of previousAssets) {
      const fingerprint = await getImageFingerprint(asset.id)
      if (!fingerprint) continue
      
      const similarity = calculateFingerprintSimilarity(currentFingerprint, fingerprint)
      similarities.push(similarity)
    }
    
    if (similarities.length === 0) {
      return {
        consistent: true,
        averageSimilarity: 0,
        styleDeviation: 0,
        issues: [],
      }
    }
    
    // Calculate statistics
    const averageSimilarity = similarities.reduce((a, b) => a + b, 0) / similarities.length
    const variance = similarities.reduce((sum, sim) => {
      return sum + Math.pow(sim - averageSimilarity, 2)
    }, 0) / similarities.length
    const styleDeviation = Math.sqrt(variance)
    
    // Determine consistency (low deviation = consistent style)
    const consistent = styleDeviation < 0.2 && averageSimilarity > 0.5
    
    const issues: string[] = []
    if (!consistent) {
      if (styleDeviation >= 0.2) {
        issues.push(`High style deviation detected (${styleDeviation.toFixed(2)})`)
      }
      if (averageSimilarity <= 0.5) {
        issues.push(`Low average similarity with previous submissions (${averageSimilarity.toFixed(2)})`)
      }
    }
    
    return {
      consistent,
      averageSimilarity,
      styleDeviation,
      issues,
    }
  } catch (error) {
    console.error('Error analyzing seller image style:', error)
    return {
      consistent: true,
      averageSimilarity: 0,
      styleDeviation: 0,
      issues: ['Analysis failed'],
    }
  }
}

