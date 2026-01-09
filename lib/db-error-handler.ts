/**
 * Database Error Handler
 * Provides clear, actionable error messages for database connection and configuration issues
 */

export interface DatabaseErrorDetails {
  message: string
  actionable: string
  statusCode: number
}

/**
 * Analyzes Prisma/database errors and returns helpful error details
 */
export function getDatabaseErrorDetails(error: any): DatabaseErrorDetails {
  const errorMessage = error?.message || ''
  const errorCode = error?.code || ''
  
  // Connection errors
  if (errorCode === 'P1001' || errorMessage.includes("Can't reach database server")) {
    const dbUrl = process.env.DATABASE_URL || ''
    const maskedUrl = maskDatabaseUrl(dbUrl)
    
    return {
      message: 'Database connection failed',
      actionable: `Cannot connect to the database server. Please check:
1. DATABASE_URL environment variable is set correctly in Vercel
2. Database server is running and accessible
3. Connection string format: postgresql://user:password@host:port/database
Current DATABASE_URL: ${maskedUrl || '(not set)'}
If you see "db.prisma.io" or an incorrect host, update DATABASE_URL in Vercel Settings → Environment Variables.`,
      statusCode: 503,
    }
  }
  
  // Connection timeout
  if (errorCode === 'P2024' || errorMessage.includes('Connection pool timeout')) {
    return {
      message: 'Database connection timeout',
      actionable: 'The database connection pool timed out. This may be due to:
1. High database load
2. Too many concurrent connections
3. Network issues
Please try again in a few moments. If this persists, check your database connection pool settings.',
      statusCode: 503,
    }
  }
  
  // Authentication errors
  if (errorCode === 'P1000' || errorMessage.includes('Authentication failed')) {
    return {
      message: 'Database authentication failed',
      actionable: `Cannot authenticate with the database. Please check:
1. DATABASE_URL contains correct username and password
2. Database user has proper permissions
3. Password hasn't been changed in the database
Update DATABASE_URL in Vercel Settings → Environment Variables if needed.`,
      statusCode: 401,
    }
  }
  
  // SSL/TLS errors
  if (errorMessage.includes('SSL') || errorMessage.includes('TLS') || errorCode === 'P1010') {
    return {
      message: 'Database SSL/TLS connection error',
      actionable: `SSL connection to database failed. Please check:
1. DATABASE_URL includes sslmode=require or sslmode=prefer
2. Database server supports SSL connections
3. SSL certificates are valid
Try adding ?sslmode=require to your DATABASE_URL.`,
      statusCode: 503,
    }
  }
  
  // Generic connection errors
  if (errorMessage.includes('connection') || errorMessage.includes('connect')) {
    const dbUrl = process.env.DATABASE_URL || ''
    const maskedUrl = maskDatabaseUrl(dbUrl)
    
    return {
      message: 'Database connection error',
      actionable: `Failed to establish database connection. Please verify:
1. DATABASE_URL is correctly configured in Vercel
2. Database host is reachable
3. Network/firewall allows connections
Current DATABASE_URL: ${maskedUrl || '(not set)'}`,
      statusCode: 503,
    }
  }
  
  // Default fallback
  return {
    message: 'Database error',
    actionable: errorMessage || 'An unexpected database error occurred. Please check the logs for details.',
    statusCode: 500,
  }
}

/**
 * Masks sensitive information in database URLs for logging
 */
function maskDatabaseUrl(url: string): string {
  if (!url) return ''
  
  try {
    // Parse URL
    const urlObj = new URL(url)
    
    // Mask password
    if (urlObj.password) {
      urlObj.password = '***'
    }
    
    // Mask username if it looks sensitive
    if (urlObj.username && urlObj.username.length > 3) {
      urlObj.username = urlObj.username.substring(0, 2) + '***'
    }
    
    return urlObj.toString()
  } catch {
    // If URL parsing fails, just mask the password part manually
    return url.replace(/:[^:@]+@/, ':***@')
  }
}

/**
 * Checks if DATABASE_URL looks misconfigured
 */
export function checkDatabaseUrl(): { valid: boolean; issues: string[] } {
  const dbUrl = process.env.DATABASE_URL || ''
  const issues: string[] = []
  
  if (!dbUrl) {
    issues.push('DATABASE_URL environment variable is not set')
    return { valid: false, issues }
  }
  
  // Check for common misconfigurations
  if (dbUrl.includes('db.prisma.io')) {
    issues.push('DATABASE_URL appears to point to "db.prisma.io" which is not a valid database host')
  }
  
  if (!dbUrl.includes('postgresql://') && !dbUrl.includes('postgres://')) {
    issues.push('DATABASE_URL should use postgresql:// or postgres:// protocol')
  }
  
  if (!dbUrl.includes('@')) {
    issues.push('DATABASE_URL appears to be missing authentication credentials')
  }
  
  try {
    const url = new URL(dbUrl)
    if (!url.hostname || url.hostname === 'localhost') {
      issues.push('DATABASE_URL hostname is localhost or empty - this will not work in production')
    }
  } catch {
    issues.push('DATABASE_URL does not appear to be a valid URL format')
  }
  
  return {
    valid: issues.length === 0,
    issues,
  }
}

