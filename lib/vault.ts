import { createHash } from 'crypto'
import { createServerClient } from './supabase'

/**
 * Rift Vault - Secure file storage system
 * Handles file uploads, hashing, encryption, and secure access
 */

export interface VaultFileMetadata {
  fileName: string
  mimeType: string
  sizeBytes: number
  fileHash: string // SHA-256 hash
  storagePath: string
  uploadedBy: string
  uploadedAt: Date
  virusScanStatus: 'PENDING' | 'CLEAN' | 'INFECTED'
  viewOnly: boolean // If true, file can only be viewed, not downloaded
}

/**
 * Generate SHA-256 hash of file content
 */
export async function generateFileHash(file: File | Buffer): Promise<string> {
  const buffer = file instanceof File 
    ? Buffer.from(await file.arrayBuffer())
    : file
  
  return createHash('sha256').update(buffer).digest('hex')
}

/**
 * Encrypt sensitive data (like license keys)
 * Uses AES-256-GCM encryption with proper key management
 */
export async function encryptSensitiveData(data: string): Promise<string> {
  const crypto = await import('crypto')
  const encryptionKey = process.env.VAULT_ENCRYPTION_KEY
  
  if (!encryptionKey) {
    throw new Error('VAULT_ENCRYPTION_KEY environment variable is required')
  }
  
  // Derive a 32-byte key from the environment variable
  const key = crypto.createHash('sha256').update(encryptionKey).digest()
  
  // Generate a random 12-byte IV for GCM
  const iv = crypto.randomBytes(12)
  
  // Create cipher
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  
  // Encrypt the data
  let encrypted = cipher.update(data, 'utf8', 'base64')
  encrypted += cipher.final('base64')
  
  // Get the auth tag (required for GCM)
  const authTag = cipher.getAuthTag()
  
  // Combine IV + authTag + encrypted data
  // Format: base64(iv:12bytes + authTag:16bytes + encrypted)
  const combined = Buffer.concat([
    iv,
    authTag,
    Buffer.from(encrypted, 'base64')
  ])
  
  return combined.toString('base64')
}

/**
 * Decrypt sensitive data
 */
export async function decryptSensitiveData(encryptedData: string): Promise<string> {
  const crypto = await import('crypto')
  const encryptionKey = process.env.VAULT_ENCRYPTION_KEY
  
  if (!encryptionKey) {
    throw new Error('VAULT_ENCRYPTION_KEY environment variable is required')
  }
  
  // Derive the same 32-byte key
  const key = crypto.createHash('sha256').update(encryptionKey).digest()
  
  // Parse the combined data
  const combined = Buffer.from(encryptedData, 'base64')
  
  // Extract IV (first 12 bytes), authTag (next 16 bytes), and encrypted data (rest)
  const iv = combined.subarray(0, 12)
  const authTag = combined.subarray(12, 28)
  const encrypted = combined.subarray(28)
  
  // Create decipher
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  
  // Decrypt
  let decrypted = decipher.update(encrypted, undefined, 'utf8')
  decrypted += decipher.final('utf8')
  
  return decrypted
}

/**
 * Upload file to Rift Vault (Supabase Storage)
 */
export async function uploadToVault(
  file: File,
  riftId: string,
  userId: string,
  options?: {
    viewOnly?: boolean
    folder?: string
  }
): Promise<VaultFileMetadata> {
  const supabase = createServerClient()
  
  // Validate file size (max 50MB for consistency)
  const maxSize = 50 * 1024 * 1024 // 50MB
  if (file.size > maxSize) {
    throw new Error(`File size exceeds maximum allowed (50MB). File size: ${(file.size / 1024 / 1024).toFixed(2)}MB`)
  }
  
  // Minimum file size check
  if (file.size < 100) {
    throw new Error('File is too small (minimum 100 bytes)')
  }
  
  // Generate file hash
  const fileHash = await generateFileHash(file)
  
  // Generate unique filename
  const fileExt = file.name.split('.').pop() || 'bin'
  const timestamp = Date.now()
  const uniqueName = `${timestamp}-${fileHash.substring(0, 8)}.${fileExt}`
  const folder = options?.folder || 'vault'
  const storagePath = `${folder}/${riftId}/${uniqueName}`
  
  // Convert File to ArrayBuffer for Supabase
  const arrayBuffer = await file.arrayBuffer()
  
  // Upload to Supabase Storage
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('rift-vault')
    .upload(storagePath, arrayBuffer, {
      contentType: file.type,
      upsert: false, // Don't overwrite existing files
    })
  
  if (uploadError) {
    console.error('Vault upload error:', uploadError)
    throw new Error(`Failed to upload file: ${uploadError.message}`)
  }
  
  // Return metadata
  return {
    fileName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    fileHash,
    storagePath,
    uploadedBy: userId,
    uploadedAt: new Date(),
    virusScanStatus: 'PENDING', // Will be updated by virus scan job
    viewOnly: options?.viewOnly ?? true, // Default to view-only
  }
}

/**
 * Get secure signed URL for file access
 * Expires after specified seconds (default 1 hour)
 */
export async function getSecureFileUrl(
  storagePath: string,
  expiresIn: number = 3600 // 1 hour
): Promise<string> {
  const supabase = createServerClient()
  
  const { data, error } = await supabase.storage
    .from('rift-vault')
    .createSignedUrl(storagePath, expiresIn)
  
  if (error) {
    console.error('Error creating signed URL:', error)
    throw new Error(`Failed to create secure URL: ${error.message}`)
  }
  
  return data.signedUrl
}

/**
 * Check if file exists in vault by hash
 * Useful for duplicate detection
 */
export async function checkFileExistsByHash(fileHash: string): Promise<boolean> {
  // This would query a database table tracking vault files
  // For now, return false - implement with proper database tracking
  return false
}

/**
 * Validate file type
 */
export function validateFileType(file: File, allowedTypes?: string[]): boolean {
  if (!allowedTypes || allowedTypes.length === 0) {
    return true // No restrictions
  }
  
  const fileType = file.type
  const fileExt = file.name.split('.').pop()?.toLowerCase()
  
  return allowedTypes.some(type => {
    if (type.includes('/')) {
      // MIME type match
      return fileType === type || fileType.startsWith(type.split('/')[0] + '/')
    } else {
      // Extension match
      return fileExt === type.toLowerCase()
    }
  })
}

/**
 * Get allowed file types for different item types
 */
export function getAllowedFileTypes(itemType: string): string[] {
  switch (itemType) {
    case 'DIGITAL':
      return [
        'application/pdf',
        'application/zip',
        'application/x-zip-compressed',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'image/jpeg',
        'image/png',
        'image/gif',
        'video/mp4',
        'video/quicktime',
        'audio/mpeg',
        'audio/mp3',
      ]
    default:
      return [] // No restrictions
  }
}

