/**
 * Error handling utilities for production-safe error messages
 */

import { isProd } from './env-validation'

/**
 * Sanitize error message for client response
 * In production, don't expose internal error details
 */
export function sanitizeErrorMessage(error: any, defaultMessage: string = 'An error occurred'): string {
  // In development, return full error message for debugging
  if (!isProd()) {
    return error?.message || defaultMessage
  }

  // In production, return user-friendly messages only
  const message = error?.message || ''
  
  // Check for known error types and return safe messages
  if (error?.code) {
    switch (error.code) {
      case 'STRIPE_AUTHENTICATION_ERROR':
        return 'Payment processing temporarily unavailable. Please try again later.'
      case 'STRIPE_RATE_LIMIT_ERROR':
        return 'Too many requests. Please try again in a moment.'
      case 'STRIPE_INVALID_REQUEST_ERROR':
        return 'Invalid request. Please check your information and try again.'
      case 'STRIPE_API_ERROR':
        return 'Payment processing error. Please try again or contact support.'
      case 'STRIPE_CARD_ERROR':
        return error.message || 'Card payment failed. Please check your card details.'
      default:
        // For unknown error codes, use generic message
        return defaultMessage
    }
  }

  // If it's a Stripe error, extract safe message
  if (message.includes('Stripe')) {
    if (message.includes('authentication')) {
      return 'Payment processing temporarily unavailable. Please try again later.'
    }
    if (message.includes('rate limit')) {
      return 'Too many requests. Please try again in a moment.'
    }
    if (message.includes('invalid') || message.includes('Invalid')) {
      return 'Invalid request. Please check your information and try again.'
    }
    return 'Payment processing error. Please try again or contact support.'
  }

  // For other errors, return generic message in production
  return defaultMessage
}

/**
 * Log error with appropriate level based on environment
 */
export function logError(context: string, error: any, metadata?: Record<string, any>) {
  const errorMessage = error?.message || 'Unknown error'
  const errorStack = error?.stack

  if (isProd()) {
    // In production, use structured logging (console.error is fine for now, but consider proper logging service)
    console.error(`[${context}]`, {
      message: errorMessage,
      ...(metadata || {}),
      ...(errorStack && { stack: errorStack }),
    })
  } else {
    // In development, log full details
    console.error(`[${context}] Error:`, errorMessage)
    if (errorStack) {
      console.error('Stack:', errorStack)
    }
    if (metadata) {
      console.error('Metadata:', metadata)
    }
  }
}

