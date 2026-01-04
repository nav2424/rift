/**
 * Seller Enablement Tools
 * Proof builder, quality scoring, templates
 */

import { prisma } from '../prisma'
import { classifyProof } from '../ai/proof-classifier'
import { validateServiceDeliverables } from '../ai/proof-classifier'

export interface ProofQualityScore {
  overall: number // 0-100
  completeness: number
  relevance: number
  quality: number
  warnings: string[]
  recommendations: string[]
  passed: boolean
}

export interface ProofBuilderGuide {
  itemType: string
  requiredAssets: string[]
  recommendedAssets: string[]
  examples: string[]
  tips: string[]
}

/**
 * Score proof quality for seller
 */
export async function scoreProofQuality(
  riftId: string,
  assetIds: string[]
): Promise<ProofQualityScore> {
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

  const assets = await prisma.vault_assets.findMany({
    where: { id: { in: assetIds } },
  })

  // Completeness score
  let completeness = 0
  if (rift.itemType === 'SERVICES') {
    const validation = await validateServiceDeliverables(riftId, assetIds)
    completeness = validation.qualityScore
  } else {
    completeness = assets.length > 0 ? 80 : 0
  }

  // Relevance score (check if assets match item type)
  let relevance = 100
  const warnings: string[] = []
  for (const asset of assets) {
    try {
      const itemTypeForClassification = rift.itemType === 'LICENSE_KEYS' ? 'DIGITAL' : rift.itemType
      const classification = await classifyProof(asset.id, itemTypeForClassification as 'PHYSICAL' | 'DIGITAL' | 'TICKETS' | 'SERVICES')
      if (!classification.itemTypeMatch) {
        relevance -= 20
        warnings.push(`${asset.fileName}: Type mismatch detected`)
      }
      if (classification.qualityScore < 50) {
        relevance -= 10
        warnings.push(`${asset.fileName}: Low quality`)
      }
    } catch (error) {
      // Skip if classification fails
    }
  }
  relevance = Math.max(0, relevance)

  // Quality score (file sizes, formats, etc.)
  let quality = 100
  for (const asset of assets) {
    // File size check removed (fileSize field doesn't exist in VaultAsset model)
    if (!asset.fileName) {
      quality -= 10
    }
  }
  quality = Math.max(0, quality)

  // Overall score
  const overall = Math.round(
    (completeness * 0.4) + (relevance * 0.35) + (quality * 0.25)
  )

  // Generate recommendations
  const recommendations: string[] = []
  if (completeness < 70) {
    recommendations.push('Add more proof assets to meet requirements')
  }
  if (relevance < 80) {
    recommendations.push('Ensure all uploads match the item type')
  }
  if (quality < 70) {
    recommendations.push('Upload higher quality files')
  }
  if (assets.length === 0) {
    recommendations.push('No proof submitted - upload proof of delivery')
  }

  return {
    overall,
    completeness,
    relevance,
    quality,
    warnings,
    recommendations,
    passed: overall >= 70,
  }
}

/**
 * Get proof builder guide for seller
 */
export async function getProofBuilderGuide(
  itemType: string,
  serviceDeliverables?: string
): Promise<ProofBuilderGuide> {
  const requiredAssets: string[] = []
  const recommendedAssets: string[] = []
  const examples: string[] = []
  const tips: string[] = []

  switch (itemType) {
    case 'TICKETS':
      requiredAssets.push('Ticket screenshot or PDF')
      recommendedAssets.push('Event confirmation email', 'Seat details')
      examples.push('Screenshot of ticket in app', 'PDF ticket from venue')
      tips.push('Include event name, date, and seat information')
      tips.push('Make sure ticket is clearly visible and not expired')
      break

    case 'DIGITAL':
      requiredAssets.push('File or download link')
      recommendedAssets.push('Screenshot of file', 'License key (if applicable)')
      examples.push('ZIP file with digital goods', 'Google Drive link', 'License key text')
      tips.push('Ensure file is accessible and not corrupted')
      tips.push('For license keys, use the vault key reveal feature')
      break

    case 'SERVICES':
      requiredAssets.push('Proof of completion')
      if (serviceDeliverables) {
        const deliverables = typeof serviceDeliverables === 'string'
          ? JSON.parse(serviceDeliverables)
          : serviceDeliverables
        requiredAssets.push(...deliverables.map((d: string) => `Proof of: ${d}`))
      }
      recommendedAssets.push('Screenshots of work', 'Completion certificate', 'Delivery confirmation')
      examples.push('Screenshot of completed project', 'Link to delivered work', 'Completion log')
      tips.push('Include all deliverables specified in the rift')
      tips.push('Provide clear evidence that work is complete')
      break

    case 'PHYSICAL':
      requiredAssets.push('Shipping confirmation', 'Tracking number')
      recommendedAssets.push('Package photo', 'Delivery confirmation')
      examples.push('Tracking screenshot', 'Shipping label photo', 'Delivery photo')
      tips.push('Include tracking number and carrier information')
      tips.push('Take photo of package before shipping')
      break
  }

  return {
    itemType,
    requiredAssets,
    recommendedAssets,
    examples,
    tips,
  }
}

/**
 * Get proof templates for services
 */
export function getServiceProofTemplates(): {
  templateId: string
  name: string
  fields: string[]
  description: string
}[] {
  return [
    {
      templateId: 'web-development',
      name: 'Web Development',
      fields: ['Website URL', 'Source Code Link', 'Deployment Confirmation'],
      description: 'Template for web development services',
    },
    {
      templateId: 'design',
      name: 'Design Services',
      fields: ['Final Design Files', 'Preview Images', 'Style Guide'],
      description: 'Template for design services',
    },
    {
      templateId: 'writing',
      name: 'Writing Services',
      fields: ['Final Document', 'Word Count', 'Delivery Confirmation'],
      description: 'Template for writing services',
    },
    {
      templateId: 'consulting',
      name: 'Consulting',
      fields: ['Meeting Notes', 'Deliverables Summary', 'Recommendations Document'],
      description: 'Template for consulting services',
    },
  ]
}

