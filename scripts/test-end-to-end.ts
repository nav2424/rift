/**
 * Comprehensive End-to-End Test Suite
 * Tests all security, encryption, functionality, and edge cases
 */

import { PrismaClient } from '@prisma/client'
import { encryptSensitiveData, decryptSensitiveData, uploadToVault, generateFileHash } from '../lib/vault'
import { uploadVaultAsset, getVaultAssets, buyerRevealLicenseKey, buyerOpenAsset } from '../lib/vault-enhanced'
import { verifyVaultAsset, verifyRiftProofs } from '../lib/vault-verification'
import { createHash } from 'crypto'
import { Buffer } from 'buffer'

const prisma = new PrismaClient()

interface TestResult {
  name: string
  passed: boolean
  error?: string
  details?: any
}

const results: TestResult[] = []

function logTest(name: string, passed: boolean, error?: string, details?: any) {
  results.push({ name, passed, error, details })
  const icon = passed ? '✅' : '❌'
  console.log(`${icon} ${name}`)
  if (error) {
    console.log(`   Error: ${error}`)
  }
  if (details) {
    console.log(`   Details:`, JSON.stringify(details, null, 2))
  }
}

async function testLicenseKeyEncryption() {
  console.log('\n🔐 Testing License Key Encryption...\n')
  
  try {
    // Test 1: Basic encryption/decryption
    const originalKey = 'TEST-LICENSE-KEY-12345-ABCDEF'
    const encrypted = await encryptSensitiveData(originalKey)
    const decrypted = await decryptSensitiveData(encrypted)
    
    logTest(
      'License Key: Basic encryption/decryption',
      originalKey === decrypted,
      originalKey !== decrypted ? 'Decrypted value does not match original' : undefined,
      { original: originalKey, encrypted: encrypted.substring(0, 20) + '...', decrypted }
    )
    
    // Test 2: Different keys should encrypt differently
    const key2 = 'DIFFERENT-KEY-67890'
    const encrypted2 = await encryptSensitiveData(key2)
    
    logTest(
      'License Key: Different keys encrypt differently',
      encrypted !== encrypted2,
      encrypted === encrypted2 ? 'Same encryption for different keys (security issue)' : undefined
    )
    
    // Test 3: Same key encrypts differently each time (IV is random)
    const encrypted3 = await encryptSensitiveData(originalKey)
    
    logTest(
      'License Key: Same key encrypts differently (IV randomization)',
      encrypted !== encrypted3,
      encrypted === encrypted3 ? 'Same encryption output (no IV randomization)' : undefined
    )
    
    // Test 4: Decrypt should still work (same key, different IV)
    const decrypted3 = await decryptSensitiveData(encrypted3)
    
    logTest(
      'License Key: Decrypt works with different IV',
      decrypted3 === originalKey,
      decrypted3 !== originalKey ? 'Decryption failed with different IV' : undefined
    )
    
    // Test 5: Invalid encrypted data should fail
    try {
      await decryptSensitiveData('invalid-base64-encrypted-data!!!')
      logTest(
        'License Key: Invalid encrypted data handling',
        false,
        'Should have thrown error for invalid data'
      )
    } catch (error: any) {
      logTest(
        'License Key: Invalid encrypted data handling',
        true,
        undefined,
        { error: error.message }
      )
    }
    
    // Test 6: Missing encryption key
    const originalKeyEnv = process.env.VAULT_ENCRYPTION_KEY
    delete process.env.VAULT_ENCRYPTION_KEY
    try {
      await encryptSensitiveData('test')
      logTest(
        'License Key: Missing encryption key error',
        false,
        'Should have thrown error when key is missing'
      )
    } catch (error: any) {
      logTest(
        'License Key: Missing encryption key error',
        error.message.includes('VAULT_ENCRYPTION_KEY'),
        error.message.includes('VAULT_ENCRYPTION_KEY') ? undefined : `Wrong error: ${error.message}`
      )
    } finally {
      process.env.VAULT_ENCRYPTION_KEY = originalKeyEnv
    }
    
  } catch (error: any) {
    logTest('License Key Encryption Tests', false, error.message)
  }
}

