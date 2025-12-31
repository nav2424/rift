# Vault Encryption Key Setup Guide

## Quick Start

### 1. Generate an Encryption Key

Run the helper script:
```bash
node scripts/generate-encryption-key.js
```

Or generate manually:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Add to Your .env File

Add the generated key to your `.env` file (create it if it doesn't exist):

```env
VAULT_ENCRYPTION_KEY=your_generated_key_here
```

**Example:**
```env
VAULT_ENCRYPTION_KEY=e3b1471e951f22f29b231a4b7717c1a217b2718bddd59671a6eb74cbe056e93a
```

### 3. Restart Your Server

After adding the key, restart your development server:
```bash
npm run dev
```

## What This Key Does

The `VAULT_ENCRYPTION_KEY` is used to encrypt license keys stored in the vault. It uses AES-256-GCM encryption, which is a secure encryption standard.

**What gets encrypted:**
- License keys submitted by sellers
- Any sensitive data stored in `VaultAsset.encryptedData`

**What doesn't get encrypted:**
- File uploads (stored as-is in Supabase)
- Tracking numbers (stored as plain text)
- URLs (stored as plain text)
- Text instructions (stored as plain text)

## Security Best Practices

### ✅ DO:
- **Generate a unique key** for each environment (dev, staging, production)
- **Store production key securely** (use a secrets manager like AWS Secrets Manager, HashiCorp Vault, etc.)
- **Use a long, random key** (64 hex characters = 32 bytes = 256 bits)
- **Rotate keys periodically** (requires re-encrypting existing data)
- **Back up your key securely** (if lost, encrypted data cannot be recovered)

### ❌ DON'T:
- **Never commit the key** to version control (already in .gitignore)
- **Don't share keys** between environments
- **Don't use weak keys** (no passwords, no short strings)
- **Don't lose the key** (encrypted data cannot be decrypted without it)

## Production Setup

### Option 1: Environment Variables (Vercel/Netlify)
1. Go to your deployment platform's environment variables settings
2. Add `VAULT_ENCRYPTION_KEY` with your production key
3. Redeploy your application

### Option 2: AWS Secrets Manager
```bash
aws secretsmanager create-secret \
  --name rift/vault-encryption-key \
  --secret-string "your-production-key-here"
```

Then in your application:
```typescript
// Load from AWS Secrets Manager
const secret = await secretsManager.getSecretValue({
  SecretId: 'rift/vault-encryption-key'
}).promise()
process.env.VAULT_ENCRYPTION_KEY = secret.SecretString
```

### Option 3: Docker Secrets
```yaml
# docker-compose.yml
services:
  app:
    secrets:
      - vault_encryption_key

secrets:
  vault_encryption_key:
    external: true
```

## Verification

To verify your key is set correctly:

1. **Check if key is loaded:**
   ```bash
   node -e "console.log(process.env.VAULT_ENCRYPTION_KEY ? 'Key is set' : 'Key is missing')"
   ```

2. **Test encryption/decryption:**
   Create a test script:
   ```javascript
   const { encryptSensitiveData, decryptSensitiveData } = require('./lib/vault')
   
   async function test() {
     const original = 'TEST-LICENSE-KEY-12345'
     const encrypted = await encryptSensitiveData(original)
     const decrypted = await decryptSensitiveData(encrypted)
     console.log('Original:', original)
     console.log('Encrypted:', encrypted)
     console.log('Decrypted:', decrypted)
     console.log('Match:', original === decrypted ? '✅' : '❌')
   }
   test()
   ```

## Troubleshooting

### Error: "VAULT_ENCRYPTION_KEY environment variable is required"
- **Solution:** Add the key to your `.env` file and restart the server

### Error: "Failed to decrypt license key"
- **Possible causes:**
  1. Key changed after data was encrypted (old data encrypted with different key)
  2. Key is incorrect
  3. Data was corrupted
- **Solution:** Ensure you're using the same key that was used to encrypt the data

### Existing License Keys Not Working
If you have existing license keys encrypted with base64 (old system), they need to be migrated:
1. Decrypt with old method (base64)
2. Re-encrypt with new method (AES-256-GCM)
3. Update database records

## Key Rotation

If you need to rotate the encryption key:

1. **Generate new key:**
   ```bash
   node scripts/generate-encryption-key.js
   ```

2. **Migrate existing data:**
   - Decrypt all existing `encryptedData` with old key
   - Re-encrypt with new key
   - Update database

3. **Update environment variable:**
   - Set new key in `.env` (dev) and production secrets

4. **Test thoroughly:**
   - Verify existing license keys still work
   - Test new license key encryption

## Current Generated Key

For your reference, here's a key that was just generated (you can use this or generate a new one):

```
VAULT_ENCRYPTION_KEY=e3b1471e951f22f29b231a4b7717c1a217b2718bddd59671a6eb74cbe056e93a
```

**⚠️ Note:** This is just an example. Generate your own unique key for security.

