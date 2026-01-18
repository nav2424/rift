/**
 * Data Cleanup Functions
 * 
 * Functions for cleaning up expired or unnecessary data according to
 * the Data Retention and Disposal Policy.
 */

import { prisma } from '@/lib/prisma'
import { cleanupExpiredCodes } from './verification-codes'
import { cleanupExpiredSessions } from './signup-session'
import { createServerClient } from './supabase'

/**
 * Cleanup vault assets for cancelled/refunded rifts
 * Deletes files from Supabase storage and database records
 */
export async function cleanupVaultAssetsForRift(riftId: string): Promise<{
  deleted: number
  errors: string[]
}> {
  const errors: string[] = []
  let deleted = 0

  try {
    // Get all vault assets for this rift (using Prisma model name)
    const assets = await prisma.vault_assets.findMany({
      where: { riftId },
      select: { id: true, storagePath: true },
    })

    if (assets.length === 0) {
      return { deleted: 0, errors: [] }
    }

    const supabase = createServerClient()

    // Delete files from Supabase storage
    for (const asset of assets) {
      if (asset.storagePath) {
        try {
          const { error: deleteError } = await supabase.storage
            .from('rift-vault')
            .remove([asset.storagePath])

          if (deleteError) {
            errors.push(`Failed to delete storage file ${asset.storagePath}: ${deleteError.message}`)
            // Continue with other files even if one fails
          } else {
            deleted++
          }
        } catch (error: any) {
          errors.push(`Error deleting storage file ${asset.storagePath}: ${error.message}`)
        }
      }
    }

    // Database records will be deleted via cascade when rift is deleted
    // But if rift still exists (e.g., just cancelled), we delete the assets manually
    // Actually, we don't need to delete DB records here - they cascade on rift deletion
    // But if we're cleaning up cancelled rifts, the rift still exists, so we should delete
    // Wait, the policy says to clean up assets on cancellation, so we should delete DB records too
    
    // Delete database records (will cascade vault_events)
    await prisma.vault_assets.deleteMany({
      where: { riftId },
    })

    return { deleted, errors }
  } catch (error: any) {
    errors.push(`Error in cleanupVaultAssetsForRift: ${error.message}`)
    return { deleted, errors }
  }
}

/**
 * Cleanup expired verification codes
 */
export async function cleanupExpiredVerificationCodes(): Promise<{
  deleted: number
  errors: string[]
}> {
  const errors: string[] = []
  
  try {
    // Get count before deletion
    const countBefore = await prisma.verificationCode.count({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    })

    await cleanupExpiredCodes()

    return { deleted: countBefore, errors }
  } catch (error: any) {
    errors.push(`Error cleaning up expired verification codes: ${error.message}`)
    return { deleted: 0, errors }
  }
}

/**
 * Cleanup expired signup sessions
 */
export async function cleanupExpiredSignupSessions(): Promise<{
  deleted: number
  errors: string[]
}> {
  const errors: string[] = []
  
  try {
    // Get count before deletion
    const countBefore = await prisma.signup_sessions.count({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    })

    await cleanupExpiredSessions()

    return { deleted: countBefore, errors }
  } catch (error: any) {
    errors.push(`Error cleaning up expired signup sessions: ${error.message}`)
    return { deleted: 0, errors }
  }
}

/**
 * Comprehensive data cleanup
 * Runs all cleanup functions
 */
export async function runDataCleanup(): Promise<{
  verificationCodes: { deleted: number; errors: string[] }
  signupSessions: { deleted: number; errors: string[] }
  timestamp: string
}> {
  const verificationCodes = await cleanupExpiredVerificationCodes()
  const signupSessions = await cleanupExpiredSignupSessions()

  return {
    verificationCodes,
    signupSessions,
    timestamp: new Date().toISOString(),
  }
}
