/**
 * AI-Powered Multi-Language Support
 * 
 * Features:
 * - Auto-translate messages between buyers/sellers
 * - Translate dispute submissions for admins
 * - Detect language and provide translations
 */

import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface TranslationResult {
  originalText: string
  translatedText: string
  sourceLanguage: string
  targetLanguage: string
  confidence: number
}

/**
 * Detect the language of a text
 */
export async function detectLanguage(text: string): Promise<{
  language: string
  confidence: number
}> {
  if (!text || text.trim().length === 0) {
    return { language: 'en', confidence: 0 }
  }

  // Use a simple heuristic first (check for common non-English characters)
  // For production, you might want to use a dedicated language detection library
  const prompt = `Detect the language of this text:

"${text.substring(0, 500)}"

Respond with JSON:
{
  "language": "ISO 639-1 code (e.g., en, es, fr, zh)",
  "confidence": 0-100
}`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Detect the language of the given text. Return the ISO 639-1 language code.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    })

    const result = JSON.parse(completion.choices[0].message.content || '{}')
    return {
      language: result.language || 'en',
      confidence: result.confidence || 50,
    }
  } catch (error) {
    console.error('Language detection failed:', error)
    return { language: 'en', confidence: 0 }
  }
}

/**
 * Translate text to target language
 */
export async function translateText(
  text: string,
  targetLanguage: string = 'en',
  sourceLanguage?: string
): Promise<TranslationResult> {
  if (!text || text.trim().length === 0) {
    return {
      originalText: text,
      translatedText: text,
      sourceLanguage: sourceLanguage || 'en',
      targetLanguage,
      confidence: 0,
    }
  }

  // Detect source language if not provided
  const detected = sourceLanguage 
    ? { language: sourceLanguage, confidence: 100 }
    : await detectLanguage(text)

  // Don't translate if already in target language
  if (detected.language === targetLanguage) {
    return {
      originalText: text,
      translatedText: text,
      sourceLanguage: detected.language,
      targetLanguage,
      confidence: 100,
    }
  }

  const prompt = `Translate this text from ${detected.language} to ${targetLanguage}. Preserve the tone and meaning:

"${text}"

Respond with JSON:
{
  "translatedText": "the translation",
  "confidence": 0-100
}`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a professional translator. Translate accurately while preserving tone and context. Target language: ${targetLanguage}`,
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    })

    const result = JSON.parse(completion.choices[0].message.content || '{}')

    return {
      originalText: text,
      translatedText: result.translatedText || text,
      sourceLanguage: detected.language,
      targetLanguage,
      confidence: result.confidence || 80,
    }
  } catch (error) {
    console.error('Translation failed:', error)
    
    return {
      originalText: text,
      translatedText: text, // Return original on failure
      sourceLanguage: detected.language,
      targetLanguage,
      confidence: 0,
    }
  }
}

/**
 * Translate a message with caching (optional - implement caching layer)
 */
export async function translateMessage(
  messageText: string,
  targetLanguage: string = 'en',
  cacheKey?: string
): Promise<TranslationResult> {
  // In production, check cache first
  // For now, just translate directly
  return translateText(messageText, targetLanguage)
}

/**
 * Translate dispute submission for admin review
 */
export async function translateDisputeForAdmin(
  disputeText: string,
  adminLanguage: string = 'en'
): Promise<{
  original: string
  translated: string
  sourceLanguage: string
}> {
  const translation = await translateText(disputeText, adminLanguage)

  return {
    original: translation.originalText,
    translated: translation.translatedText,
    sourceLanguage: translation.sourceLanguage,
  }
}

/**
 * Get supported languages
 */
export function getSupportedLanguages(): Array<{ code: string; name: string }> {
  return [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'it', name: 'Italian' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'zh', name: 'Chinese' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' },
    { code: 'ar', name: 'Arabic' },
    { code: 'ru', name: 'Russian' },
    { code: 'hi', name: 'Hindi' },
  ]
}