async function testFileValidation() {
  console.log('\n📁 Testing File Validation...\n')
  
  try {
    // Test 1: File size validation (too large)
    const largeBuffer = Buffer.alloc(51 * 1024 * 1024) // 51MB
    const largeFile = new File([largeBuffer], 'large-file.pdf', { type: 'application/pdf' })
    
    try {
      await uploadToVault(largeFile, 'test-rift-id', 'test-user-id')
      logTest(
        'File Validation: File size limit (50MB)',
        false,
        'Should have rejected file > 50MB'
      )
    } catch (error: any) {
      const passed = error.message.includes('50MB') || error.message.includes('size')
      logTest(
        'File Validation: File size limit (50MB)',
        passed,
        passed ? undefined : `Wrong error: ${error.message}`,
        { error: error.message }
      )
    }
    
    // Test 2: File size validation (too small)
    const smallBuffer = Buffer.alloc(50) // 50 bytes
    const smallFile = new File([smallBuffer], 'small-file.pdf', { type: 'application/pdf' })
    
    try {
      await uploadToVault(smallFile, 'test-rift-id', 'test-user-id')
      logTest(
        'File Validation: Minimum file size (100 bytes)',
        false,
        'Should have rejected file < 100 bytes'
      )
    } catch (error: any) {
      const passed = error.message.includes('too small') || error.message.includes('100 bytes')
      logTest(
        'File Validation: Minimum file size (100 bytes)',
        passed,
        passed ? undefined : `Wrong error: ${error.message}`,
        { error: error.message }
      )
    }
    
    // Test 3: Valid file size
    const validBuffer = Buffer.alloc(1024) // 1KB
    const validFile = new File([validBuffer], 'valid-file.pdf', { type: 'application/pdf' })
    
    try {
      // This will fail because we don't have a real rift, but we're testing validation
      await uploadToVault(validFile, 'test-rift-id', 'test-user-id')
      logTest(
        'File Validation: Valid file size passes',
        false,
        'Should have failed for other reasons (rift not found), not size'
      )
    } catch (error: any) {
      const passed = !error.message.includes('size') && !error.message.includes('50MB') && !error.message.includes('100 bytes')
      logTest(
        'File Validation: Valid file size passes',
        passed,
        passed ? undefined : `Failed for wrong reason: ${error.message}`,
        { error: error.message }
      )
    }
    
  } catch (error: any) {
    logTest('File Validation Tests', false, error.message)
  }
}

async function testLicenseKeyFormatValidation() {
  console.log('\n🔑 Testing License Key Format Validation...\n')
  
  try {
    // Create a test rift first
    const testUser = await prisma.user.findFirst()
    if (!testUser) {
      logTest('License Key Format: Setup', false, 'No test user found')
      return
    }
    
    const testRift = await prisma.riftTransaction.create({
      data: {
        riftNumber: 999999,
        itemTitle: 'Test Rift',
        itemDescription: 'Test',
        itemType: 'DIGITAL',
        subtotal: 100,
        buyerFee: 3,
        sellerFee: 5,
        currency: 'CAD',
        status: 'FUNDED',
        buyerId: testUser.id,
        sellerId: testUser.id,
        fundedAt: new Date(),
      },
    })
    
    // Test 1: Valid license key format
    try {
      await uploadVaultAsset(testRift.id, testUser.id, {
        assetType: 'LICENSE_KEY',
        licenseKey: 'ABC123-XYZ789-123456',
      })
      logTest(
        'License Key Format: Valid format accepted',
        true
      )
    } catch (error: any) {
      logTest(
        'License Key Format: Valid format accepted',
        false,
        error.message
      )
    }
    
    // Test 2: License key too short
    try {
      await uploadVaultAsset(testRift.id, testUser.id, {
        assetType: 'LICENSE_KEY',
        licenseKey: 'ABC',
      })
      logTest(
        'License Key Format: Too short rejected',
        false,
        'Should have rejected key < 5 characters'
      )
    } catch (error: any) {
      const passed = error.message.includes('5') || error.message.includes('length')
      logTest(
        'License Key Format: Too short rejected',
        passed,
        passed ? undefined : `Wrong error: ${error.message}`
      )
    }
    
    // Test 3: License key too long
    try {
      const longKey = 'A'.repeat(501) // 501 characters
      await uploadVaultAsset(testRift.id, testUser.id, {
        assetType: 'LICENSE_KEY',
        licenseKey: longKey,
      })
      logTest(
        'License Key Format: Too long rejected',
        false,
        'Should have rejected key > 500 characters'
      )
    } catch (error: any) {
      const passed = error.message.includes('500') || error.message.includes('length')
      logTest(
        'License Key Format: Too long rejected',
        passed,
        passed ? undefined : `Wrong error: ${error.message}`
      )
    }
    
    // Test 4: Invalid characters
    try {
      await uploadVaultAsset(testRift.id, testUser.id, {
        assetType: 'LICENSE_KEY',
        licenseKey: 'ABC@123#XYZ$789',
      })
      logTest(
        'License Key Format: Invalid characters rejected',
        false,
        'Should have rejected key with special characters'
      )
    } catch (error: any) {
      const passed = error.message.includes('invalid') || error.message.includes('character')
      logTest(
        'License Key Format: Invalid characters rejected',
        passed,
        passed ? undefined : `Wrong error: ${error.message}`
      )
    }
    
    // Cleanup
    await prisma.riftTransaction.delete({ where: { id: testRift.id } }).catch(() => {})
    
  } catch (error: any) {
    logTest('License Key Format Validation Tests', false, error.message)
  }
}

