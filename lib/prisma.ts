import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// PrismaClient configuration with improved connection pooling
// To fix connection pool timeouts, update your DATABASE_URL to include:
// ?connection_limit=20&pool_timeout=20&connect_timeout=60
// Example: postgresql://user:pass@host:5432/db?connection_limit=20&pool_timeout=20&connect_timeout=60
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'error', 'warn']
    : ['error'],
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Handle graceful shutdown
const disconnect = async () => {
  try {
    await prisma.$disconnect()
  } catch (error) {
    console.error('Error disconnecting Prisma:', error)
  }
}

if (process.env.NODE_ENV === 'production') {
  process.on('beforeExit', disconnect)
  process.on('SIGINT', disconnect)
  process.on('SIGTERM', disconnect)
}

// Handle connection errors - log but don't disconnect
// Prisma will automatically retry connections
prisma.$on('error' as never, (e: any) => {
  console.error('Prisma error:', e)
  // Don't disconnect on error - let Prisma handle reconnection
})

/**
 * Retry wrapper for Prisma operations that might fail due to connection issues
 * Use this for critical operations that should retry on connection errors
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000
): Promise<T> {
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error: any) {
      lastError = error
      
      // Only retry on connection-related errors
      if (
        error?.code === 'P2024' || // Connection pool timeout
        error?.code === 'P1001' || // Can't reach database
        error?.message?.includes('connection') ||
        error?.message?.includes('pool')
      ) {
        if (attempt < maxRetries) {
          console.warn(`Database operation failed (attempt ${attempt}/${maxRetries}), retrying...`, error.message)
          await new Promise(resolve => setTimeout(resolve, delayMs * attempt))
          continue
        }
      }
      
      // For other errors or max retries reached, throw immediately
      throw error
    }
  }
  
  throw lastError || new Error('Operation failed after retries')
}

// Ensure we're using connection pooling properly
// In development, we reuse the same client instance
// In production, connections are managed by the connection pool

