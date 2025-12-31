/**
 * Type-Locked Proof Validation
 * Enforces that proof submissions match the item type and required fields
 */

import { ItemType, VaultAssetType, ProofType } from '@prisma/client'

export interface ProofRequirement {
  allowedAssetTypes: VaultAssetType[] // What asset types are allowed for this item type
  requiredFields: string[] // Required fields in proof payload
  minAssets: number // Minimum number of assets required
  maxAssets: number // Maximum number of assets allowed
  description: string
}

/**
 * Proof requirements by item type - ENFORCES TYPE-LOCKED SUBMISSION
 * LAUNCH SCOPE: TICKETS, DIGITAL, SERVICES, LICENSE_KEYS only
 */
export const PROOF_REQUIREMENTS: Partial<Record<ItemType, ProofRequirement>> = {
  TICKETS: {
    allowedAssetTypes: ['TICKET_PROOF', 'FILE'], // Platform transfer confirmation OR QR asset
    requiredFields: ['eventName', 'eventDate', 'platform'], // Must declare these
    minAssets: 1,
    maxAssets: 5, // Allow multiple views/angles of ticket
    description: 'Must include event details and one of: platform transfer confirmation OR QR asset',
  },
  DIGITAL: {
    allowedAssetTypes: ['FILE'], // Vault file upload only (no external links)
    requiredFields: [], // No mandatory fields, file itself is proof
    minAssets: 1,
    maxAssets: 10, // Allow multiple files
    description: 'Must upload file(s) to Rift Vault (no external links)',
  },
  SERVICES: {
    allowedAssetTypes: ['FILE', 'URL', 'TEXT_INSTRUCTIONS'], // Deliverables (snapshot required for URLs)
    requiredFields: ['deliverySummary', 'scopeCompletion'], // Must describe what was delivered
    minAssets: 0, // Services might not require files
    maxAssets: 20,
    description: 'Must provide completion summary and deliverables (snapshot required for URLs)',
  },
  LICENSE_KEYS: {
    allowedAssetTypes: ['LICENSE_KEY', 'FILE', 'URL'], // Masked key entry OR account invite proof OR vault-hosted download
    requiredFields: ['softwareName', 'licenseType'], // Must declare software and license type
    minAssets: 1,
    maxAssets: 5, // Allow multiple keys or download links
    description: 'Must provide: masked key entry OR account invite proof OR vault-hosted download',
  },
}

/**
 * Validate that proof assets match item type requirements
 * Hard rule: no "other", no free-form uploads, no bypass routes
 */
export function validateProofTypeLock(
  itemType: ItemType,
  assetTypes: VaultAssetType[],
  proofPayload: Record<string, any>
): { valid: boolean; errors: string[] } {
  const requirements = PROOF_REQUIREMENTS[itemType]
  
  if (!requirements) {
    return {
      valid: false,
      errors: [`Item type ${itemType} is not supported in launch scope. Supported: TICKETS, DIGITAL, SERVICES, LICENSE_KEYS`],
    }
  }
  
  const errors: string[] = []
  
  // Check asset count
  if (assetTypes.length < requirements.minAssets) {
    errors.push(
      `At least ${requirements.minAssets} asset(s) required for ${itemType} items. Found: ${assetTypes.length}`
    )
  }
  
  if (assetTypes.length > requirements.maxAssets) {
    errors.push(
      `Maximum ${requirements.maxAssets} asset(s) allowed for ${itemType} items. Found: ${assetTypes.length}`
    )
  }
  
  // Check asset types are allowed
  const invalidTypes = assetTypes.filter(
    type => !requirements.allowedAssetTypes.includes(type)
  )
  
  if (invalidTypes.length > 0) {
    errors.push(
      `Invalid asset types for ${itemType}: ${invalidTypes.join(', ')}. Allowed: ${requirements.allowedAssetTypes.join(', ')}`
    )
  }
  
  // Check required fields
  for (const field of requirements.requiredFields) {
    if (!proofPayload[field] || (typeof proofPayload[field] === 'string' && proofPayload[field].trim() === '')) {
      errors.push(`Required field missing for ${itemType}: ${field}`)
    }
  }
  
  // SERVICES: If URL provided, require snapshot proof
  if (itemType === 'SERVICES' && assetTypes.includes('URL')) {
    if (!proofPayload.urlSnapshot && !assetTypes.includes('FILE')) {
      errors.push('SERVICES items with URLs must include snapshot proof (upload snapshot as FILE)')
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Get proof type from item type (for database compatibility)
 */
export function getProofTypeFromItemType(itemType: ItemType): ProofType {
  switch (itemType) {
    case 'SERVICES':
      return 'SERVICE'
    case 'DIGITAL':
    case 'TICKETS':
    case 'LICENSE_KEYS':
      return 'DIGITAL'
    default:
      // Launch scope: default to DIGITAL for unsupported types
      return 'DIGITAL'
  }
}