async function testVaultAssetUpload() {
  console.log('\n📤 Testing Vault Asset Upload...\n')
  
  try {
    const testUser = await prisma.user.findFirst()
    if (!testUser) {
      logTest('Vault Asset Upload: Setup', false, 'No test user found')
      return
    }
    
    const testRift = await prisma.riftTransaction.create({
      data: {
        riftNumber: 999998,
        itemTitle: 'Test Rift',
        itemDescription: 'Test',
        itemType: 'DIGITAL',
        subtotal: 100,
        buyerFee: 3,
        sellerFee: 5,
        currency: 'CAD',
        status: 'FUNDED',
        buyerId: testUser.id,
        sellerId: testUser.id,
        fundedAt: new Date(),
      },
    })
    
    // Test 1: License key upload
    try {
      const assetId = await uploadVaultAsset(testRift.id, testUser.id, {
        assetType: 'LICENSE_KEY',
        licenseKey: 'TEST-KEY-12345',
      })
      
      const asset = await prisma.vaultAsset.findUnique({
        where: { id: assetId },
      })
      
      logTest(
        'Vault Asset Upload: License key created',
        asset !== null && asset.assetType === 'LICENSE_KEY',
        asset === null ? 'Asset not created' : undefined,
        { assetId, hasEncryptedData: !!asset?.encryptedData }
      )
      
      // Test encryption is not base64 of original
      if (asset?.encryptedData) {
        const isBase64 = asset.encryptedData === Buffer.from('TEST-KEY-12345').toString('base64')
        logTest(
          'Vault Asset Upload: License key properly encrypted (not base64)',
          !isBase64,
          isBase64 ? 'Still using base64 encoding instead of encryption' : undefined
        )
      }
      
    } catch (error: any) {
      logTest(
        'Vault Asset Upload: License key upload',
        false,
        error.message
      )
    }
    
    // Test 2: URL upload
    try {
      const assetId = await uploadVaultAsset(testRift.id, testUser.id, {
        assetType: 'URL',
        url: 'https://example.com/download',
      })
      
      const asset = await prisma.vaultAsset.findUnique({
        where: { id: assetId },
      })
      
      logTest(
        'Vault Asset Upload: URL created',
        asset !== null && asset.assetType === 'URL' && asset.url === 'https://example.com/download',
        asset === null ? 'Asset not created' : undefined
      )
    } catch (error: any) {
      logTest(
        'Vault Asset Upload: URL upload',
        false,
        error.message
      )
    }
    
    // Test 3: Tracking number upload
    try {
      const assetId = await uploadVaultAsset(testRift.id, testUser.id, {
        assetType: 'TRACKING',
        trackingNumber: '1Z999AA10123456784',
      })
      
      const asset = await prisma.vaultAsset.findUnique({
        where: { id: assetId },
      })
      
      logTest(
        'Vault Asset Upload: Tracking number created',
        asset !== null && asset.assetType === 'TRACKING' && asset.trackingNumber === '1Z999AA10123456784',
        asset === null ? 'Asset not created' : undefined
      )
    } catch (error: any) {
      logTest(
        'Vault Asset Upload: Tracking number upload',
        false,
        error.message
      )
    }
    
    // Test 4: Text instructions upload
    try {
      const assetId = await uploadVaultAsset(testRift.id, testUser.id, {
        assetType: 'TEXT_INSTRUCTIONS',
        textContent: 'Download instructions: Go to example.com and enter code ABC123',
      })
      
      const asset = await prisma.vaultAsset.findUnique({
        where: { id: assetId },
      })
      
      logTest(
        'Vault Asset Upload: Text instructions created',
        asset !== null && asset.assetType === 'TEXT_INSTRUCTIONS' && asset.textContent?.includes('example.com'),
        asset === null ? 'Asset not created' : undefined
      )
    } catch (error: any) {
      logTest(
        'Vault Asset Upload: Text instructions upload',
        false,
        error.message
      )
    }
    
    // Test 5: Invalid URL format
    try {
      await uploadVaultAsset(testRift.id, testUser.id, {
        assetType: 'URL',
        url: 'not-a-valid-url',
      })
      logTest(
        'Vault Asset Upload: Invalid URL rejected',
        false,
        'Should have rejected invalid URL'
      )
    } catch (error: any) {
      logTest(
        'Vault Asset Upload: Invalid URL rejected',
        true,
        undefined,
        { error: error.message }
      )
    }
    
    // Test 6: Only seller can upload
    const otherUser = await prisma.user.findFirst({
      where: { id: { not: testUser.id } },
    })
    
    if (otherUser) {
      try {
        await uploadVaultAsset(testRift.id, otherUser.id, {
          assetType: 'LICENSE_KEY',
          licenseKey: 'TEST-KEY',
        })
        logTest(
          'Vault Asset Upload: Only seller can upload',
          false,
          'Should have rejected upload from non-seller'
        )
      } catch (error: any) {
        const passed = error.message.includes('seller') || error.message.includes('Unauthorized')
        logTest(
          'Vault Asset Upload: Only seller can upload',
          passed,
          passed ? undefined : `Wrong error: ${error.message}`
        )
      }
    }
    
    // Test 7: Cannot upload in wrong status
    const wrongStatusRift = await prisma.riftTransaction.create({
      data: {
        riftNumber: 999997,
        itemTitle: 'Test Rift',
        itemDescription: 'Test',
        itemType: 'DIGITAL',
        subtotal: 100,
        buyerFee: 3,
        sellerFee: 5,
        currency: 'CAD',
        status: 'DRAFT', // Wrong status
        buyerId: testUser.id,
        sellerId: testUser.id,
      },
    })
    
    try {
      await uploadVaultAsset(wrongStatusRift.id, testUser.id, {
        assetType: 'LICENSE_KEY',
        licenseKey: 'TEST-KEY',
      })
      logTest(
        'Vault Asset Upload: Wrong status rejected',
        false,
        'Should have rejected upload in DRAFT status'
      )
    } catch (error: any) {
      const passed = error.message.includes('status') || error.message.includes('FUNDED')
      logTest(
        'Vault Asset Upload: Wrong status rejected',
        passed,
        passed ? undefined : `Wrong error: ${error.message}`
      )
    }
    
    // Cleanup
    await prisma.riftTransaction.delete({ where: { id: testRift.id } }).catch(() => {})
    await prisma.riftTransaction.delete({ where: { id: wrongStatusRift.id } }).catch(() => {})
    await prisma.vaultAsset.deleteMany({ where: { riftId: testRift.id } }).catch(() => {})
    
  } catch (error: any) {
    logTest('Vault Asset Upload Tests', false, error.message)
  }
}

