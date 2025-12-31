/**
 * Unit Tests: Type-Locked Proof Validation
 * Tests lib/proof-type-validation.ts
 */

import { describe, it, expect } from 'vitest'
import { validateProofTypeLock, getProofTypeFromItemType } from '@/lib/proof-type-validation'
import { ItemType, VaultAssetType } from '@prisma/client'

describe('Type-Locked Proof Validation', () => {
  describe('TICKETS', () => {
    it('should validate valid TICKETS proof with event details', () => {
      const result = validateProofTypeLock(
        'TICKETS' as ItemType,
        ['TICKET_PROOF'],
        {
          eventName: 'Concert',
          eventDate: '2025-02-01',
          platform: 'Ticketmaster',
        }
      )
      
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should validate TICKETS proof with FILE asset', () => {
      const result = validateProofTypeLock(
        'TICKETS' as ItemType,
        ['FILE'],
        {
          eventName: 'Concert',
          eventDate: '2025-02-01',
          platform: 'Ticketmaster',
        }
      )
      
      expect(result.valid).toBe(true)
    })

    it('should reject TICKETS proof without eventName', () => {
      const result = validateProofTypeLock(
        'TICKETS' as ItemType,
        ['TICKET_PROOF'],
        {
          eventDate: '2025-02-01',
          platform: 'Ticketmaster',
        }
      )
      
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('eventName'))).toBe(true)
    })

    it('should reject TICKETS proof without eventDate', () => {
      const result = validateProofTypeLock(
        'TICKETS' as ItemType,
        ['TICKET_PROOF'],
        {
          eventName: 'Concert',
          platform: 'Ticketmaster',
        }
      )
      
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('eventDate'))).toBe(true)
    })

    it('should reject TICKETS proof without platform', () => {
      const result = validateProofTypeLock(
        'TICKETS' as ItemType,
        ['TICKET_PROOF'],
        {
          eventName: 'Concert',
          eventDate: '2025-02-01',
        }
      )
      
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('platform'))).toBe(true)
    })

    it('should reject unknown asset types for TICKETS', () => {
      // TRACKING doesn't exist in launch scope - should be rejected as unknown
      const result = validateProofTypeLock(
        'TICKETS' as ItemType,
        ['TRACKING' as any], // Unknown asset type
        {
          eventName: 'Concert',
          eventDate: '2025-02-01',
          platform: 'Ticketmaster',
        }
      )
      
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('Invalid asset types'))).toBe(true)
    })

    it('should reject TICKETS proof with too few assets', () => {
      const result = validateProofTypeLock(
        'TICKETS' as ItemType,
        [], // No assets
        {
          eventName: 'Concert',
          eventDate: '2025-02-01',
          platform: 'Ticketmaster',
        }
      )
      
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('At least 1 asset'))).toBe(true)
    })

    it('should reject TICKETS proof with too many assets', () => {
      const result = validateProofTypeLock(
        'TICKETS' as ItemType,
        Array(6).fill('TICKET_PROOF'), // 6 assets (max is 5)
        {
          eventName: 'Concert',
          eventDate: '2025-02-01',
          platform: 'Ticketmaster',
        }
      )
      
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('Maximum 5 asset'))).toBe(true)
    })

    it('should reject empty string in required fields', () => {
      const result = validateProofTypeLock(
        'TICKETS' as ItemType,
        ['TICKET_PROOF'],
        {
          eventName: '   ', // Empty string
          eventDate: '2025-02-01',
          platform: 'Ticketmaster',
        }
      )
      
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('eventName'))).toBe(true)
    })
  })

  describe('DIGITAL', () => {
    it('should validate valid DIGITAL proof with FILE', () => {
      const result = validateProofTypeLock(
        'DIGITAL' as ItemType,
        ['FILE'],
        {}
      )
      
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should validate DIGITAL proof with multiple files', () => {
      const result = validateProofTypeLock(
        'DIGITAL' as ItemType,
        ['FILE', 'FILE', 'FILE'],
        {}
      )
      
      expect(result.valid).toBe(true)
    })

    it('should reject DIGITAL proof with URL', () => {
      const result = validateProofTypeLock(
        'DIGITAL' as ItemType,
        ['URL'], // Not allowed for DIGITAL
        {}
      )
      
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('Invalid asset types'))).toBe(true)
    })

    it('should reject DIGITAL proof with no assets', () => {
      const result = validateProofTypeLock(
        'DIGITAL' as ItemType,
        [],
        {}
      )
      
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('At least 1 asset'))).toBe(true)
    })

    it('should reject DIGITAL proof with too many assets', () => {
      const result = validateProofTypeLock(
        'DIGITAL' as ItemType,
        Array(11).fill('FILE'), // 11 assets (max is 10)
        {}
      )
      
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('Maximum 10 asset'))).toBe(true)
    })
  })

  describe('SERVICES', () => {
    it('should validate valid SERVICES proof with summary', () => {
      const result = validateProofTypeLock(
        'SERVICES' as ItemType,
        ['FILE'],
        {
          deliverySummary: 'Completed all tasks',
          scopeCompletion: '100%',
        }
      )
      
      expect(result.valid).toBe(true)
    })

    it('should validate SERVICES proof with no assets (allowed)', () => {
      const result = validateProofTypeLock(
        'SERVICES' as ItemType,
        [],
        {
          deliverySummary: 'Completed',
          scopeCompletion: '100%',
        }
      )
      
      expect(result.valid).toBe(true)
    })

    it('should reject SERVICES proof without deliverySummary', () => {
      const result = validateProofTypeLock(
        'SERVICES' as ItemType,
        ['FILE'],
        {
          scopeCompletion: '100%',
        }
      )
      
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('deliverySummary'))).toBe(true)
    })

    it('should reject SERVICES proof without scopeCompletion', () => {
      const result = validateProofTypeLock(
        'SERVICES' as ItemType,
        ['FILE'],
        {
          deliverySummary: 'Completed',
        }
      )
      
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('scopeCompletion'))).toBe(true)
    })

    it('should reject SERVICES proof with URL but no snapshot', () => {
      const result = validateProofTypeLock(
        'SERVICES' as ItemType,
        ['URL'],
        {
          deliverySummary: 'Completed',
          scopeCompletion: '100%',
        }
      )
      
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('snapshot proof'))).toBe(true)
    })

    it('should validate SERVICES proof with URL and snapshot FILE', () => {
      const result = validateProofTypeLock(
        'SERVICES' as ItemType,
        ['URL', 'FILE'],
        {
          deliverySummary: 'Completed',
          scopeCompletion: '100%',
          urlSnapshot: true,
        }
      )
      
      expect(result.valid).toBe(true)
    })

    it('should validate SERVICES proof with TEXT_INSTRUCTIONS', () => {
      const result = validateProofTypeLock(
        'SERVICES' as ItemType,
        ['TEXT_INSTRUCTIONS'],
        {
          deliverySummary: 'Completed',
          scopeCompletion: '100%',
        }
      )
      
      expect(result.valid).toBe(true)
    })
  })

  describe('LICENSE_KEYS', () => {
    it('should validate valid LICENSE_KEYS proof', () => {
      const result = validateProofTypeLock(
        'LICENSE_KEYS' as ItemType,
        ['LICENSE_KEY'],
        {
          softwareName: 'Adobe Photoshop',
          licenseType: 'SINGLE_USE',
        }
      )
      
      expect(result.valid).toBe(true)
    })

    it('should validate LICENSE_KEYS proof with FILE', () => {
      const result = validateProofTypeLock(
        'LICENSE_KEYS' as ItemType,
        ['FILE'],
        {
          softwareName: 'Adobe Photoshop',
          licenseType: 'SINGLE_USE',
        }
      )
      
      expect(result.valid).toBe(true)
    })

    it('should reject LICENSE_KEYS proof without softwareName', () => {
      const result = validateProofTypeLock(
        'LICENSE_KEYS' as ItemType,
        ['LICENSE_KEY'],
        {
          licenseType: 'SINGLE_USE',
        }
      )
      
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('softwareName'))).toBe(true)
    })

    it('should reject LICENSE_KEYS proof without licenseType', () => {
      const result = validateProofTypeLock(
        'LICENSE_KEYS' as ItemType,
        ['LICENSE_KEY'],
        {
          softwareName: 'Adobe Photoshop',
        }
      )
      
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('licenseType'))).toBe(true)
    })

    it('should reject LICENSE_KEYS proof with no assets', () => {
      const result = validateProofTypeLock(
        'LICENSE_KEYS' as ItemType,
        [],
        {
          softwareName: 'Adobe Photoshop',
          licenseType: 'SINGLE_USE',
        }
      )
      
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('At least 1 asset'))).toBe(true)
    })
  })

  describe('Unsupported Item Types', () => {
    it('should reject PHYSICAL item type (not in launch scope)', () => {
      const result = validateProofTypeLock(
        'PHYSICAL' as ItemType,
        ['FILE'],
        {}
      )
      
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('not supported in launch scope'))).toBe(true)
    })

    it('should reject TRACKING asset type (does not exist)', () => {
      // TRACKING is not a valid VaultAssetType in launch scope
      const result = validateProofTypeLock(
        'DIGITAL' as ItemType,
        ['TRACKING' as any], // Unknown asset type
        {}
      )
      
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('Invalid asset types'))).toBe(true)
    })
  })

  describe('getProofTypeFromItemType', () => {
    it('should return DIGITAL for TICKETS', () => {
      expect(getProofTypeFromItemType('TICKETS' as ItemType)).toBe('DIGITAL')
    })

    it('should return DIGITAL for DIGITAL', () => {
      expect(getProofTypeFromItemType('DIGITAL' as ItemType)).toBe('DIGITAL')
    })

    it('should return SERVICE for SERVICES', () => {
      expect(getProofTypeFromItemType('SERVICES' as ItemType)).toBe('SERVICE')
    })

    it('should return DIGITAL for LICENSE_KEYS', () => {
      expect(getProofTypeFromItemType('LICENSE_KEYS' as ItemType)).toBe('DIGITAL')
    })
  })
})

