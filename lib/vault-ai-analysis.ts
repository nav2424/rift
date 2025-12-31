/**
 * AI-Powered Vault Asset Quality Analysis
 * Uses OpenAI Vision API for comprehensive image analysis, OCR, and quality assessment
 */

import OpenAI from 'openai'
import { createServerClient } from './supabase'
import { VaultAsset, VaultAssetType } from '@prisma/client'
import { prisma } from './prisma'
import sharp from 'sharp'
import { findSimilarImages, analyzeSellerImageStyle } from './image-similarity'
// Use require for CommonJS module
const exifReader = require('exif-reader')

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface ExtractedData {
  // Data extraction
  trackingNumbers?: string[]
  trackingCarriers?: string[]
  monetaryAmounts?: { value: number; currency?: string; confidence: number }[]
  dates?: { value: string; type?: 'receipt_date' | 'transfer_date' | 'ship_date' | 'delivery_date' | 'event_date'; confidence: number }[]
  orderIds?: string[]
  ticketNumbers?: string[]
  confirmationCodes?: string[]
  licenseKeys?: string[]
  shippingAddresses?: string[]
  qrCodes?: { data: string; confidence: number }[]
  barcodes?: { data: string; type?: string; confidence: number }[]
  
  // Confidence scores per field
  confidenceScores: {
    tracking?: number
    amounts?: number
    dates?: number
    orderIds?: number
    ticketNumbers?: number
    addresses?: number
  }
}

export interface ImageAnalysisResult {
  // Image classification
  isRelevant: boolean
  category?: string
  documentType?: string // More granular: "ticketmaster_screenshot", "ups_label", "steam_key", etc.
  
  // OCR results
  extractedText?: string
  textConfidence?: number
  
  // Data extraction
  extractedData?: ExtractedData
  
  // Quality metrics
  isReadable: boolean
  qualityIssues: string[]
  clarityScore?: number
  
  // Content verification
  containsExpectedElements: boolean
  suspiciousElements?: string[]
  
  // Authenticity checks
  isScreenshot?: boolean // Detected as screenshot vs original
  screenshotConfidence?: number
  exifData?: {
    present: boolean
    location?: { lat?: number; lon?: number }
    device?: string
    timestamp?: Date
    wasStripped?: boolean
  }
  
  // Visual analysis
  visualEmbedding?: number[] // For duplicate detection
  
  // Timestamp verification
  timestampAnalysis?: {
    extractedDates: Date[]
    isRecent: boolean // Within last 30 days
    isFuture: boolean
    matchesSubmissionTime: boolean // Dates match proof submission time window
    issues: string[]
  }
  
  // Amount validation
  amountValidation?: {
    extractedAmounts: number[]
    matchesRiftAmount: boolean
    variancePercent: number
    currencyMatch: boolean
    issues: string[]
  }
  
  // Logo/branding detection
  detectedBrands?: string[] // e.g., ["Ticketmaster", "UPS", "FedEx"]
  brandConfidence?: number
  
  // Language detection
  detectedLanguage?: string
  languageConfidence?: number
  
  // Overall assessment
  qualityScore: number
  shouldRouteToReview: boolean
  reasons: string[]
}

/**
 * Download file from Supabase storage and convert to base64
 */
async function getFileAsBase64(storagePath: string): Promise<string> {
  const supabase = createServerClient()
  
  const { data, error } = await supabase.storage
    .from('rift-vault')
    .download(storagePath)
  
  if (error || !data) {
    throw new Error(`Failed to download file: ${error?.message || 'Unknown error'}`)
  }
  
  const arrayBuffer = await data.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const base64 = buffer.toString('base64')
  
  const extension = storagePath.split('.').pop()?.toLowerCase()
  const mimeType = 
    extension === 'png' ? 'image/png' :
    extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg' :
    extension === 'gif' ? 'image/gif' :
    extension === 'webp' ? 'image/webp' :
    'image/jpeg'
  
  return `data:${mimeType};base64,${base64}`
}

/**
 * Extract EXIF metadata from image
 */