async function testLicenseKeyDecryption() {
  console.log('\n🔓 Testing License Key Decryption...\n')
  
  try {
    const testUser = await prisma.user.findFirst()
    if (!testUser) {
      logTest('License Key Decryption: Setup', false, 'No test user found')
      return
    }
    
    const testRift = await prisma.riftTransaction.create({
      data: {
        riftNumber: 999996,
        itemTitle: 'Test Rift',
        itemDescription: 'Test',
        itemType: 'DIGITAL',
        subtotal: 100,
        buyerFee: 3,
        sellerFee: 5,
        currency: 'CAD',
        status: 'PROOF_SUBMITTED',
        buyerId: testUser.id,
        sellerId: testUser.id,
        fundedAt: new Date(),
        proofSubmittedAt: new Date(),
      },
    })
    
    // Upload a license key
    const originalKey = 'DECRYPT-TEST-KEY-12345'
    const assetId = await uploadVaultAsset(testRift.id, testUser.id, {
      assetType: 'LICENSE_KEY',
      licenseKey: originalKey,
    })
    
    // Test 1: Buyer can reveal license key
    try {
      const revealedKey = await buyerRevealLicenseKey(
        testRift.id,
        assetId,
        testUser.id,
        {
          ipHash: 'test-ip',
          userAgentHash: 'test-ua',
          sessionId: testUser.id,
        }
      )
      
      logTest(
        'License Key Decryption: Buyer can reveal key',
        revealedKey === originalKey,
        revealedKey !== originalKey ? `Decrypted key doesn't match: ${revealedKey} vs ${originalKey}` : undefined,
        { original: originalKey, revealed: revealedKey }
      )
    } catch (error: any) {
      logTest(
        'License Key Decryption: Buyer can reveal key',
        false,
        error.message
      )
    }
    
    // Test 2: Non-buyer cannot reveal
    const otherUser = await prisma.user.findFirst({
      where: { id: { not: testUser.id } },
    })
    
    if (otherUser) {
      try {
        await buyerRevealLicenseKey(
          testRift.id,
          assetId,
          otherUser.id,
          {
            ipHash: 'test-ip',
            userAgentHash: 'test-ua',
            sessionId: otherUser.id,
          }
        )
        logTest(
          'License Key Decryption: Only buyer can reveal',
          false,
          'Should have rejected reveal from non-buyer'
        )
      } catch (error: any) {
        const passed = error.message.includes('buyer') || error.message.includes('Unauthorized')
        logTest(
          'License Key Decryption: Only buyer can reveal',
          passed,
          passed ? undefined : `Wrong error: ${error.message}`
        )
      }
    }
    
    // Cleanup
    await prisma.riftTransaction.delete({ where: { id: testRift.id } }).catch(() => {})
    await prisma.vaultAsset.deleteMany({ where: { riftId: testRift.id } }).catch(() => {})
    await prisma.vaultEvent.deleteMany({ where: { riftId: testRift.id } }).catch(() => {})
    
  } catch (error: any) {
    logTest('License Key Decryption Tests', false, error.message)
  }
}

