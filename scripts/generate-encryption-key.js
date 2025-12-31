#!/usr/bin/env node
/**
 * Generate a secure encryption key for vault encryption
 * Usage: node scripts/generate-encryption-key.js
 */

const crypto = require('crypto')

// Generate a 64-character hex string (32 bytes = 256 bits)
const encryptionKey = crypto.randomBytes(32).toString('hex')

console.log('='.repeat(60))
console.log('VAULT ENCRYPTION KEY GENERATED')
console.log('='.repeat(60))
console.log('')
console.log('Add this to your .env file:')
console.log('')
console.log(`VAULT_ENCRYPTION_KEY=${encryptionKey}`)
console.log('')
console.log('⚠️  IMPORTANT:')
console.log('  - Keep this key SECRET and secure')
console.log('  - Never commit it to version control')
console.log('  - Use different keys for development and production')
console.log('  - Store production key in secure key management system')
console.log('  - If key is lost, encrypted license keys cannot be decrypted')
console.log('')
console.log('='.repeat(60))