async function extractEXIFData(storagePath: string): Promise<ImageAnalysisResult['exifData']> {
  try {
    const supabase = createServerClient()
    const { data, error } = await supabase.storage
      .from('rift-vault')
      .download(storagePath)
    
    if (error || !data) {
      return { present: false, wasStripped: true }
    }
    
    const buffer = Buffer.from(await data.arrayBuffer())
    const metadata = await sharp(buffer).metadata()
    const exif = metadata.exif ? exifReader(metadata.exif) : null
    
    if (!exif) {
      return { present: false, wasStripped: true }
    }
    
    return {
      present: true,
      location: exif.GPS ? {
        lat: exif.GPS.GPSLatitude,
        lon: exif.GPS.GPSLongitude,
      } : undefined,
      device: exif.Image?.Make || exif.Image?.Model || undefined,
      timestamp: exif.Exif?.DateTimeOriginal ? new Date(exif.Exif.DateTimeOriginal) : undefined,
      wasStripped: false,
    }
  } catch (error) {
    // EXIF extraction failed - likely no EXIF data
    return { present: false, wasStripped: true }
  }
}

/**
 * Get visual embedding for duplicate detection
 * Uses image similarity fingerprinting
 */
async function getVisualEmbedding(assetId: string): Promise<number[] | undefined> {
  try {
    // Get image fingerprint (converted to simple numeric representation)
    // This is a placeholder - full implementation uses findSimilarImages
    return undefined
  } catch (error) {
    return undefined
  }
}

/**
 * Validate extracted data against Rift transaction data
 */
async function validateExtractedData(
  extractedData: ExtractedData,
  rift: {
    subtotal: number
    currency: string
    itemType: string
  },
  riftId: string,
  assetCreatedAt: Date
): Promise<{
  timestampAnalysis?: ImageAnalysisResult['timestampAnalysis']
  amountValidation?: ImageAnalysisResult['amountValidation']
}> {
  const validations: any = {}
  
  // Timestamp validation (for Digital, Tickets, Services only - no physical items)
  if (extractedData.dates && extractedData.dates.length > 0) {
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    
    // Parse dates with their types
    const parsedDates = extractedData.dates
      .map(d => {
        try {
          const dateValue = new Date(d.value)
          if (isNaN(dateValue.getTime())) return null
          return {
            date: dateValue,
            type: d.type,
            confidence: d.confidence || 1,
          }
        } catch {
          return null
        }
      })
      .filter((d): d is { date: Date; type?: "receipt_date" | "transfer_date" | "ship_date" | "delivery_date" | "event_date"; confidence: number } => d !== null)
    
    const extractedDates = parsedDates.map(d => d.date)
    const isRecent = extractedDates.some(d => d >= thirtyDaysAgo)
    
    // Check for future dates (excluding event dates which are expected to be future for tickets)
    const nonEventDates = parsedDates.filter(d => d.type !== 'event_date')
    const isFuture = nonEventDates.some(d => d.date > now)
    
    // Check if dates match submission time
    // Event dates: no submission time check needed (can be in future)
    // Receipt/transfer dates: should be within 7 days of submission
    let matchesSubmissionTime = false
    for (const parsed of parsedDates) {
      if (parsed.type === 'event_date') {
        // Event dates don't need to match submission time (can be future)
        matchesSubmissionTime = true
        break
      }
      
      // For receipt/transfer dates, check if within 7 days of submission
      const windowMs = 7 * 24 * 60 * 60 * 1000  // 7 days
      const diff = Math.abs(parsed.date.getTime() - assetCreatedAt.getTime())
      if (diff <= windowMs) {
        matchesSubmissionTime = true
        break
      }
    }
    
    const issues: string[] = []
    
    // Flag future dates (unless they're event dates for tickets)
    if (isFuture) {
      issues.push('Future dates detected in image (excluding event dates)')
    }
    
    // Check date reasonableness for receipt/transfer dates
    const receiptDates = parsedDates.filter(d => 
      d.type === 'receipt_date' || d.type === 'transfer_date' || d.type === 'delivery_date'
    )
    
    if (receiptDates.length > 0) {
      const receiptDatesRecent = receiptDates.some(d => d.date >= thirtyDaysAgo)
      const receiptMatchesSubmission = receiptDates.some(d => {
        const diff = Math.abs(d.date.getTime() - assetCreatedAt.getTime())
        return diff <= 7 * 24 * 60 * 60 * 1000
      })
      
      if (!receiptDatesRecent && !receiptMatchesSubmission) {
        issues.push('Receipt/transfer dates in image are too old or don\'t match submission time')
      }
    }
    
    validations.timestampAnalysis = {
      extractedDates,
      isRecent,
      isFuture,
      matchesSubmissionTime,
      issues,
    }
  }
  
  // Amount validation
  if (extractedData.monetaryAmounts && extractedData.monetaryAmounts.length > 0) {
    const amounts = extractedData.monetaryAmounts.map(a => a.value)
    const closestAmount = amounts.reduce((prev, curr) => {
      return Math.abs(curr - rift.subtotal) < Math.abs(prev - rift.subtotal) ? curr : prev
    }, amounts[0])
    
    const variance = Math.abs(closestAmount - rift.subtotal)
    const variancePercent = (variance / rift.subtotal) * 100
    
    // Allow up to 5% variance (for fees, rounding, etc.)
    const matchesRiftAmount = variancePercent <= 5
    const currencyMatch = extractedData.monetaryAmounts.some(a => 
      !a.currency || a.currency.toUpperCase() === rift.currency.toUpperCase()
    )
    
    const issues: string[] = []
    if (!matchesRiftAmount) {
      issues.push(`Amount mismatch: extracted ${closestAmount} vs Rift amount ${rift.subtotal} (${variancePercent.toFixed(1)}% difference)`)
    }
    if (!currencyMatch) {
      issues.push('Currency mismatch detected')
    }
    
    validations.amountValidation = {
      extractedAmounts: amounts,
      matchesRiftAmount,
      variancePercent,
      currencyMatch,
      issues,
    }
  }
  
  // Note: Tracking and shipping address validation skipped - Rift doesn't handle physical items initially
  // Code kept for future use but validation is disabled
  
  return validations
}

