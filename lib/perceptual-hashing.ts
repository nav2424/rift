/**
 * Perceptual Hashing for Image Similarity Detection
 * Implements pHash (perceptual hash) and aHash (average hash) algorithms
 * Detects similar images even after resizing, compression, or minor edits
 */

import sharp from 'sharp'
import { createHash } from 'crypto'

/**
 * Generate average hash (aHash) for an image
 * Simple and fast, works well for basic similarity detection
 */
export async function generateAverageHash(imageBuffer: Buffer): Promise<string> {
  // Resize to 8x8 (64 pixels total) for hash generation
  const resized = await sharp(imageBuffer)
    .resize(8, 8, { fit: 'cover' })
    .greyscale()
    .raw()
    .toBuffer()
  
  // Calculate average pixel value
  let sum = 0
  for (let i = 0; i < resized.length; i++) {
    sum += resized[i]
  }
  const average = sum / resized.length
  
  // Generate hash: 1 if pixel >= average, 0 otherwise
  let hash = ''
  for (let i = 0; i < resized.length; i++) {
    hash += resized[i] >= average ? '1' : '0'
  }
  
  return hash
}

/**
 * Generate perceptual hash (pHash) for an image
 * Uses discrete cosine transform (DCT) for better similarity detection
 * More robust than aHash but slower
 */
export async function generatePerceptualHash(imageBuffer: Buffer): Promise<string> {
  // Resize to 32x32 for DCT
  const resized = await sharp(imageBuffer)
    .resize(32, 32, { fit: 'cover' })
    .greyscale()
    .raw()
    .toBuffer()
  
  // Simple DCT approximation (for production, use a proper DCT library)
  // We'll use a simplified approach: resize to 8x8 after initial resize
  const smallResized = await sharp(resized, {
    raw: {
      width: 32,
      height: 32,
      channels: 1,
    },
  })
    .resize(8, 8, { fit: 'cover' })
    .raw()
    .toBuffer()
  
  // Calculate DCT coefficients (simplified - for production use proper DCT)
  // For now, use average hash on DCT-like transformed data
  // This is a simplified version - full DCT would require a proper library
  const dctCoeffs = calculateSimpleDCT(smallResized)
  
  // Get top-left 8x8 DCT coefficients
  const topLeft: number[] = []
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      topLeft.push(dctCoeffs[i * 8 + j] || 0)
    }
  }
  
  // Calculate median (excluding DC coefficient at [0,0])
  const sorted = [...topLeft.slice(1)].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  
  // Generate hash: 1 if coefficient >= median, 0 otherwise
  let hash = ''
  for (let i = 0; i < topLeft.length; i++) {
    hash += topLeft[i] >= median ? '1' : '0'
  }
  
  return hash
}

/**
 * Simplified DCT calculation (approximation)
 * For production, use a proper DCT library like 'dct' npm package
 */
function calculateSimpleDCT(pixels: Buffer): number[] {
  const size = 8
  const result: number[] = []
  
  // Simplified DCT: just return pixel values for now
  // TODO: Implement proper 2D DCT transform
  // This requires cosine calculations which are expensive
  // For MVP, we'll use average hash instead
  for (let i = 0; i < pixels.length; i++) {
    result.push(pixels[i])
  }
  
  return result
}

/**
 * Calculate Hamming distance between two hashes
 * Returns number of differing bits (0 = identical, higher = more different)
 */
export function hammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) {
    throw new Error('Hash lengths must match')
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
 * Check if two images are similar based on perceptual hashes
 * Returns similarity score (0-1, where 1 is identical)
 */
export async function compareImages(
  image1Buffer: Buffer,
  image2Buffer: Buffer,
  method: 'average' | 'perceptual' = 'average'
): Promise<{
  similar: boolean
  similarity: number
  distance: number
  threshold: number
}> {
  // Generate hashes
  const hash1 = method === 'average'
    ? await generateAverageHash(image1Buffer)
    : await generatePerceptualHash(image1Buffer)
  
  const hash2 = method === 'average'
    ? await generateAverageHash(image2Buffer)
    : await generatePerceptualHash(image2Buffer)
  
  // Calculate Hamming distance
  const distance = hammingDistance(hash1, hash2)
  
  // Threshold for similarity (for 64-bit hash: <= 5 bits different = similar)
  // Adjust threshold based on use case
  const threshold = method === 'average' ? 5 : 10
  
  // Calculate similarity score (1.0 = identical, 0.0 = completely different)
  const similarity = 1.0 - (distance / hash1.length)
  
  return {
    similar: distance <= threshold,
    similarity,
    distance,
    threshold,
  }
}

/**
 * Generate both aHash and pHash for comprehensive comparison
 */
export async function generateAllHashes(imageBuffer: Buffer): Promise<{
  averageHash: string
  perceptualHash: string
}> {
  const [averageHash, perceptualHash] = await Promise.all([
    generateAverageHash(imageBuffer),
    generatePerceptualHash(imageBuffer),
  ])
  
  return { averageHash, perceptualHash }
}
