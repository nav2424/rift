/**
 * Vault Asset Factory
 * Creates test vault assets with various configurations
 */

import { VaultAssetType } from '@prisma/client'
import { randomUUID } from 'crypto'
import { createHash } from 'crypto'

export interface AssetFactoryOptions {
  assetType?: VaultAssetType
  riftId?: string
  fileName?: string
  fileContent?: Buffer
  sha256?: string
  storagePath?: string
  url?: string
  textContent?: string
  licenseKey?: string
  encryptedData?: string
}

export function createTestAsset(options: AssetFactoryOptions = {}) {
  const fileContent = options.fileContent || Buffer.from('test file content')
  const sha256 = options.sha256 || createHash('sha256').update(fileContent).digest('hex')
  
  return {
    id: randomUUID(),
    riftId: options.riftId || randomUUID(),
    assetType: options.assetType || 'FILE',
    fileName: options.fileName || 'test-file.pdf',
    sha256,
    storagePath: options.storagePath || `rift-vault/${options.riftId || 'test'}/${sha256}`,
    url: options.url || null,
    textContent: options.textContent || null,
    licenseKey: options.licenseKey || null,
    encryptedData: options.encryptedData || null,
    fileSize: fileContent.length,
    mimeDetected: 'application/pdf',
    scanStatus: 'CLEAN',
    qualityScore: 100,
    metadataJson: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

export function createTestFileAsset(riftId: string, fileName: string = 'test.pdf') {
  const content = Buffer.from(`Test file content for ${fileName}`)
  return createTestAsset({
    assetType: 'FILE',
    riftId,
    fileName,
    fileContent: content,
  })
}

export function createTestTicketProof(riftId: string) {
  return createTestAsset({
    assetType: 'TICKET_PROOF',
    riftId,
    fileName: 'ticket-qr.png',
  })
}

export function createTestLicenseKey(riftId: string, key: string = 'XXXX-XXXX-XXXX-XXXX') {
  return createTestAsset({
    assetType: 'LICENSE_KEY',
    riftId,
    licenseKey: key,
    encryptedData: `encrypted:${key}`, // Mock encrypted data
  })
}

export function createTestURLAsset(riftId: string, url: string = 'https://example.com/delivery') {
  return createTestAsset({
    assetType: 'URL',
    riftId,
    url,
  })
}

export function createTestTextAsset(riftId: string, text: string = 'Delivery instructions') {
  return createTestAsset({
    assetType: 'TEXT_INSTRUCTIONS',
    riftId,
    textContent: text,
  })
}

// Create duplicate asset (same hash, different rift)
export function createDuplicateAsset(originalAsset: ReturnType<typeof createTestAsset>, newRiftId: string) {
  return createTestAsset({
    assetType: originalAsset.assetType,
    riftId: newRiftId,
    fileName: originalAsset.fileName,
    sha256: originalAsset.sha256, // Same hash = duplicate
    storagePath: originalAsset.storagePath,
  })
}

