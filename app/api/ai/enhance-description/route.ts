import { NextRequest, NextResponse } from 'next/server'
import { enhanceDescription } from '@/lib/ai/description-enhancement'

export async function POST(request: NextRequest) {
  try {
    const { description, itemType, title } = await request.json()

    if (!description || !itemType) {
      return NextResponse.json(
        { error: 'Description and itemType are required' },
        { status: 400 }
      )
    }

    const analysis = await enhanceDescription(description, itemType, title || '')

    return NextResponse.json({
      quality: analysis.quality,
      score: analysis.score,
      suggestions: analysis.suggestions,
      enhancedDescription: analysis.enhancedDescription,
      itemTypeMatch: analysis.itemTypeMatch,
      seoOptimized: analysis.seoOptimized,
    })
  } catch (error: any) {
    console.error('Description enhancement error:', error)
    return NextResponse.json(
      { error: 'Failed to enhance description' },
      { status: 500 }
    )
  }
}

