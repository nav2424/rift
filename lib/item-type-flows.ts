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
 * LAUNCH ITEM TYPES: TICKETS, DIGITAL, SERVICES, LICENSE_KEYS
 * PHYSICAL removed from launch scope
 */
export const ITEM_TYPE_CONFIGS: Partial<Record<ItemType, ItemTypeConfig>> = {
  DIGITAL: {
    gracePeriodHours: 24, // 24-hour protection window - auto-release if no dispute
    requiresShipmentProof: false,
    requiresTracking: false,
    allowsAutoRelease: true, // Auto-release after seller submits proof + 24 hours
    description: 'Seller submits proof → 24-hour protection window → Auto-release (unless buyer disputes)',
  },
  TICKETS: {
    gracePeriodHours: 24, // 24-hour protection window - auto-release if no dispute
    requiresShipmentProof: false,
    requiresTracking: false,
    allowsAutoRelease: true, // Auto-release after seller submits proof + 24 hours
    description: 'Seller submits proof → 24-hour protection window → Auto-release (unless buyer disputes)',
  },
  SERVICES: {
    gracePeriodHours: 72, // 72-hour protection window for services
    requiresShipmentProof: false,
    requiresTracking: false,
    allowsAutoRelease: true, // Auto-release after seller submits proof + 72 hours
    description: 'Seller submits proof → 72-hour protection window → Auto-release (unless buyer disputes)',
  },
  LICENSE_KEYS: {
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
  return ITEM_TYPE_CONFIGS[itemType]
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
  return ITEM_TYPE_CONFIGS[itemType].requiresShipmentProof
}

/**
 * Check if item type requires tracking number
 */
export function requiresTracking(itemType: ItemType): boolean {
  return ITEM_TYPE_CONFIGS[itemType].requiresTracking
}

/**
 * Get grace period hours for item type
 */
export function getGracePeriodHours(itemType: ItemType): number {
  return ITEM_TYPE_CONFIGS[itemType].gracePeriodHours
}

/**
 * Check if auto-release is allowed for this item type
 */
export function allowsAutoRelease(itemType: ItemType): boolean {
  return ITEM_TYPE_CONFIGS[itemType].allowsAutoRelease
}

