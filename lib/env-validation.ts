/**
 * Environment variable validation utilities
 */

const isProduction = process.env.NODE_ENV === 'production'

/**
 * Get required environment variable, throw error if missing
 */
export function getRequiredEnv(key: string): string {
  const value = process.env[key]
  if (!value) {
    const error = `Required environment variable ${key} is not set`
    if (isProduction) {
      // In production, throw immediately - fail fast
      throw new Error(error)
    } else {
      // In development, warn but don't throw (allows partial functionality)
      console.warn(`⚠️ ${error}`)
    }
    return ''
  }
  return value
}

/**
 * Get optional environment variable with default value
 */
export function getOptionalEnv(key: string, defaultValue: string = ''): string {
  return process.env[key] || defaultValue
}

/**
 * Check if we're in production
 */
export function isProd(): boolean {
  return isProduction
}

/**
 * Check if we're in development
 */
export function isDev(): boolean {
  return process.env.NODE_ENV === 'development'
}

