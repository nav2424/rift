import { NextRequest, NextResponse } from 'next/server'
import { translateText } from '@/lib/ai/translation'

export async function POST(request: NextRequest) {
  try {
    const { text, targetLanguage = 'en', sourceLanguage } = await request.json()

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      )
    }

    const result = await translateText(text, targetLanguage, sourceLanguage)

    return NextResponse.json({
      originalText: result.originalText,
      translatedText: result.translatedText,
      sourceLanguage: result.sourceLanguage,
      targetLanguage: result.targetLanguage,
      confidence: result.confidence,
    })
  } catch (error: any) {
    console.error('Translation error:', error)
    return NextResponse.json(
      { error: 'Failed to translate text' },
      { status: 500 }
    )
  }
}

