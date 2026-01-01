/**
 * Test Setup
 * Configures test environment, mocks, and utilities
 */

import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'

// Mock environment variables
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/rift_test'
process.env.NEXTAUTH_SECRET = 'test-secret-key-for-testing-only'
process.env.NEXTAUTH_URL = 'http://localhost:3000'
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only'
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
(process.env as any).NODE_ENV = 'test'

// Mock PrismaClient constructor to prevent instantiation errors
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    riftTransaction: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    vaultAsset: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    vaultEvent: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    dispute: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    userRiskProfile: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    walletLedgerEntry: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    vault_assets: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    vault_events: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    admin_reviews: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $disconnect: vi.fn(),
    $connect: vi.fn(),
  })),
  // Export Prisma types/enums that tests might need
  ItemType: {},
  VaultAssetType: {},
  EscrowStatus: {},
  ProofType: {},
  VaultEventType: {},
  VaultActorRole: {},
  WalletLedgerType: {
    CREDIT_RELEASE: 'CREDIT_RELEASE',
    DEBIT_WITHDRAWAL: 'DEBIT_WITHDRAWAL',
    DEBIT_CHARGEBACK: 'DEBIT_CHARGEBACK',
    DEBIT_REFUND: 'DEBIT_REFUND',
  },
}))

// Mock the prisma instance export
vi.mock('@/lib/prisma', () => {
  const mockPrisma = {
    riftTransaction: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    vaultAsset: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    vaultEvent: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    dispute: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    userRiskProfile: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    walletLedgerEntry: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    proof: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    timelineEvent: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    vault_assets: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    vault_events: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    admin_reviews: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $disconnect: vi.fn(),
    $connect: vi.fn(),
    $transaction: vi.fn(),
  }
  
  return {
    prisma: mockPrisma,
    withRetry: vi.fn((fn) => fn()),
  }
})

beforeEach(async () => {
  // Clean up test data if needed
  // In real setup, you'd truncate test tables
  vi.clearAllMocks()
})

afterEach(async () => {
  // Clean up after each test
  vi.clearAllMocks()
})

