/**
 * AI-Powered Transaction Description Enhancement
 * 
 * Features:
 * - Suggest improvements to item descriptions
 * - Generate SEO-friendly descriptions
 * - Validate descriptions match item type
 * - Auto-categorize items if mislabeled
 */

import OpenAI from 'openai'
import { ItemType } from '@prisma/client'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface DescriptionAnalysis {
  quality: 'poor' | 'fair' | 'good' | 'excellent'
  score: number // 0-100
  suggestions: string[]
  enhancedDescription?: string
  itemTypeMatch: {
    matches: boolean
    suggestedType?: ItemType
    confidence: number
  }
  seoOptimized?: string
}

/**
 * Analyze and enhance a transaction description
 */
export async function enhanceDescription(
  description: string,
  itemType: ItemType,
  title: string
): Promise<DescriptionAnalysis> {
  const prompt = `Analyze and enhance this marketplace item description:

Title: ${title}
Current Item Type: ${itemType}
Description: ${description}

Provide analysis and improvements in JSON format:
{
  "quality": "poor|fair|good|excellent",
  "score": 0-100,
  "suggestions": ["suggestion 1", "suggestion 2"],
  "enhancedDescription": "improved version of the description",
  "itemTypeMatch": {
    "matches": boolean,
    "suggestedType": "DIGITAL|TICKETS|SERVICES|PHYSICAL" or null,
    "confidence": 0-100
  },
  "seoOptimized": "SEO-optimized version with relevant keywords"
}`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at writing clear, SEO-friendly marketplace listings. Analyze descriptions and suggest improvements.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.5,
    })

    const analysis = JSON.parse(completion.choices[0].message.content || '{}')

    return {
      quality: analysis.quality || 'fair',
      score: analysis.score || 50,
      suggestions: analysis.suggestions || [],
      enhancedDescription: analysis.enhancedDescription,
      itemTypeMatch: {
        matches: analysis.itemTypeMatch?.matches !== false,
        suggestedType: analysis.itemTypeMatch?.suggestedType,
        confidence: analysis.itemTypeMatch?.confidence || 50,
      },
      seoOptimized: analysis.seoOptimized,
    }
  } catch (error) {
    console.error('Description enhancement failed:', error)
    
    // Basic fallback analysis
    return {
      quality: description.length < 20 ? 'poor' : description.length < 100 ? 'fair' : 'good',
      score: Math.min(description.length / 2, 100),
      suggestions: description.length < 50 ? ['Add more details about the item'] : [],
      itemTypeMatch: {
        matches: true,
        confidence: 50,
      },
    }
  }
}

/**
 * Validate if description matches the selected item type
 */
export async function validateItemType(
  description: string,
  title: string,
  selectedType: ItemType
): Promise<{
  valid: boolean
  suggestedType?: ItemType
  confidence: number
  reasoning: string
}> {
  const analysis = await enhanceDescription(description, selectedType, title)

  if (!analysis.itemTypeMatch.matches && analysis.itemTypeMatch.suggestedType) {
    return {
      valid: false,
      suggestedType: analysis.itemTypeMatch.suggestedType,
      confidence: analysis.itemTypeMatch.confidence,
      reasoning: `Description appears to be for ${analysis.itemTypeMatch.suggestedType} rather than ${selectedType}`,
    }
  }

  return {
    valid: true,
    confidence: analysis.itemTypeMatch.confidence,
    reasoning: 'Description matches selected item type',
  }
}

