/**
 * Canonical Hashing for Duplicate Detection
 * Prevents "same file slightly modified" evasion by normalizing content before hashing
 */

import { createHash } from 'crypto'
import sharp from 'sharp'

/**
 * Generate canonical hash for an image
 * Uses perceptual hashing to detect similar images even after resizing/compression
 */
export async function generateImageCanonicalHash(imageBuffer: Buffer): Promise<{
  sha256: string
  perceptualHash?: string // pHash for similarity detection
  averageHash?: string // aHash for similarity detection
}> {
  // SHA-256 of normalized image
  let normalized: Buffer
  
  try {
    // Normalize: resize to standard size, convert to RGB, strip metadata
    normalized = await sharp(imageBuffer)
      .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
      .removeAlpha()
      .toFormat('jpeg', { quality: 90 })
      .toBuffer()
  } catch (error) {
    // If processing fails, use original
    normalized = imageBuffer
  }
  
  const sha256 = createHash('sha256').update(normalized).digest('hex')
  
  // Generate perceptual hashes for similarity detection
  try {
    const { generateAllHashes } = await import('./perceptual-hashing')
    const hashes = await generateAllHashes(normalized)
    return {
      sha256,
      perceptualHash: hashes.perceptualHash,
      averageHash: hashes.averageHash,
    }
  } catch (error) {
    console.error('Perceptual hash generation failed:', error)
    return { sha256 }
  }
}

/**
 * Generate canonical hash for a PDF
 * Normalizes metadata and content structure
 */
export async function generatePDFCanonicalHash(pdfBuffer: Buffer): Promise<{
  sha256: string
  normalizedSha256?: string // Hash of rendered first page for similarity
  renderedHash?: string // Hash of first page rendered to image
}> {
  const sha256 = createHash('sha256').update(pdfBuffer).digest('hex')
  
  try {
    // Render first page to image for similarity detection
    // This allows detecting similar PDFs even if metadata differs
    const firstPageImage = await sharp(pdfBuffer, { pages: 1 })
      .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
      .toFormat('jpeg', { quality: 90 })
      .toBuffer()
    
    const renderedHash = createHash('sha256').update(firstPageImage).digest('hex')
    
    // Also generate perceptual hash of rendered page for better similarity detection
    // This helps detect PDFs that are visually similar but have different structure
    const { generateAllHashes } = await import('./perceptual-hashing')
    const perceptualHashes = await generateAllHashes(firstPageImage)
    
    // Use normalized hash (rendered page hash) for canonical comparison
    // TODO: Implement full PDF metadata stripping (requires pdf-lib or similar)
    // For now, rendered hash serves as normalization
    
    return {
      sha256,
      normalizedSha256: renderedHash,
      renderedHash, // Keep for backward compatibility
    }
  } catch (error) {
    // PDF rendering failed (might not be a valid PDF or Sharp doesn't support it)
    console.warn('PDF rendering failed, using raw hash only:', error)
    return { sha256 }
  }
}

/**
 * Generate canonical hash for text content
 * Normalizes whitespace, encoding, and line endings
 */
export function generateTextCanonicalHash(text: string): string {
  // Normalize:
  // - Convert to UTF-8
  // - Normalize line endings to \n
  // - Collapse multiple whitespace to single space
  // - Trim leading/trailing whitespace
  // - Convert to lowercase (optional, depends on use case)
  
  const normalized = text
    .normalize('NFD') // Unicode normalization
    .replace(/\r\n/g, '\n') // Windows line endings
    .replace(/\r/g, '\n') // Mac line endings
    .replace(/\n{3,}/g, '\n\n') // Collapse multiple blank lines
    .replace(/[ \t]+/g, ' ') // Collapse whitespace
    .trim()
  
  return createHash('sha256').update(normalized, 'utf8').digest('hex')
}

/**
 * Generate canonical hash for a file based on its MIME type
 */
export async function generateCanonicalHash(
  fileBuffer: Buffer,
  mimeType: string,
  fileName?: string
): Promise<{
  sha256: string
  canonicalSha256?: string
  perceptualHash?: string
}> {
  // Determine file type and apply appropriate normalization
  if (mimeType.startsWith('image/')) {
    const result = await generateImageCanonicalHash(fileBuffer)
    return {
      sha256: createHash('sha256').update(fileBuffer).digest('hex'), // Original hash
      canonicalSha256: result.sha256, // Normalized hash
      perceptualHash: result.perceptualHash,
    }
  }
  
  if (mimeType === 'application/pdf') {
    const result = await generatePDFCanonicalHash(fileBuffer)
    return {
      sha256: createHash('sha256').update(fileBuffer).digest('hex'), // Original hash
      canonicalSha256: result.normalizedSha256 || result.sha256, // Normalized hash
    }
  }
  
  if (mimeType.startsWith('text/')) {
    const text = fileBuffer.toString('utf8')
    const originalHash = createHash('sha256').update(fileBuffer).digest('hex')
    const canonicalHash = generateTextCanonicalHash(text)
    return {
      sha256: originalHash,
      canonicalSha256: canonicalHash,
    }
  }
  
  // For other types, use raw SHA-256 (no normalization available)
  return {
    sha256: createHash('sha256').update(fileBuffer).digest('hex'),
  }
}

/**
 * Check if two files are likely duplicates using canonical hashing
 * Returns similarity score (0-1, where 1 is exact match)
 */
export async function compareFilesForDuplicates(
  file1Buffer: Buffer,
  file2Buffer: Buffer,
  mimeType: string
): Promise<{
  isDuplicate: boolean
  similarity: number
  method: 'exact' | 'canonical' | 'perceptual'
}> {
  // First check exact SHA-256 match
  const hash1 = createHash('sha256').update(file1Buffer).digest('hex')
  const hash2 = createHash('sha256').update(file2Buffer).digest('hex')
  
  if (hash1 === hash2) {
    return { isDuplicate: true, similarity: 1.0, method: 'exact' }
  }
  
  // Check canonical hash
  const canonical1 = await generateCanonicalHash(file1Buffer, mimeType)
  const canonical2 = await generateCanonicalHash(file2Buffer, mimeType)
  
  if (canonical1.canonicalSha256 && canonical2.canonicalSha256) {
    if (canonical1.canonicalSha256 === canonical2.canonicalSha256) {
      return { isDuplicate: true, similarity: 0.95, method: 'canonical' }
    }
  }
  
  // TODO: Implement perceptual hash comparison for images
  // This would use Hamming distance between pHash values
  
  return { isDuplicate: false, similarity: 0.0, method: 'exact' }
}