/**
 * Check seller history for pattern analysis with image similarity
 */
async function analyzeSellerHistory(
  uploaderId: string,
  currentAsset: VaultAsset
): Promise<{
  previousSubmissions: number
  similarBackgrounds: number
  consistentStyle: boolean
  patternChange: boolean
  issues: string[]
  styleAnalysis?: {
    averageSimilarity: number
    styleDeviation: number
  }
}> {
  try {
    // Use enhanced seller image style analysis
    if (currentAsset.mimeDetected?.startsWith('image/') && currentAsset.storagePath) {
      const styleAnalysis = await analyzeSellerImageStyle(uploaderId, currentAsset.id)
      
      const issues: string[] = []
      if (!styleAnalysis.consistent) {
        issues.push(...styleAnalysis.issues)
      }
      
      return {
        previousSubmissions: 0, // Will be filled by styleAnalysis
        similarBackgrounds: 0,
        consistentStyle: styleAnalysis.consistent,
        patternChange: styleAnalysis.styleDeviation > 0.3,
        issues,
        styleAnalysis: {
          averageSimilarity: styleAnalysis.averageSimilarity,
          styleDeviation: styleAnalysis.styleDeviation,
        },
      }
    }
    
    // Fallback for non-image assets
    const previousAssets = await prisma.vaultAsset.findMany({
      where: {
        uploaderId,
        id: { not: currentAsset.id },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        createdAt: true,
      },
    })
    
    return {
      previousSubmissions: previousAssets.length,
      similarBackgrounds: 0,
      consistentStyle: true,
      patternChange: false,
      issues: [],
    }
  } catch (error) {
    return {
      previousSubmissions: 0,
      similarBackgrounds: 0,
      consistentStyle: true,
      patternChange: false,
      issues: ['Seller history analysis failed'],
    }
  }
}

/**
 * Analyze multiple images together for consistency
 */
async function analyzeMultiImageConsistency(
  riftId: string,
  currentAsset: VaultAsset
): Promise<{
  totalImages: number
  isConsistent: boolean
  sequentialDates: boolean
  consistentBackgrounds: boolean
  issues: string[]
}> {
  try {
    const allAssets = await prisma.vaultAsset.findMany({
      where: {
        riftId,
        assetType: { in: ['FILE', 'TICKET_PROOF'] },
        mimeDetected: { startsWith: 'image/' },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        createdAt: true,
        metadataJson: true,
      },
    })
    
    if (allAssets.length <= 1) {
      return {
        totalImages: allAssets.length,
        isConsistent: true,
        sequentialDates: true,
        consistentBackgrounds: true,
        issues: [],
      }
    }
    
    // Check if dates are sequential (images uploaded in order)
    const dates = allAssets.map(a => a.createdAt)
    const sequentialDates = dates.every((date, i) => {
      if (i === 0) return true
      return date >= dates[i - 1]
    })
    
    const issues: string[] = []
    if (!sequentialDates) {
      issues.push('Image timestamps are not sequential')
    }
    
    return {
      totalImages: allAssets.length,
      isConsistent: true, // Simplified - could analyze visual consistency
      sequentialDates,
      consistentBackgrounds: true, // Placeholder
      issues,
    }
  } catch (error) {
    return {
      totalImages: 1,
      isConsistent: true,
      sequentialDates: true,
      consistentBackgrounds: true,
      issues: ['Multi-image analysis failed'],
    }
  }
}

