/**
 * Item Type Specific Flow Configuration
 * Different protection and payout rules for each item type
 */

import { ItemType } from '@prisma/client'

export interface ItemTypeConfig {
  gracePeriodHours: number
  requiresShipmentProof: boolean
  requiresTracking: boolean
  allowsAutoRelease: boolean
  description: string
}

/**
 * Item type configs for launch scope
 * LAUNCH ITEM TYPES: SERVICES, OWNERSHIP_TRANSFER, DIGITAL_GOODS
 */
export const ITEM_TYPE_CONFIGS: Partial<Record<ItemType, ItemTypeConfig>> = {
  SERVICES: {
    gracePeriodHours: 72, // 72-hour protection window for services
    requiresShipmentProof: false,
    requiresTracking: false,
    allowsAutoRelease: true, // Auto-release after seller submits proof + 72 hours
    description: 'Seller submits proof → 72-hour protection window → Auto-release (unless buyer disputes)',
  },
  OWNERSHIP_TRANSFER: {
    gracePeriodHours: 48, // 48-hour protection window for ownership transfers
    requiresShipmentProof: false,
    requiresTracking: false,
    allowsAutoRelease: true, // Auto-release after seller submits proof + 48 hours
    description: 'Seller submits proof → 48-hour protection window → Auto-release (unless buyer disputes)',
  },
  DIGITAL_GOODS: {
    gracePeriodHours: 24, // 24-hour protection window - auto-release if no dispute
    requiresShipmentProof: false,
    requiresTracking: false,
    allowsAutoRelease: true, // Auto-release after seller submits proof + 24 hours
    description: 'Seller submits proof → 24-hour protection window → Auto-release (unless buyer disputes)',
  },
}

/**
 * Get configuration for an item type
 */
export function getItemTypeConfig(itemType: ItemType): ItemTypeConfig {
  const config = ITEM_TYPE_CONFIGS[itemType]
  if (!config) {
    // Fallback to DIGITAL_GOODS config if not defined
    return ITEM_TYPE_CONFIGS.DIGITAL_GOODS || {
      gracePeriodHours: 24,
      requiresShipmentProof: false,
      requiresTracking: false,
      allowsAutoRelease: true,
      description: 'Default configuration',
    }
  }
  return config
}

/**
 * Check if hybrid protection (tracking verification, etc.) applies to this item type
 * LAUNCH: No hybrid protection (PHYSICAL removed)
 */
export function usesHybridProtection(itemType: ItemType): boolean {
  return false // Launch scope: no physical items
}

/**
 * Check if item type requires shipment proof
 */
export function requiresShipmentProof(itemType: ItemType): boolean {
  return getItemTypeConfig(itemType).requiresShipmentProof
}

/**
 * Check if item type requires tracking number
 */
export function requiresTracking(itemType: ItemType): boolean {
  return getItemTypeConfig(itemType).requiresTracking
}

/**
 * Get grace period hours for item type
 */
export function getGracePeriodHours(itemType: ItemType): number {
  return getItemTypeConfig(itemType).gracePeriodHours
}

/**
 * Check if auto-release is allowed for this item type
 */
export function allowsAutoRelease(itemType: ItemType): boolean {
  return getItemTypeConfig(itemType).allowsAutoRelease
}
