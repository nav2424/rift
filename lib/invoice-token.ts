/**
 * Invoice token generation and verification for public invoice access
 * Uses HMAC to sign tokens for secure, stateless access
 */

import { createHmac, randomBytes, timingSafeEqual } from 'crypto'

let cachedNonProdSecret: string | null = null
const TOKEN_EXPIRY_HOURS = 30 * 24 // 30 days

function getInvoiceTokenSecret(): string {
  const configuredSecret = process.env.INVOICE_TOKEN_SECRET?.trim()
  if (configuredSecret) {
    return configuredSecret
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('INVOICE_TOKEN_SECRET is required in production')
  }

  if (!cachedNonProdSecret) {
    // In non-production, use an ephemeral process-local secret instead of a static fallback.
    cachedNonProdSecret = randomBytes(32).toString('hex')
    console.warn('INVOICE_TOKEN_SECRET is not set; using ephemeral non-production secret')
  }

  return cachedNonProdSecret
}

/**
 * Generate a signed token for invoice access
 * Token format: invoiceId:timestamp:signature
 */
export function generateInvoiceToken(invoiceId: string): string {
  const timestamp = Date.now()
  const message = `${invoiceId}:${timestamp}`
  const hmac = createHmac('sha256', getInvoiceTokenSecret())
  hmac.update(message)
  const signature = hmac.digest('hex')
  const token = `${message}:${signature}`
  return Buffer.from(token).toString('base64url')
}

/**
 * Verify and extract invoice ID from token
 * Returns invoiceId if valid, null if invalid or expired
 */
export function verifyInvoiceToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8')
    const parts = decoded.split(':')
    if (parts.length !== 3) {
      return null
    }

    const [invoiceId, timestampStr, signature] = parts
    const timestamp = parseInt(timestampStr, 10)

    if (isNaN(timestamp)) {
      return null
    }

    // Check expiry (30 days)
    const age = Date.now() - timestamp
    const maxAge = TOKEN_EXPIRY_HOURS * 60 * 60 * 1000
    if (age > maxAge) {
      return null
    }

    // Verify signature
    const message = `${invoiceId}:${timestamp}`
    const hmac = createHmac('sha256', getInvoiceTokenSecret())
    hmac.update(message)
    const expectedSignature = hmac.digest('hex')

    // Use timing-safe comparison to prevent timing attacks
    const signatureBuffer = Buffer.from(signature, 'hex')
    const expectedBuffer = Buffer.from(expectedSignature, 'hex')
    if (signatureBuffer.length !== expectedBuffer.length) {
      return null
    }

    if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
      return null
    }

    return invoiceId
  } catch (error) {
    console.error('Error verifying invoice token:', error)
    return null
  }
}

/**
 * Get invoice view URL with token
 */
export function getInvoiceViewUrl(invoiceId: string, baseUrl?: string): string {
  const token = generateInvoiceToken(invoiceId)
  const url = baseUrl || process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://joinrift.co'
  return `${url}/invoice/${invoiceId}?token=${token}`
}
