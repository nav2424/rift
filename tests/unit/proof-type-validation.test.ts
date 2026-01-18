/**
 * Unit Tests: Type-Locked Proof Validation
 * Tests lib/proof-type-validation.ts
 */

import { describe, it, expect } from 'vitest'
import { validateProofTypeLock, getProofTypeFromItemType } from '@/lib/proof-type-validation'
import { ItemType } from '@prisma/client'

describe('Type-Locked Proof Validation', () => {

  describe('DIGITAL_GOODS', () => {
    it('should validate valid DIGITAL proof with FILE', () => {
      const result = validateProofTypeLock(
        'DIGITAL_GOODS' as ItemType,
        ['FILE'],
        {}
      )
      
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should validate DIGITAL proof with multiple files', () => {
      const result = validateProofTypeLock(
        'DIGITAL_GOODS' as ItemType,
        ['FILE', 'FILE', 'FILE'],
        {}
      )
      
      expect(result.valid).toBe(true)
    })

    it('should reject DIGITAL proof with URL', () => {
      const result = validateProofTypeLock(
        'DIGITAL_GOODS' as ItemType,
        ['URL'], // Not allowed for DIGITAL
        {}
      )
      
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('Invalid asset types'))).toBe(true)
    })

    it('should reject DIGITAL proof with no assets', () => {
      const result = validateProofTypeLock(
        'DIGITAL_GOODS' as ItemType,
        [],
        {}
      )
      
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('At least 1 asset'))).toBe(true)
    })

    it('should reject DIGITAL proof with too many assets', () => {
      const result = validateProofTypeLock(
        'DIGITAL_GOODS' as ItemType,
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

  describe('Unsupported Item Types', () => {
    it('should reject PHYSICAL item type (not in launch scope)', () => {
      const result = validateProofTypeLock(
        'PHYSICAL' as ItemType,
        ['FILE'],
        {}
      )
      
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('not supported'))).toBe(true)
    })

    it('should reject TRACKING asset type (does not exist)', () => {
      // TRACKING is not a valid VaultAssetType in launch scope
      const result = validateProofTypeLock(
        'DIGITAL_GOODS' as ItemType,
        ['TRACKING' as any], // Unknown asset type
        {}
      )
      
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('Invalid asset types'))).toBe(true)
    })
  })

  describe('getProofTypeFromItemType', () => {
    it('should return DIGITAL for DIGITAL_GOODS', () => {
      expect(getProofTypeFromItemType('DIGITAL_GOODS' as ItemType)).toBe('DIGITAL')
    })

    it('should return SERVICE for SERVICES', () => {
      expect(getProofTypeFromItemType('SERVICES' as ItemType)).toBe('SERVICE')
    })
  })
})