async function testVerificationPipeline() {
  console.log('\n🔍 Testing Verification Pipeline...\n')
  
  try {
    const testUser = await prisma.user.findFirst()
    if (!testUser) {
      logTest('Verification Pipeline: Setup', false, 'No test user found')
      return
    }
    
    const testRift = await prisma.riftTransaction.create({
      data: {
        riftNumber: 999995,
        itemTitle: 'Test Rift',
        itemDescription: 'Test',
        itemType: 'DIGITAL',
        subtotal: 100,
        buyerFee: 3,
        sellerFee: 5,
        currency: 'CAD',
        status: 'FUNDED',
        buyerId: testUser.id,
        sellerId: testUser.id,
        fundedAt: new Date(),
        riskScore: 20, // Low risk
      },
    })
    
    // Upload a license key asset
    const assetId = await uploadVaultAsset(testRift.id, testUser.id, {
      assetType: 'LICENSE_KEY',
      licenseKey: 'VERIFY-TEST-KEY-12345',
    })
    
    // Test 1: Verification runs successfully
    try {
      const result = await verifyVaultAsset(assetId)
      
      logTest(
        'Verification Pipeline: Verification runs',
        result !== null,
        result === null ? 'Verification returned null' : undefined,
        {
          passed: result.passed,
          scanStatus: result.scanStatus,
          qualityScore: result.qualityScore,
        }
      )
      
      // Test 2: Asset updated with results
      const asset = await prisma.vaultAsset.findUnique({
        where: { id: assetId },
      })
      
      // For license keys, scanStatus may remain PENDING, but qualityScore should be set
      logTest(
        'Verification Pipeline: Asset updated with results',
        asset !== null && asset.qualityScore !== null && asset.metadataJson !== null,
        asset === null ? 'Asset not found' : undefined,
        {
          scanStatus: asset?.scanStatus,
          qualityScore: asset?.qualityScore,
          hasMetadata: asset?.metadataJson !== null,
        }
      )
      
    } catch (error: any) {
      logTest(
        'Verification Pipeline: Verification runs',
        false,
        error.message
      )
    }
    
    // Test 3: Verify all assets for rift
    try {
      const verifyResult = await verifyRiftProofs(testRift.id)
      
      logTest(
        'Verification Pipeline: Verify all assets',
        verifyResult !== null && Array.isArray(verifyResult.results),
        verifyResult === null ? 'Verification returned null' : undefined,
        {
          allPassed: verifyResult.allPassed,
          shouldRouteToReview: verifyResult.shouldRouteToReview,
          resultCount: verifyResult.results.length,
        }
      )
    } catch (error: any) {
      logTest(
        'Verification Pipeline: Verify all assets',
        false,
        error.message
      )
    }
    
    // Cleanup
    await prisma.riftTransaction.delete({ where: { id: testRift.id } }).catch(() => {})
    await prisma.vaultAsset.deleteMany({ where: { riftId: testRift.id } }).catch(() => {})
    await prisma.vaultEvent.deleteMany({ where: { riftId: testRift.id } }).catch(() => {})
    
  } catch (error: any) {
    logTest('Verification Pipeline Tests', false, error.message)
  }
}

