/**
 * Job Type Definitions
 * Define the data structures for all job types
 */

// Verification job data
export interface VerificationJobData {
  riftId: string
  assetIds: string[]
  triggeredBy: 'proof-submission' | 'admin-manual' | 'retry'
  triggeredByUserId?: string
}

// Virus scan job data
export interface VirusScanJobData {
  assetId: string
  storagePath: string
  fileName?: string
}

// Cleanup job data
export interface CleanupJobData {
  riftId: string
  reason: 'cancellation' | 'refund' | 'retention-policy'
}

// Email job data
export interface EmailJobData {
  to: string
  subject: string
  html: string
  text?: string
}

// Job result types
export interface VerificationJobResult {
  success: boolean
  allPassed: boolean
  shouldRouteToReview: boolean
  results?: Array<{
    assetId: string
    passed: boolean
    qualityScore: number
    issues: string[]
  }>
  error?: string
}

export interface VirusScanJobResult {
  success: boolean
  clean: boolean
  scanStatus: 'PASS' | 'FAIL' | 'ERROR'
  error?: string
  virusName?: string
}

