/**
 * Watermarking System for Sensitive Assets
 * Launch-grade approach: Viewer-first design with dynamic watermarks
 * Primary truth: Server-side controlled reveal + logging
 * Watermarking: Extra layer (overlays on render, per-session)
 */

import { createHash } from 'crypto'
import sharp from 'sharp'

export interface WatermarkData {
  transactionId: string
  riftNumber: number | null
  buyerId: string
  timestamp: Date
}

/**
 * Generate watermark text from transaction data
 */
export function generateWatermarkText(data: WatermarkData): string {
  // Create a unique, recoverable watermark string
  const watermark = `RIFT-${data.riftNumber || data.transactionId.slice(-8)}-${data.buyerId.slice(-8)}-${data.timestamp.getTime()}`
  return watermark
}

/**
 * Hash watermark for storage (used for verification)
 */
export function hashWatermark(watermarkText: string): string {
  return createHash('sha256').update(watermarkText).digest('hex')
}

/**
 * Generate dynamic watermark overlay for viewer rendering
 * This creates a visible watermark that can be overlaid on sensitive assets
 * Rendered per-session with buyer identity embedded
 */
export async function generateDynamicWatermarkOverlay(
  watermarkData: WatermarkData,
  buyerEmail: string,
  sessionId: string
): Promise<Buffer> {
  const watermarkText = `Rift #${watermarkData.riftNumber || 'N/A'} | ${buyerEmail} | ${sessionId.substring(0, 8)}`
  
  // Create watermark image overlay
  const svg = `
    <svg width="400" height="100" xmlns="http://www.w3.org/2000/svg">
      <rect width="400" height="100" fill="rgba(0,0,0,0.7)" rx="5"/>
      <text x="200" y="50" font-family="Arial" font-size="12" fill="white" text-anchor="middle" opacity="0.8">
        ${watermarkText}
      </text>
    </svg>
  `
  
  return Buffer.from(svg)
}

/**
 * Apply watermark overlay to image for viewer display
 * NOTE: This should be done server-side when serving to viewer
 * NOT stored in vault (original remains unmodified)
 */
export async function applyWatermarkOverlayToImage(
  imageBuffer: Buffer,
  overlayBuffer: Buffer
): Promise<Buffer> {
  try {
    // Composite watermark overlay on image (bottom right corner)
    const watermarked = await sharp(imageBuffer)
      .composite([
        {
          input: overlayBuffer,
          gravity: 'southeast',
        },
      ])
      .toBuffer()
    
    return watermarked
  } catch (error) {
    console.error('Watermark overlay error:', error)
    return imageBuffer // Return original on error
  }
}

/**
 * Add invisible watermark to stored image (backup layer)
 * NOTE: This is a secondary measure - primary protection is viewer-first design
 * EXIF and LSB are NOT bulletproof (easily stripped/destroyed)
 * This is stored in vault as extra layer only
 */
export async function watermarkImage(
  imageBuffer: Buffer,
  watermarkData: WatermarkData
): Promise<Buffer> {
  try {
    const watermarkText = generateWatermarkText(watermarkData)
    
    // Add watermark as EXIF metadata (easily stripped, but better than nothing)
    const watermarked = await sharp(imageBuffer)
      .withMetadata({
        exif: {
          IFD0: {
            Copyright: watermarkText,
            Artist: `Rift-${watermarkData.riftNumber}`,
          },
        },
      })
      .toBuffer()
    
    // Note: LSB steganography removed - too fragile (destroyed by re-encoding/resizing)
    // Primary protection: viewer-first design with server-side controlled reveal
    
    return watermarked
  } catch (error) {
    console.error('Watermarking error:', error)
    return imageBuffer
  }
}

/**
 * Extract watermark from image (for verification)
 */
export async function extractWatermark(imageBuffer: Buffer): Promise<string | null> {
  try {
    // Try to extract from metadata first
    const metadata = await sharp(imageBuffer).metadata()
    if (metadata.exif) {
      // Parse EXIF data
      // Note: Sharp's metadata extraction is limited, may need exif-parser library
      // For now, return null and rely on hash-based detection
    }
    
    // Extract from LSB steganography
    const pixels = await sharp(imageBuffer)
      .raw()
      .toBuffer({ resolveWithObject: true })
    
    const pixelData = pixels.data
    const channels = pixels.info.channels
    
    // Read LSB from last channel (assuming 32-char watermark = 256 bits)
    const watermarkBits: string[] = []
    const maxLength = Math.min(256, pixelData.length / channels)
    
    for (let i = 0; i < maxLength; i++) {
      const pixelIndex = i * channels + (channels - 1)
      if (pixelIndex < pixelData.length) {
        const bit = pixelData[pixelIndex] & 0x01 // Get LSB
        watermarkBits.push(bit.toString())
      }
    }
    
    // Convert binary to text
    const binaryString = watermarkBits.join('')
    const chars: string[] = []
    
    for (let i = 0; i < binaryString.length; i += 8) {
      const byte = binaryString.substring(i, i + 8)
      if (byte.length === 8) {
        const charCode = parseInt(byte, 2)
        if (charCode >= 32 && charCode <= 126) { // Printable ASCII
          chars.push(String.fromCharCode(charCode))
        }
      }
    }
    
    const watermarkText = chars.join('')
    
    // Verify watermark format
    if (watermarkText.startsWith('RIFT-')) {
      return watermarkText
    }
    
    return null
  } catch (error) {
    console.error('Watermark extraction error:', error)
    return null
  }
}

/**
 * Watermark PDF (for ticket PDFs)
 * Adds invisible watermark as PDF metadata and text layer
 */
export async function watermarkPDF(
  pdfBuffer: Buffer,
  watermarkData: WatermarkData
): Promise<Buffer> {
  // PDF watermarking requires specialized libraries like pdf-lib or HummusJS
  // For now, return original and add metadata watermark
  // TODO: Implement proper PDF watermarking
  
  const watermarkText = generateWatermarkText(watermarkData)
  
  // Store watermark hash in database for verification
  // The PDF itself will need to be processed with a proper PDF library
  
  console.warn('PDF watermarking not fully implemented, storing hash only')
  return pdfBuffer
}

/**
 * Verify asset watermark matches transaction
 */
export async function verifyWatermark(
  assetBuffer: Buffer,
  expectedWatermarkData: WatermarkData,
  assetType: 'image' | 'pdf'
): Promise<{ valid: boolean; watermarkFound: boolean; extractedWatermark?: string }> {
  const expectedWatermark = generateWatermarkText(expectedWatermarkData)
  
  if (assetType === 'image') {
    const extracted = await extractWatermark(assetBuffer)
    if (!extracted) {
      return { valid: false, watermarkFound: false }
    }
    
    return {
      valid: extracted.includes(expectedWatermark) || extracted.includes(expectedWatermarkData.transactionId),
      watermarkFound: true,
      extractedWatermark: extracted,
    }
  }
  
  // PDF verification would go here
  return { valid: false, watermarkFound: false }
}
