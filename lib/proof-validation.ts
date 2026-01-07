/**
 * Proof validation system
 * Validates proof submissions based on item type
 */

import { ProofType, ProofStatus } from '@prisma/client'

interface ProofValidationResult {
  isValid: boolean
  status: ProofStatus
  rejectionReason?: string
}

/**
 * Validate tracking number format
 */
function validateTrackingNumber(trackingNumber: string): boolean {
  if (!trackingNumber || trackingNumber.trim().length === 0) {
    return false
  }

  // Basic validation: non-empty, reasonable length (5-50 chars)
  const trimmed = trackingNumber.trim()
  return trimmed.length >= 5 && trimmed.length <= 50
}

/**
 * Validate physical proof
 */
function validatePhysicalProof(payload: any): ProofValidationResult {
  const { trackingNumber, carrier } = payload

  if (!trackingNumber || !validateTrackingNumber(trackingNumber)) {
    return {
      isValid: false,
      status: ProofStatus.REJECTED,
      rejectionReason: 'Valid tracking number is required for physical items',
    }
  }

  if (!carrier || carrier.trim().length === 0) {
    return {
      isValid: false,
      status: ProofStatus.REJECTED,
      rejectionReason: 'Shipping carrier is required',
    }
  }

  return {
    isValid: true,
    status: ProofStatus.VALID,
  }
}

/**
 * Validate service proof
 */
function validateServiceProof(payload: any): ProofValidationResult {
  const { completionConfirmation, messageLogReference } = payload

  if (!completionConfirmation && !messageLogReference) {
    return {
      isValid: false,
      status: ProofStatus.REJECTED,
      rejectionReason: 'Completion confirmation or message log reference is required',
    }
  }

  return {
    isValid: true,
    status: ProofStatus.VALID,
  }
}

/**
 * Validate digital proof
 */
function validateDigitalProof(payload: any): ProofValidationResult {
  const { fileHash, accessCredentialDelivery, timestamp } = payload

  if (!fileHash && !accessCredentialDelivery) {
    return {
      isValid: false,
      status: ProofStatus.REJECTED,
      rejectionReason: 'File hash or access credential delivery log is required',
    }
  }

  if (accessCredentialDelivery && !timestamp) {
    return {
      isValid: false,
      status: ProofStatus.REJECTED,
      rejectionReason: 'Timestamp is required for access credential delivery',
    }
  }

  return {
    isValid: true,
    status: ProofStatus.VALID,
  }
}

/**
 * Validate proof based on type
 */
export function validateProof(
  proofType: ProofType,
  proofPayload: any
): ProofValidationResult {
  if (!proofPayload || typeof proofPayload !== 'object') {
    return {
      isValid: false,
      status: ProofStatus.REJECTED,
      rejectionReason: 'Invalid proof payload',
    }
  }

  switch (proofType) {
    case ProofType.PHYSICAL:
      return validatePhysicalProof(proofPayload)
    case ProofType.SERVICE:
      return validateServiceProof(proofPayload)
    case ProofType.DIGITAL:
      return validateDigitalProof(proofPayload)
    default:
      return {
        isValid: false,
        status: ProofStatus.REJECTED,
        rejectionReason: 'Unknown proof type',
      }
  }
}

/**
 * Get proof type from item type
 */
export function getProofTypeFromItemType(itemType: string): ProofType {
  switch (itemType) {
    case 'PHYSICAL':
      return ProofType.PHYSICAL
    case 'SERVICES':
      return ProofType.SERVICE
    case 'DIGITAL_GOODS':
    case 'OWNERSHIP_TRANSFER':
      return ProofType.DIGITAL
    default:
      return ProofType.PHYSICAL
  }
}
