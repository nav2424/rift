/**
 * Utility functions for displaying item types with proper labels
 */

export type ItemType = 'PHYSICAL' | 'DIGITAL_GOODS' | 'OWNERSHIP_TRANSFER' | 'SERVICES' | 'TICKETS' | 'LICENSE_KEYS'

/**
 * Get the display label for an item type
 */
export function getItemTypeLabel(itemType: string): string {
  switch (itemType) {
    case 'SERVICES':
      return 'UGC Brand Deal'
    case 'DIGITAL_GOODS':
      return 'Content Deliverables'
    case 'PHYSICAL':
      return 'Physical Goods'
    case 'OWNERSHIP_TRANSFER':
      return 'Ownership Transfer'
    case 'TICKETS':
      return 'Tickets'
    case 'LICENSE_KEYS':
      return 'License Keys'
    default:
      // Fallback: format the enum value nicely
      return itemType.replace(/_/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
  }
}

/**
 * Get a short label for an item type (for compact displays)
 */
export function getItemTypeShortLabel(itemType: string): string {
  switch (itemType) {
    case 'SERVICES':
      return 'UGC'
    case 'DIGITAL_GOODS':
      return 'Digital'
    case 'PHYSICAL':
      return 'Physical'
    case 'OWNERSHIP_TRANSFER':
      return 'Ownership'
    case 'TICKETS':
      return 'Tickets'
    case 'LICENSE_KEYS':
      return 'License'
    default:
      return itemType.replace(/_/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
  }
}
