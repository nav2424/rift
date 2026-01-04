/**
 * Buyer Protection UX
 * AI concierge for proof requirements, pre-flight checklist
 */

import { prisma } from '../prisma'

export interface ProofRecommendation {
  itemType: string
  recommendedProof: string[]
  examples: string[]
  why: string[]
}

export interface PreFlightChecklist {
  score: number // 0-100
  missing: string[]
  warnings: string[]
  recommendations: string[]
  canProceed: boolean
}

/**
 * Get proof recommendations for buyer
 */
export async function getProofRecommendations(
  itemType: string
): Promise<ProofRecommendation> {
  const recommendedProof: string[] = []
  const examples: string[] = []
  const why: string[] = []

  switch (itemType) {
    case 'TICKETS':
      recommendedProof.push('Screenshot of ticket', 'Event confirmation', 'Seat details')
      examples.push('Ticket screenshot from app', 'PDF ticket from venue', 'Email confirmation')
      why.push('Tickets require proof of purchase and seat information')
      why.push('Helps verify authenticity and prevent scams')
      break

    case 'DIGITAL':
      recommendedProof.push('File or download link', 'License key (if applicable)')
      examples.push('ZIP file', 'Google Drive link', 'License key')
      why.push('Digital goods need accessible delivery method')
      why.push('License keys should use secure reveal feature')
      break

    case 'SERVICES':
      recommendedProof.push('Completed deliverables', 'Progress screenshots', 'Completion confirmation')
      examples.push('Final project files', 'Work-in-progress screenshots', 'Completion certificate')
      why.push('Services need proof of completion')
      why.push('Clear deliverables reduce disputes')
      break

    case 'PHYSICAL':
      recommendedProof.push('Tracking number', 'Shipping confirmation', 'Package photo')
      examples.push('USPS tracking', 'FedEx label', 'Package before shipping')
      why.push('Physical items need shipping proof')
      why.push('Tracking protects both parties')
      break
  }

  return {
    itemType,
    recommendedProof,
    examples,
    why,
  }
}

/**
 * Run pre-flight checklist before funding
 */
export async function runPreFlightChecklist(
  riftData: {
    itemType: string
    itemTitle?: string
    itemDescription?: string
    eventDate?: Date | null
    venue?: string
    serviceDeliverables?: string
    completionCriteria?: string
    subtotal?: number
  }
): Promise<PreFlightChecklist> {
  const missing: string[] = []
  const warnings: string[] = []
  const recommendations: string[] = []

  // Title check
  if (!riftData.itemTitle || riftData.itemTitle.trim().length < 5) {
    missing.push('Item title is missing or too short (minimum 5 characters)')
  }

  // Description check
  if (!riftData.itemDescription || riftData.itemDescription.trim().length < 20) {
    missing.push('Item description is missing or too brief (minimum 20 characters)')
    recommendations.push('Add detailed description to help seller understand requirements')
  }

  // Type-specific checks
  if (riftData.itemType === 'TICKETS') {
    if (!riftData.eventDate) {
      missing.push('Event date is required for tickets')
    }
    if (!riftData.venue) {
      warnings.push('Venue information recommended for tickets')
    }
    recommendations.push('Include event name, date, venue, and seat information')
  }

  if (riftData.itemType === 'SERVICES') {
    if (!riftData.serviceDeliverables) {
      missing.push('Service deliverables must be specified')
    }
    if (!riftData.completionCriteria) {
      missing.push('Completion criteria must be specified')
    }
    recommendations.push('Clearly define what will be delivered and how completion is measured')
  }

  // Value check
  if ((riftData.subtotal || 0) >= 500) {
    recommendations.push('High-value transaction - consider adding more details')
  }

  // Calculate score
  const totalChecks = 2 + // title, description
                      (riftData.itemType === 'TICKETS' ? 2 : 0) + // eventDate, venue
                      (riftData.itemType === 'SERVICES' ? 2 : 0) // deliverables, criteria
  const passedChecks = totalChecks - missing.length - (warnings.length * 0.5)
  const score = Math.round((passedChecks / totalChecks) * 100)

  return {
    score,
    missing,
    warnings,
    recommendations,
    canProceed: missing.length === 0 && score >= 70,
  }
}

/**
 * Auto-fill rift fields from uploaded proof
 */
export async function autoFillFromProof(
  assetId: string
): Promise<{
  eventName?: string
  eventDate?: string
  venue?: string
  platform?: string
  deliveryMethod?: string
  confidence: number
}> {
  const asset = await prisma.vault_assets.findUnique({
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

  // Extract event name
  const eventNameMatch = text.match(/(?:event|concert|show):\s*([^\n,]+)/i)
  const eventName = eventNameMatch ? eventNameMatch[1].trim() : undefined

  // Extract date
  const dateMatch = text.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/)
  const eventDate = dateMatch ? dateMatch[1] : undefined

  // Extract venue
  const venueMatch = text.match(/(?:venue|location|at):\s*([^\n,]+)/i)
  const venue = venueMatch ? venueMatch[1].trim() : undefined

  // Extract platform (for digital)
  const platformMatch = text.match(/(?:platform|via|from):\s*([^\n,]+)/i)
  const platform = platformMatch ? platformMatch[1].trim() : undefined

  // Extract delivery method
  const deliveryMatch = text.match(/(?:delivery|method):\s*([^\n,]+)/i)
  const deliveryMethod = deliveryMatch ? deliveryMatch[1].trim() : undefined

  const confidence = (eventName ? 30 : 0) +
                     (eventDate ? 25 : 0) +
                     (venue ? 20 : 0) +
                     (platform ? 15 : 0) +
                     (deliveryMethod ? 10 : 0)

  return {
    eventName,
    eventDate,
    venue,
    platform,
    deliveryMethod,
    confidence,
  }
}

