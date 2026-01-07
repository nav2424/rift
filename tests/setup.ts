/**
 * Test Setup
 * Configures test environment, mocks, and utilities
 */

import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'

// Test DB safety check
// For integration tests, we need a real database
// For unit tests, we can use mocks
const testDbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL

if (!testDbUrl) {
  // Only warn for integration tests - they'll fail when trying to use Prisma
  // Unit tests can work without DB
  console.warn('⚠️  WARNING: DATABASE_URL or TEST_DATABASE_URL not set.')
  console.warn('   Integration tests will fail. Set TEST_DATABASE_URL for integration tests.')
  console.warn('   Using default test database URL (may not work):')
  const defaultUrl = 'postgresql://test:test@localhost:5432/rift_test'
  process.env.DATABASE_URL = defaultUrl
  // Also set it for Prisma to pick up
  if (!process.env.TEST_DATABASE_URL) {
    process.env.TEST_DATABASE_URL = defaultUrl
  }
} else {
  // Ensure DATABASE_URL is set for Prisma
  process.env.DATABASE_URL = testDbUrl
  
  // Warn if not using test database (but don't fail in CI)
  if (!testDbUrl.includes('test') && !testDbUrl.includes('TEST') && process.env.CI !== 'true') {
    console.warn('⚠️  WARNING: DATABASE_URL does not appear to be a test database!')
    console.warn('   Tests will run against:', testDbUrl.replace(/:[^:@]+@/, ':****@'))
  }
}

// Ensure DATABASE_URL is always a valid PostgreSQL URL format
if (process.env.DATABASE_URL && !process.env.DATABASE_URL.match(/^postgres(ql)?:\/\//)) {
  console.error('❌ Invalid DATABASE_URL format. Must start with postgresql:// or postgres://')
  console.error('   Current value:', process.env.DATABASE_URL.substring(0, 20) + '...')
  // Don't throw here - let the test fail with a clearer error
}

// Mock environment variables
process.env.DATABASE_URL = testDbUrl
process.env.NEXTAUTH_SECRET = 'test-secret-key-for-testing-only'
process.env.NEXTAUTH_URL = 'http://localhost:3000'
const env = process.env as any
env.JWT_SECRET = 'test-jwt-secret-for-testing-only'
env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
env.NODE_ENV = 'test'

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

// For integration tests, we want to use real Prisma
// Only mock Prisma for unit tests that explicitly need it
// Integration tests should import real Prisma from lib/prisma

// Note: Integration tests like refund-dispute-stress.test.ts should NOT mock Prisma
// They need real database operations to test constraints and actual behavior

beforeEach(async () => {
  // Clean up test data if needed
  // In real setup, you'd truncate test tables
  vi.clearAllMocks()
})

afterEach(async () => {
  // Clean up after each test
  vi.clearAllMocks()
})