async function testStateTransitions() {
  console.log('\n🔄 Testing State Transitions...\n')
  
  try {
    const testUser = await prisma.user.findFirst()
    if (!testUser) {
      logTest('State Transitions: Setup', false, 'No test user found')
      return
    }
    
    // Test 1: FUNDED -> PROOF_SUBMITTED
    const testRift = await prisma.riftTransaction.create({
      data: {
        riftNumber: 999994,
        itemTitle: 'Test Rift',
        itemDescription: 'Test',
        itemType: 'DIGITAL',
        subtotal: 100,
        buyerFee: 3,
        sellerFee: 5,
        currency: 'CAD',
        status: 'FUNDED',
        buyerId: testUser.id,
        sellerId: testUser.id,
        fundedAt: new Date(),
        version: 0,
      },
    })
    
    // Upload proof asset (simulates proof submission)
    await uploadVaultAsset(testRift.id, testUser.id, {
      assetType: 'LICENSE_KEY',
      licenseKey: 'STATE-TEST-KEY',
    })
    
    // Verify state is still FUNDED (proof submission changes it)
    const afterUpload = await prisma.riftTransaction.findUnique({
      where: { id: testRift.id },
    })
    
    logTest(
      'State Transitions: Upload doesn\'t change state directly',
      afterUpload?.status === 'FUNDED',
      afterUpload?.status !== 'FUNDED' ? `State changed to ${afterUpload?.status}` : undefined
    )
    
    // Cleanup
    await prisma.riftTransaction.delete({ where: { id: testRift.id } }).catch(() => {})
    await prisma.vaultAsset.deleteMany({ where: { riftId: testRift.id } }).catch(() => {})
    
  } catch (error: any) {
    logTest('State Transitions Tests', false, error.message)
  }
}

async function testSecurityChecks() {
  console.log('\n🔒 Testing Security Checks...\n')
  
  try {
    // Test 1: Missing encryption key throws error
    const originalKey = process.env.VAULT_ENCRYPTION_KEY
    delete process.env.VAULT_ENCRYPTION_KEY
    
    try {
      await encryptSensitiveData('test')
      logTest(
        'Security: Missing encryption key error',
        false,
        'Should have thrown error when key is missing'
      )
    } catch (error: any) {
      logTest(
        'Security: Missing encryption key error',
        error.message.includes('VAULT_ENCRYPTION_KEY'),
        error.message.includes('VAULT_ENCRYPTION_KEY') ? undefined : `Wrong error: ${error.message}`
      )
    } finally {
      process.env.VAULT_ENCRYPTION_KEY = originalKey
    }
    
    // Test 2: Encrypted data format validation
    try {
      await decryptSensitiveData('invalid-format')
      logTest(
        'Security: Invalid encrypted data format',
        false,
        'Should have thrown error for invalid format'
      )
    } catch (error: any) {
      logTest(
        'Security: Invalid encrypted data format',
        true,
        undefined,
        { error: error.message }
      )
    }
    
  } catch (error: any) {
    logTest('Security Checks Tests', false, error.message)
  }
}