/**
 * Analyze image using OpenAI Vision API with comprehensive feature set
 */
export async function analyzeImageWithAI(
  asset: VaultAsset,
  itemType: 'PHYSICAL' | 'DIGITAL' | 'TICKETS' | 'SERVICES',
  riftData?: {
    subtotal: number
    currency: string
  }
): Promise<ImageAnalysisResult> {
  if (!asset.storagePath) {
    throw new Error('Asset has no storage path')
  }
  
  if (!process.env.OPENAI_API_KEY) {
    console.warn('OPENAI_API_KEY not set, skipping AI analysis - routing to review for safety')
    return {
      isRelevant: true,
      isReadable: true,
      qualityIssues: ['AI analysis unavailable - manual review required'],
      containsExpectedElements: true,
      qualityScore: 50, // Conservative score - route to review
      shouldRouteToReview: true, // Always route to review if AI unavailable
      reasons: ['AI analysis service unavailable - manual review required for security'],
    }
  }
  
  try {
    // Get file as base64
    const imageBase64 = await getFileAsBase64(asset.storagePath)
    
    // Extract EXIF data
    const exifData = await extractEXIFData(asset.storagePath)
    
    // Check for visual duplicates
    let visualDuplicates: Array<{ assetId: string; similarity: number; riftId: string }> = []
    if (asset.mimeDetected?.startsWith('image/')) {
      try {
        visualDuplicates = await findSimilarImages(asset.id, 0.85)
      } catch (error) {
        console.error('Visual duplicate detection failed:', error)
      }
    }
    
    // Get full Rift data for validation
    const fullRiftData = await prisma.riftTransaction.findUnique({
      where: { id: asset.riftId },
      select: {
        subtotal: true,
        currency: true,
        itemType: true,
      },
    })
    
    const rift = riftData ? {
      ...riftData,
      itemType: itemType,
    } : fullRiftData ? {
      subtotal: fullRiftData.subtotal,
      currency: fullRiftData.currency,
      itemType: fullRiftData.itemType,
    } : undefined
    
    // Determine expected content based on item type
    const expectedContentPrompts: Record<string, string> = {
      TICKETS: 'This should be a screenshot or photo of a ticket transfer confirmation, ticket receipt, or ticket in a ticketing app. Look for ticket details, event name, seat information, transfer confirmation, or ticket platform branding (Ticketmaster, AXS, SeatGeek, StubHub).',
      DIGITAL: 'This should be a screenshot or image showing proof of digital product delivery, such as a license key, activation code, download confirmation, or software license screen (Steam, Adobe, Apple, etc.).',
      SERVICES: 'This should be a completion certificate, service receipt, work completion photo, or proof of service delivery.',
    }
    
    const expectedContent = expectedContentPrompts[itemType] || 'This should be relevant proof for the transaction.'
    
    // Build comprehensive AI prompt
    const prompt = `Analyze this image as proof for a ${itemType.toLowerCase()} transaction. ${expectedContent}

CRITICAL: Extract and validate ALL data from the image. Be extremely thorough.

Please provide a detailed analysis in JSON format with the following structure:
{
  "isRelevant": boolean,
  "category": string,
  "documentType": string, // More specific: "ticketmaster_screenshot", "ups_label", "fedex_receipt", "steam_key", "adobe_license", etc.
  "extractedText": string, // ALL text visible in the image (OCR)
  "textConfidence": number, // 0-1
  "isReadable": boolean,
  "qualityIssues": string[], // e.g., ["blurry", "too_dark", "cropped", "low_resolution"]
  "clarityScore": number, // 0-100
  "containsExpectedElements": boolean,
  "suspiciousElements": string[], // e.g., ["watermark_removal", "manipulation_signs", "stock_image", "obvious_edits"]
  "isScreenshot": boolean, // Is this a screenshot (browser UI, phone frame) vs original photo?
  "screenshotConfidence": number, // 0-1
  "detectedBrands": string[], // e.g., ["Ticketmaster", "UPS", "FedEx", "Steam"]
  "detectedLanguage": string, // e.g., "en", "es", "fr"
    "extractedData": {
    "monetaryAmounts": [{"value": number, "currency": string, "confidence": number}], // All dollar amounts found
    "dates": [{"value": "YYYY-MM-DD", "type": "receipt_date|transfer_date|delivery_date|event_date", "confidence": number}],
    "orderIds": string[], // Order IDs, confirmation codes
    "ticketNumbers": string[], // Ticket numbers, seat numbers
    "confirmationCodes": string[], // Confirmation codes, reference numbers
    "licenseKeys": string[], // License keys, activation codes (if visible)
    "qrCodes": [{"data": string, "confidence": number}], // QR code data
    "barcodes": [{"data": string, "type": string, "confidence": number}] // Barcode data
  },
  "confidenceScores": {
    "amounts": number, // 0-1
    "dates": number, // 0-1
    "orderIds": number, // 0-1
    "ticketNumbers": number // 0-1
  },
  "shouldRouteToReview": boolean,
  "reasons": string[]
}

Be VERY strict - images that are blurry, irrelevant, suspicious, or have data mismatches should route to review.`
    
    // Analyze image with OpenAI Vision
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt,
            },
            {
              type: 'image_url',
              image_url: {
                url: imageBase64,
              },
            },
          ],
        },
      ],
      max_tokens: 2000, // Increased for comprehensive extraction
      temperature: 0.3,
    })
    
    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from OpenAI')
    }
    
    // Parse JSON response
    let analysisJson: any
    try {
      const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || content.match(/(\{[\s\S]*\})/)
      if (jsonMatch) {
        analysisJson = JSON.parse(jsonMatch[1])
      } else {
        analysisJson = JSON.parse(content)
      }
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', content)
      return {
        isRelevant: true,
        isReadable: true,
        qualityIssues: ['AI analysis failed - manual review recommended'],
        containsExpectedElements: true,
        qualityScore: 70,
        shouldRouteToReview: true,
        reasons: ['AI analysis parsing failed'],
      }
    }
    
    // Seller history analysis (with image similarity)
    const sellerHistory = await analyzeSellerHistory(asset.uploaderId, asset)
    
    // Visual duplicate detection result
    const visualDuplicatesResult = visualDuplicates.length > 0 ? {
      duplicateCount: visualDuplicates.length,
      similarAssets: visualDuplicates.map(d => ({
        assetId: d.assetId,
        riftId: d.riftId,
        similarity: d.similarity,
      })),
      highestSimilarity: visualDuplicates[0]?.similarity || 0,
    } : null
    
    // Validate extracted data if Rift data is available
    let validations: any = {}
    if (rift && fullRiftData && analysisJson.extractedData) {
      validations = await validateExtractedData(analysisJson.extractedData, rift, asset.riftId, asset.createdAt)
    }
    
    // Add validation issues to reasons
    if (validations.timestampAnalysis?.issues?.length) {
      analysisJson.reasons = [...(analysisJson.reasons || []), ...validations.timestampAnalysis.issues]
    }
    if (validations.amountValidation?.issues?.length) {
      analysisJson.reasons = [...(analysisJson.reasons || []), ...validations.amountValidation.issues]
    }
    
    // Add visual duplicate issues
    if (visualDuplicatesResult && visualDuplicatesResult.duplicateCount > 0) {
      analysisJson.reasons.push(
        `Visual duplicate detected: ${visualDuplicatesResult.duplicateCount} similar image(s) found (${(visualDuplicatesResult.highestSimilarity * 100).toFixed(1)}% similar)`
      )
    }
    
    // Add seller history style issues
    if (sellerHistory.styleAnalysis && !sellerHistory.consistentStyle) {
      analysisJson.reasons.push(
        `Image style inconsistency detected (deviation: ${sellerHistory.styleAnalysis.styleDeviation.toFixed(2)})`
      )
    }
    
    // Multi-image consistency analysis
    const multiImageAnalysis = await analyzeMultiImageConsistency(asset.riftId, asset)
    if (multiImageAnalysis.issues.length > 0) {
      analysisJson.reasons = [...(analysisJson.reasons || []), ...multiImageAnalysis.issues]
    }
    
    // Calculate quality score
    let qualityScore = 100
    
    if (!analysisJson.isRelevant) qualityScore -= 50
    if (!analysisJson.isReadable) qualityScore -= 30
    if (analysisJson.qualityIssues?.length > 0) {
      qualityScore -= Math.min(40, analysisJson.qualityIssues.length * 10)
    }
    if (!analysisJson.containsExpectedElements) qualityScore -= 30
    if (analysisJson.suspiciousElements?.length > 0) {
      qualityScore -= Math.min(50, analysisJson.suspiciousElements.length * 15)
    }
    if (analysisJson.clarityScore !== undefined) {
      qualityScore -= (100 - analysisJson.clarityScore) * 0.3
    }
    
    // Penalize data mismatches
    if (validations.amountValidation && !validations.amountValidation.matchesRiftAmount) {
      qualityScore -= 30
    }
    if (validations.timestampAnalysis && (!validations.timestampAnalysis.isRecent && !validations.timestampAnalysis.matchesSubmissionTime)) {
      qualityScore -= 25
    }
    
    // Penalize visual duplicates
    if (visualDuplicatesResult && visualDuplicatesResult.duplicateCount > 0) {
      qualityScore -= Math.min(40, visualDuplicatesResult.duplicateCount * 10)
    }
    
    // Penalize style inconsistency
    if (sellerHistory.styleAnalysis && !sellerHistory.consistentStyle) {
      qualityScore -= 15
    }
    
    // Penalize screenshots (originals are more trustworthy)
    if (analysisJson.isScreenshot) {
      qualityScore -= 5
    }
    
    // Penalize EXIF stripping (might indicate manipulation)
    if (exifData.wasStripped) {
      qualityScore -= 5
    }
    
    qualityScore = Math.max(0, Math.min(100, Math.round(qualityScore)))
    
    // Determine if should route to review
    const shouldRouteToReview = 
      analysisJson.shouldRouteToReview ||
      qualityScore < 60 ||
      (validations.amountValidation && !validations.amountValidation.matchesRiftAmount) ||
      (validations.timestampAnalysis && validations.timestampAnalysis.issues.length > 0) ||
      (analysisJson.suspiciousElements && analysisJson.suspiciousElements.length > 0) ||
      !analysisJson.isRelevant
    
    return {
      isRelevant: analysisJson.isRelevant ?? true,
      category: analysisJson.category,
      documentType: analysisJson.documentType,
      extractedText: analysisJson.extractedText,
      textConfidence: analysisJson.textConfidence,
      extractedData: analysisJson.extractedData ? {
        ...analysisJson.extractedData,
        confidenceScores: analysisJson.confidenceScores || {},
      } : undefined,
      isReadable: analysisJson.isReadable ?? true,
      qualityIssues: analysisJson.qualityIssues || [],
      clarityScore: analysisJson.clarityScore,
      containsExpectedElements: analysisJson.containsExpectedElements ?? true,
      suspiciousElements: analysisJson.suspiciousElements,
      isScreenshot: analysisJson.isScreenshot,
      screenshotConfidence: analysisJson.screenshotConfidence,
      exifData,
      visualEmbedding: undefined, // Not used - using findSimilarImages instead
      timestampAnalysis: validations.timestampAnalysis,
      amountValidation: validations.amountValidation,
      detectedBrands: analysisJson.detectedBrands,
      brandConfidence: analysisJson.brandConfidence,
      detectedLanguage: analysisJson.detectedLanguage,
      qualityScore,
      shouldRouteToReview,
      reasons: analysisJson.reasons || [],
    }
  } catch (error: any) {
    console.error('AI image analysis error:', error)
    
    // Return conservative score on error - always route to review
    return {
      isRelevant: true,
      isReadable: true,
      qualityIssues: ['AI analysis failed - manual review required'],
      containsExpectedElements: true,
      qualityScore: 40, // Lower score on error - more conservative
      shouldRouteToReview: true, // Always route to review on error
      reasons: [`AI analysis error: ${error.message} - manual review required for security`],
    }
  }
}
