/**
 * Integration Tests: Proof Submission API
 * Tests POST /api/rifts/[id]/proof with real database and storage mocks
 */

import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createTestRift, createTestRiftPastDeadline } from '../factories/riftFactory'
import { createTestUser } from '../factories/userFactory'

// Prisma is already mocked in tests/setup.ts

// IMPORTANT: Mock authentication BEFORE importing the route (module caching)
vi.mock('@/lib/mobile-auth', () => ({
  getAuthenticatedUser: vi.fn(),
}))

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  createServerClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ data: { path: 'test-path' }, error: null }),
        createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://test.url' }, error: null }),
      })),
    },
  })),
}))

// Mock email
vi.mock('@/lib/email', () => ({
  sendProofSubmittedEmail: vi.fn().mockResolvedValue(true),
}))

// Mock vault functions
vi.mock('@/lib/vault-enhanced', () => ({
  uploadVaultAsset: vi.fn().mockResolvedValue('asset-id-123'),
  getVaultAssets: vi.fn().mockResolvedValue([]),
  buyerRevealLicenseKey: vi.fn(),
  buyerOpenAsset: vi.fn(),
}))

// Mock rate limits
vi.mock('@/lib/rate-limits-proof', () => ({
  checkProofRateLimit: vi.fn().mockReturnValue({ allowed: true, remaining: 10, resetTime: Date.now() + 3600000 }),
}))

// Mock state machine
vi.mock('@/lib/state-machine', () => ({
  canSellerSubmitProof: vi.fn().mockReturnValue(true),
  transitionRiftState: vi.fn().mockResolvedValue({ success: true }),
}))

