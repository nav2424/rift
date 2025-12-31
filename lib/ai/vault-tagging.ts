/**
 * AI-Powered Smart Vault Asset Tagging
 * 
 * Features:
 * - Auto-tag vault assets with metadata
 * - Improve searchability and organization
 * - Better admin review workflow
 */

import { prisma } from '../prisma'
import OpenAI from 'openai'
import { VaultAsset } from '@prisma/client'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface AssetTags {
  primaryCategory: string
  subcategories: string[]
  tags: string[]
  description?: string
  extractedData: {
    amounts?: string[]
    dates?: string[]
    referenceNumbers?: string[]
    platforms?: string[]
  }
  confidence: number
}

/**
 * Auto-tag a vault asset with AI
 */
export async function tagVaultAsset(
  asset: VaultAsset,
  itemType: string
): Promise<AssetTags> {
  // Get asset content for analysis
  let contentToAnalyze = ''

  if (asset.textContent) {
    contentToAnalyze = asset.textContent.substring(0, 2000)
  } else if (asset.fileName) {
    contentToAnalyze = `File: ${asset.fileName}`
  }

  if (asset.trackingNumber) {
    contentToAnalyze += `\nTracking Number: ${asset.trackingNumber}`
  }

  if (asset.url) {
    contentToAnalyze += `\nURL: ${asset.url}`
  }

  const prompt = `Analyze this vault asset and generate appropriate tags:

Asset Type: ${asset.assetType}
Item Type: ${itemType}
File Name: ${asset.fileName || 'N/A'}

Content:
${contentToAnalyze || 'No text content available'}

Generate tags and metadata in JSON:
{
  "primaryCategory": "main category (e.g., ticket_screenshot, receipt, license_key, tracking_info)",
  "subcategories": ["subcategory1", "subcategory2"],
  "tags": ["tag1", "tag2", "tag3"],
  "description": "brief description of what this asset contains",
  "extractedData": {
    "amounts": ["amount1", "amount2"],
    "dates": ["date1", "date2"],
    "referenceNumbers": ["ref1", "ref2"],
    "platforms": ["platform1", "platform2"]
  },
  "confidence": 0-100
}`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a system that tags and categorizes escrow proof assets. Generate accurate, searchable tags.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    })

    const tags = JSON.parse(completion.choices[0].message.content || '{}') as AssetTags

    // If asset is an image, we already have AI analysis from vault-ai-analysis
    // We can enhance tags based on that
    if (asset.metadataJson && typeof asset.metadataJson === 'object') {
      const metadata = asset.metadataJson as any
      if (metadata.aiAnalysis) {
        // Add tags from AI analysis
        if (metadata.aiAnalysis.detectedBrands) {
          tags.tags.push(...metadata.aiAnalysis.detectedBrands)
        }
        if (metadata.aiAnalysis.category) {
          tags.subcategories.push(metadata.aiAnalysis.category)
        }
      }
    }

    return tags
  } catch (error) {
    console.error('Asset tagging failed:', error)
    
    // Basic fallback tags
    return {
      primaryCategory: asset.assetType.toLowerCase(),
      subcategories: [],
      tags: [asset.assetType, itemType],
      confidence: 50,
      extractedData: {},
    }
  }
}

/**
 * Update asset metadata with tags (stores in metadataJson field)
 */
export async function updateAssetTags(assetId: string): Promise<void> {
  const asset = await prisma.vaultAsset.findUnique({
    where: { id: assetId },
    include: {
      rift: {
        select: { itemType: true },
      },
    },
  })

  if (!asset) {
    throw new Error('Asset not found')
  }

  const tags = await tagVaultAsset(asset, asset.rift.itemType)

  // Update metadata with tags
  const currentMetadata = (asset.metadataJson || {}) as any
  currentMetadata.aiTags = tags

  await prisma.vaultAsset.update({
    where: { id: assetId },
    data: {
      metadataJson: currentMetadata,
    },
  })
}

/**
 * Search assets by tags
 */
export async function searchAssetsByTags(
  tags: string[],
  riftId?: string
): Promise<string[]> {
  // Search in metadataJson for matching tags
  const assets = await prisma.vaultAsset.findMany({
    where: riftId ? { riftId } : undefined,
    select: {
      id: true,
      metadataJson: true,
    },
  })

  const matchingAssets: string[] = []

  for (const asset of assets) {
    if (!asset.metadataJson || typeof asset.metadataJson !== 'object') continue

    const metadata = asset.metadataJson as any
    const assetTags = metadata.aiTags?.tags || []

    // Check if any search tag matches
    const matches = tags.some(searchTag =>
      assetTags.some((assetTag: string) =>
        assetTag.toLowerCase().includes(searchTag.toLowerCase())
      )
    )

    if (matches) {
      matchingAssets.push(asset.id)
    }
  }

  return matchingAssets
}