async function testErrorHandling() {
  console.log('\n⚠️  Testing Error Handling...\n')
  
  try {
    // Test 1: Invalid asset type
    const testUser = await prisma.user.findFirst()
    if (!testUser) {
      logTest('Error Handling: Setup', false, 'No test user found')
      return
    }
    
    const testRift = await prisma.riftTransaction.create({
      data: {
        riftNumber: 999993,
        itemTitle: 'Test Rift',
        itemDescription: 'Test',
        itemType: 'DIGITAL',
        subtotal: 100,
        buyerFee: 3,
        sellerFee: 5,
        currency: 'CAD',
        status: 'FUNDED',
        buyerId: testUser.id,
        sellerId: testUser.id,
        fundedAt: new Date(),
      },
    })
    
    try {
      await uploadVaultAsset(testRift.id, testUser.id, {
        assetType: 'INVALID_TYPE' as any,
        licenseKey: 'test',
      })
      logTest(
        'Error Handling: Invalid asset type',
        false,
        'Should have thrown error for invalid asset type'
      )
    } catch (error: any) {
      logTest(
        'Error Handling: Invalid asset type',
        true,
        undefined,
        { error: error.message }
      )
    }
    
    // Test 2: Missing required fields
    try {
      await uploadVaultAsset(testRift.id, testUser.id, {
        assetType: 'LICENSE_KEY',
        // licenseKey missing
      } as any)
      logTest(
        'Error Handling: Missing required fields',
        false,
        'Should have thrown error for missing licenseKey'
      )
    } catch (error: any) {
      logTest(
        'Error Handling: Missing required fields',
        true,
        undefined,
        { error: error.message }
      )
    }
    
    // Cleanup
    await prisma.riftTransaction.delete({ where: { id: testRift.id } }).catch(() => {})
    
  } catch (error: any) {
    logTest('Error Handling Tests', false, error.message)
  }
}

async function runAllTests() {
  console.log('🧪 Starting Comprehensive End-to-End Test Suite...\n')
  console.log('='.repeat(60))
  
  try {
    await testLicenseKeyEncryption()
    await testFileValidation()
    await testLicenseKeyFormatValidation()
    await testVaultAssetUpload()
    await testLicenseKeyDecryption()
    await testVerificationPipeline()
    await testStateTransitions()
    await testSecurityChecks()
    await testErrorHandling()
    
    // Summary
    console.log('\n' + '='.repeat(60))
    console.log('📊 TEST SUMMARY')
    console.log('='.repeat(60))
    
    const passed = results.filter(r => r.passed).length
    const failed = results.filter(r => !r.passed).length
    const total = results.length
    const percentage = ((passed / total) * 100).toFixed(1)
    
    console.log(`Total Tests: ${total}`)
    console.log(`✅ Passed: ${passed}`)
    console.log(`❌ Failed: ${failed}`)
    console.log(`📈 Success Rate: ${percentage}%`)
    
    if (failed > 0) {
      console.log('\n❌ FAILED TESTS:')
      results.filter(r => !r.passed).forEach(r => {
        console.log(`   - ${r.name}`)
        if (r.error) {
          console.log(`     Error: ${r.error}`)
        }
      })
    }
    
    console.log('\n' + '='.repeat(60))
    
    if (failed === 0) {
      console.log('🎉 ALL TESTS PASSED!')
      process.exit(0)
    } else {
      console.log('⚠️  SOME TESTS FAILED')
      process.exit(1)
    }
    
  } catch (error: any) {
    console.error('\n💥 FATAL ERROR:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run tests
runAllTests().catch(console.error)