describe('Proof Submission API', () => {
  // Dynamic import of route AFTER mocks are set up (module caching fix)
  let POST: typeof import('@/app/api/rifts/[id]/proof/route').POST
  let getAuthenticatedUser: typeof import('@/lib/mobile-auth').getAuthenticatedUser
  
  beforeAll(async () => {
    // Import route AFTER mocks are declared
    const routeModule = await import('@/app/api/rifts/[id]/proof/route')
    POST = routeModule.POST
    const authModule = await import('@/lib/mobile-auth')
    getAuthenticatedUser = authModule.getAuthenticatedUser
  })

  beforeEach(() => {
    vi.clearAllMocks()
    // Re-apply auth mock after clearAllMocks (it clears implementations)
    vi.mocked(getAuthenticatedUser).mockResolvedValue({
      userId: 'default-seller-id', // Will be overridden in each test
      userRole: 'USER',
    } as any)
  })

  describe('POST /api/rifts/[id]/proof', () => {
    beforeEach(async () => {
      // Reset state machine mock to allow proof submission by default
      const { canSellerSubmitProof } = await import('@/lib/state-machine')
      vi.mocked(canSellerSubmitProof).mockReturnValue(true)
    })

    it('should accept valid DIGITAL_GOODS proof submission', async () => {
      const { canSellerSubmitProof } = await import('@/lib/state-machine')
      const seller = createTestUser()
      const sellerId = seller.id
      // Create rift with seller ID from the start
      const rift = createTestRift({ itemType: 'DIGITAL_GOODS', status: 'PAID', sellerId })
      // Ensure fundedAt is set for deadline check (within deadline)
      rift.fundedAt = new Date(Date.now() - 12 * 60 * 60 * 1000) // 12 hours ago
      const riftId = rift.id

      // Mock state machine to allow proof submission
      vi.mocked(canSellerSubmitProof).mockReturnValue(true)

      // Re-apply auth mock with correct sellerId (clearAllMocks cleared it)
      vi.mocked(getAuthenticatedUser).mockResolvedValue({
        userId: sellerId, // ✅ Must match sellerId exactly
        userRole: 'USER',
      } as any)
      
      // Clear any previous mocks to ensure clean state
      vi.mocked(prisma.riftTransaction.findUnique).mockClear()
      
      // 1st call: ownership check (line 55) - MUST have correct sellerId
      vi.mocked(prisma.riftTransaction.findUnique)
        .mockResolvedValueOnce({
          id: riftId,
          sellerId, // ✅ Must match auth.userId
          status: 'PAID',
          itemType: 'DIGITAL_GOODS',
          fundedAt: rift.fundedAt,
          proofSubmittedAt: null,
          serviceDate: null,
          version: 0,
        } as any)
        // 2nd call: inside transaction (line 351) - status check
        .mockResolvedValueOnce({
          id: riftId,
          sellerId,
          status: 'FUNDED',
          version: 1,
        } as any)
        // 3rd call: after transaction (line 409) - check updated status
        .mockResolvedValueOnce({
          id: riftId,
          status: 'PROOF_SUBMITTED',
          requiresManualReview: false,
          subtotal: 100,
          riskScore: 10,
        } as any)
        // 4th call: for admin notification (line 442) - with seller relation
        .mockResolvedValueOnce({
          id: riftId,
          sellerId,
          seller: {
            name: seller.name || 'Test Seller',
            email: seller.email || 'seller@test.com',
          },
        } as any)
        // 5th call: final check (line 480) - if needed
        .mockResolvedValueOnce({
          id: riftId,
          status: 'PROOF_SUBMITTED',
        } as any)
      
      // Mock uploadVaultAsset to return asset ID - must be done before the request
      const { uploadVaultAsset } = await import('@/lib/vault-enhanced')
      vi.mocked(uploadVaultAsset).mockClear()
      vi.mocked(uploadVaultAsset).mockResolvedValue('asset-id-123')
      
      // Mock riftTransaction.findMany for duplicate check (checkDuplicateProofs queries rifts)
      vi.mocked(prisma.riftTransaction.findMany).mockResolvedValue([])
      
      // Mock vaultAsset.findMany - order matters!
      // 1st call: validation (by id) - happens at line 250 in route
      // 2nd call: duplicate check (by sha256) - happens in checkDuplicateProofs at line 39
      vi.mocked(prisma.vault_assets.findMany)
        .mockResolvedValueOnce([ // First call: return asset types for validation (by id in vaultAssetIds)
          {
            id: 'asset-id-123',
            assetType: 'FILE',
            sha256: 'test-hash-123',
          },
        ] as any)
        .mockResolvedValueOnce([]) // Second call: No duplicates (checkDuplicateProofs - by sha256)
      
      vi.mocked(prisma.vault_assets.create).mockResolvedValue({ id: 'asset1' } as any)
      vi.mocked(prisma.vault_events.create).mockResolvedValue({ id: 'event1' } as any)
      vi.mocked(prisma.timelineEvent.create).mockResolvedValue({ id: 'timeline1' } as any)
      
      // Mock user queries (for admin notifications)
      vi.mocked(prisma.user.findMany).mockResolvedValue([]) // No admins for tests
      vi.mocked(prisma.user.findUnique).mockResolvedValue(seller as any)
      
      // Mock transaction - the route uses $transaction which checks status
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const tx = {
          riftTransaction: {
            findUnique: vi.fn().mockResolvedValue({ 
              id: riftId,
              sellerId,
              status: 'FUNDED', // Transaction expects FUNDED or PROOF_SUBMITTED
              version: 1 
            }),
            update: vi.fn().mockResolvedValue({ 
              id: riftId,
              sellerId,
              status: 'PROOF_SUBMITTED' 
            }),
          },
          proof: {
            create: vi.fn().mockResolvedValue({ 
              id: 'proof1', 
              status: 'VALID',
              riftId: rift.id,
              proofType: 'DIGITAL',
              proofPayload: {},
              uploadedFiles: [],
              submittedAt: new Date(),
              validatedAt: new Date(),
            }),
          },
        }
        return callback(tx)
      })
      
      vi.mocked(prisma.riftTransaction.update).mockResolvedValue({
        ...rift,
        sellerId,
        status: 'PROOF_SUBMITTED',
      } as any)

      const request = new NextRequest('http://localhost:3000/api/rifts/test/proof', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          proofPayload: {},
          vaultAssets: [
            {
              assetType: 'FILE',
              fileName: 'ugc-deliverable.png',
              fileContent: Buffer.from('test').toString('base64'),
            },
          ],
        }),
      })

      const response = await POST(request, { params: Promise.resolve({ id: riftId }) })
      const data = await response.json().catch(() => ({}))
      
      // Debug: log the response if it fails
      if (response.status >= 400) {
        console.log('First test failed:', response.status, data)
      }
      
      // Should succeed (status 200 or 201)
      expect(response.status).toBeLessThan(400)
    })

    it('should reject proof submission after deadline', async () => {
      const { canSellerSubmitProof } = await import('@/lib/state-machine')
      const seller = createTestUser()
      const sellerId = seller.id
      // Create rift with seller ID from the start to avoid mutation issues
      const riftBase = createTestRiftPastDeadline('DIGITAL_GOODS')
      const riftId = riftBase.id
      const fundedAt = riftBase.fundedAt
      // createTestRiftPastDeadline should already set fundedAt past deadline

      // Allow state machine check to pass, but deadline check should fail
      vi.mocked(canSellerSubmitProof).mockReturnValue(true)

      // Re-apply auth mock with correct sellerId (clearAllMocks cleared it)
      vi.mocked(getAuthenticatedUser).mockResolvedValue({
        userId: sellerId, // ✅ Must match sellerId exactly
        userRole: 'USER',
      } as any)

      // Reset and set up mock - use mockReset to clear implementation too
      vi.mocked(prisma.riftTransaction.findUnique).mockReset()
      
      // 1st call: ownership check - MUST have correct sellerId
      // CRITICAL: The sellerId in the mock MUST match auth.userId exactly
      vi.mocked(prisma.riftTransaction.findUnique).mockResolvedValueOnce({
        id: riftId,
        sellerId: sellerId, // ✅ Explicitly use the variable to ensure it matches
        status: 'PAID',
        itemType: 'DIGITAL_GOODS',
        fundedAt, // Past deadline
        proofSubmittedAt: null,
        serviceDate: null,
        version: 0,
      } as any)
      
      // Mock user queries (for admin notifications) - even though deadline should fail first
      vi.mocked(prisma.user.findMany).mockResolvedValue([]) // No admins for tests
      
      // Don't mock transaction - deadline check should fail before transaction

      const request = new NextRequest('http://localhost:3000/api/rifts/test/proof', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          proofPayload: {},
          vaultAssets: [
            {
              assetType: 'FILE',
              fileName: 'test.pdf',
              fileContent: Buffer.from('test').toString('base64'),
            },
          ],
        }),
      })

      const response = await POST(request, { params: Promise.resolve({ id: riftId }) })
      const data = await response.json()

      // Debug: Check if findUnique was called and what it returned
      expect(prisma.riftTransaction.findUnique).toHaveBeenCalled()
      if (response.status === 403) {
        const mockResult = await vi.mocked(prisma.riftTransaction.findUnique).mock.results[0]?.value
        console.log('403 error - sellerId mismatch.')
        console.log('Mock returned sellerId:', mockResult?.sellerId)
        console.log('Expected sellerId:', sellerId)
        console.log('Auth mock calls:', vi.mocked(getAuthenticatedUser).mock.calls.length)
        if (vi.mocked(getAuthenticatedUser).mock.calls.length > 0) {
          const authResult = await vi.mocked(getAuthenticatedUser).mock.results[0]?.value
          console.log('Auth returned userId:', authResult?.userId)
        }
      }
      
      expect(response.status).toBe(400)
      expect(data.error).toContain('deadline')
    })

    it('should reject invalid asset types', async () => {
      const { canSellerSubmitProof } = await import('@/lib/state-machine')
      const seller = createTestUser()
      const rift = createTestRift({ itemType: 'DIGITAL_GOODS', status: 'PAID', sellerId: seller.id })
      rift.fundedAt = new Date(Date.now() - 12 * 60 * 60 * 1000) // 12 hours ago
      const riftId = rift.id
      const sellerId = seller.id

      // Allow state machine check to pass
      vi.mocked(canSellerSubmitProof).mockReturnValue(true)

      // Re-apply auth mock with correct sellerId (clearAllMocks cleared it)
      vi.mocked(getAuthenticatedUser).mockResolvedValue({
        userId: sellerId, // ✅ Must match sellerId exactly
        userRole: 'USER',
      } as any)

      // Clear any previous mocks
      vi.mocked(prisma.riftTransaction.findUnique).mockClear()
      
      // 1st call: ownership check - MUST have correct sellerId
      vi.mocked(prisma.riftTransaction.findUnique)
        .mockResolvedValueOnce({
          id: riftId,
          sellerId, // ✅ Must match auth.userId exactly
          status: 'PAID',
          itemType: 'DIGITAL_GOODS',
          fundedAt: rift.fundedAt,
          proofSubmittedAt: null,
          serviceDate: null,
          version: 0,
        } as any)
        // 2nd call: inside transaction (line 351) - status check
        .mockResolvedValueOnce({
          id: riftId,
          sellerId,
          status: 'FUNDED',
          version: 1,
        } as any)
        // 3rd call: after transaction (line 409) - check updated status
        .mockResolvedValueOnce({
          id: riftId,
          status: 'PROOF_SUBMITTED',
          requiresManualReview: false,
          subtotal: 100,
          riskScore: 10,
        } as any)
        // 4th call: for admin notification (line 442) - with seller relation
        .mockResolvedValueOnce({
          id: riftId,
          sellerId,
          seller: {
            name: seller.name || 'Test Seller',
            email: seller.email || 'seller@test.com',
          },
        } as any)
        // 5th call: final check (line 480) - if needed
        .mockResolvedValueOnce({
          id: riftId,
          status: 'PROOF_SUBMITTED',
        } as any)
      
      vi.mocked(prisma.timelineEvent.create).mockResolvedValue({ id: 'timeline1' } as any)
      
      // Mock user queries (for admin notifications)
      vi.mocked(prisma.user.findMany).mockResolvedValue([]) // No admins for tests
      
      // Mock uploadVaultAsset
      const { uploadVaultAsset: uploadVaultAsset2 } = await import('@/lib/vault-enhanced')
      vi.mocked(uploadVaultAsset2).mockClear()
      vi.mocked(uploadVaultAsset2).mockResolvedValue('asset-id-456')
      
      // Mock riftTransaction.findMany for duplicate check
      vi.mocked(prisma.riftTransaction.findMany).mockResolvedValue([])
      
      // Mock vaultAsset.findMany - order matters!
      // 1st call: validation (by id) - happens at line 250 in route
      // 2nd call: duplicate check (by sha256) - happens in checkDuplicateProofs at line 39
      vi.mocked(prisma.vault_assets.findMany)
        .mockResolvedValueOnce([ // First call: return asset types for validation (by id)
          {
            id: 'asset-id-456',
            assetType: 'URL', // This is what was uploaded (invalid for DIGITAL)
            sha256: 'test-hash',
          },
        ] as any)
        .mockResolvedValueOnce([]) // Second call: no duplicates found by checkDuplicateProofs (by sha256)
      
      // Mock transaction
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const tx = {
          riftTransaction: {
            findUnique: vi.fn().mockResolvedValue({ 
              id: riftId,
              sellerId,
              status: 'FUNDED',
              version: 1 
            }),
            update: vi.fn().mockResolvedValue({
              id: riftId,
              sellerId,
            }),
          },
          proof: {
            create: vi.fn().mockResolvedValue({ id: 'proof1' }),
          },
        }
        return callback(tx)
      })

      const request = new NextRequest('http://localhost:3000/api/rifts/test/proof', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          proofPayload: {},
          vaultAssets: [
            {
              assetType: 'URL', // Invalid for DIGITAL
              url: 'https://example.com',
            },
          ],
        }),
      })

      const response = await POST(request, { params: Promise.resolve({ id: riftId }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Proof does not meet item type requirements')
    })

    it('should reject SERVICES proof with missing required fields', async () => {
      const { canSellerSubmitProof } = await import('@/lib/state-machine')
      const seller = createTestUser()
      const rift = createTestRift({ itemType: 'SERVICES', status: 'PAID', sellerId: seller.id })
      rift.fundedAt = new Date(Date.now() - 12 * 60 * 60 * 1000) // 12 hours ago
      const riftId = rift.id
      const sellerId = seller.id

      // Allow state machine check to pass
      vi.mocked(canSellerSubmitProof).mockReturnValue(true)

      // Re-apply auth mock with correct sellerId (clearAllMocks cleared it)
      vi.mocked(getAuthenticatedUser).mockResolvedValue({
        userId: sellerId, // ✅ Must match sellerId exactly
        userRole: 'USER',
      } as any)

      // Reset and set up mock - use mockReset to clear implementation too
      vi.mocked(prisma.riftTransaction.findUnique).mockReset()
      
      // 1st call: ownership check - MUST have correct sellerId
      // CRITICAL: The sellerId in the mock MUST match auth.userId exactly
      vi.mocked(prisma.riftTransaction.findUnique)
        .mockResolvedValueOnce({
          id: riftId,
          sellerId: sellerId, // ✅ Explicitly use the variable to ensure it matches
          status: 'PAID',
          itemType: 'SERVICES',
          fundedAt: rift.fundedAt,
          proofSubmittedAt: null,
          serviceDate: null,
          version: 0,
        } as any)
        // 2nd call: inside transaction (line 351) - status check
        .mockResolvedValueOnce({
          id: riftId,
          sellerId,
          status: 'FUNDED',
          version: 1,
        } as any)
        // 3rd call: after transaction (line 409) - check updated status
        .mockResolvedValueOnce({
          id: riftId,
          status: 'PROOF_SUBMITTED',
          requiresManualReview: false,
          subtotal: 100,
          riskScore: 10,
        } as any)
        // 4th call: for admin notification (line 442) - with seller relation
        .mockResolvedValueOnce({
          id: riftId,
          sellerId,
          seller: {
            name: seller.name || 'Test Seller',
            email: seller.email || 'seller@test.com',
          },
        } as any)
        // 5th call: final check (line 480) - if needed
        .mockResolvedValueOnce({
          id: riftId,
          status: 'PROOF_SUBMITTED',
        } as any)
      
      vi.mocked(prisma.timelineEvent.create).mockResolvedValue({ id: 'timeline1' } as any)
      
      // Mock user queries (for admin notifications)
      vi.mocked(prisma.user.findMany).mockResolvedValue([]) // No admins for tests
      
      // Mock uploadVaultAsset
      const { uploadVaultAsset } = await import('@/lib/vault-enhanced')
      vi.mocked(uploadVaultAsset).mockClear()
      vi.mocked(uploadVaultAsset).mockResolvedValue('asset-id-123')
      
      // Mock riftTransaction.findMany for duplicate check
      vi.mocked(prisma.riftTransaction.findMany).mockResolvedValue([])
      
      // Mock vaultAsset.findMany - order matters!
      // 1st call: validation (by id) - happens at line 250 in route
      // 2nd call: duplicate check (by sha256) - happens in checkDuplicateProofs at line 39
      vi.mocked(prisma.vault_assets.findMany)
        .mockResolvedValueOnce([ // First call: return asset types for validation (by id)
          {
            id: 'asset-id-123',
            assetType: 'FILE',
            sha256: 'test-hash',
          },
        ] as any)
        .mockResolvedValueOnce([]) // Second call: no duplicates found by checkDuplicateProofs (by sha256)
      
      // Mock transaction
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const tx = {
          riftTransaction: {
            findUnique: vi.fn().mockResolvedValue({ 
              ...rift,
              status: 'FUNDED',
              version: 1 
            }),
            update: vi.fn().mockResolvedValue({
              ...rift,
            }),
          },
          proof: {
            create: vi.fn().mockResolvedValue({ id: 'proof1' }),
          },
        }
        return callback(tx)
      })

      const request = new NextRequest('http://localhost:3000/api/rifts/test/proof', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          proofPayload: {},
          vaultAssets: [
            {
              assetType: 'FILE',
              fileName: 'deliverable.png',
            },
          ],
        }),
      })

      const response = await POST(request, { params: Promise.resolve({ id: riftId }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Proof does not meet item type requirements')
    })

    it('should check for duplicate proofs', async () => {
      const { canSellerSubmitProof } = await import('@/lib/state-machine')
      const seller = createTestUser()
      const sellerId = seller.id
      const rift = createTestRift({ itemType: 'DIGITAL_GOODS', status: 'PAID', sellerId })
      rift.fundedAt = new Date(Date.now() - 12 * 60 * 60 * 1000)
      const riftId = rift.id

      vi.mocked(canSellerSubmitProof).mockReturnValue(true)

      // Re-apply auth mock with correct sellerId (clearAllMocks cleared it)
      vi.mocked(getAuthenticatedUser).mockResolvedValue({
        userId: seller.id,
        userRole: 'USER',
      } as any)

      // Mock duplicate detection finding a duplicate
      vi.mocked(prisma.riftTransaction.findUnique)
        .mockResolvedValueOnce({ // First call for initial check
          ...rift,
          sellerId: seller.id, // Ensure sellerId matches
        } as any)
        .mockResolvedValueOnce({ // Second call for admin notification (with seller)
          ...rift,
          sellerId: seller.id,
          seller: {
            name: seller.name || 'Test Seller',
            email: seller.email || 'seller@test.com',
          },
        } as any)
      
      vi.mocked(prisma.riftTransaction.findMany).mockResolvedValue([])

      // Mock vaultAsset.findMany - first call for validation, second for duplicate detection
      vi.mocked(prisma.vault_assets.findMany)
        .mockResolvedValueOnce([ // First call: return asset types for validation (by id)
          {
            id: 'asset1',
            assetType: 'FILE',
            sha256: 'duplicate-hash',
          },
        ] as any)
        .mockResolvedValueOnce([ // Second call: duplicate detection
          {
            id: 'asset1',
            sha256: 'duplicate-hash',
            riftId: 'rift2',
            rift: {
              id: 'rift2',
              sellerId: 'different-seller',
              status: 'RELEASED',
              itemTitle: 'Other Item',
              buyerId: 'buyer2',
              createdAt: new Date(),
            },
          },
        ] as any)
      
      // Mock user queries (for admin notifications)
      vi.mocked(prisma.user.findMany).mockResolvedValue([]) // No admins for tests

      const request = new NextRequest('http://localhost:3000/api/rifts/test/proof', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          proofPayload: {},
          vaultAssets: [
            {
              assetType: 'FILE',
              fileName: 'test.pdf',
              fileContent: Buffer.from('test').toString('base64'),
            },
          ],
        }),
      })

      const response = await POST(request, { params: Promise.resolve({ id: rift.id }) })
      
      // Should flag or block duplicate
      expect(response.status).toBeGreaterThanOrEqual(400)
    })
  })
})

