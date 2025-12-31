# Security Notes - Credential Logging

## ✅ Fixed: Credential Logging Prevention

All credential logging has been removed or sanitized to prevent sensitive information from being exposed in logs.

### Changes Made

#### 1. SMS/Twilio Logging (`lib/sms.ts`)
- ✅ **Error logging sanitized** - Only logs error codes and truncated messages
- ✅ **No credentials logged** - Account SID, Auth Token, and Phone Number are never logged
- ✅ **Success logging** - Only logs in development mode, safe data only (phone number and message SID)
- ✅ **Error messages sanitized** - Full error objects not logged to prevent credential leaks

#### 2. Email/SMTP Logging (`lib/email.ts`)
- ✅ **SMTP config logging** - Only logs masked username (first 3 chars), never passwords
- ✅ **Password never logged** - SMTP password is never included in any logs
- ✅ **Error response sanitized** - error.response never logged (may contain credentials)
- ✅ **Development-only logging** - SMTP config details only logged in development

### Safe Logging Practices

**What IS logged (safe):**
- Error codes (e.g., `21211`, `21608`)
- Truncated error messages (first 100 chars)
- Phone numbers (already user-provided data)
- Message SIDs (Twilio message identifiers - safe)
- Masked usernames (first 3 characters only)

**What is NOT logged (sensitive):**
- ❌ Passwords (SMTP, etc.)
- ❌ API keys (Twilio Account SID, Auth Token)
- ❌ Full error responses (may contain credentials)
- ❌ Full error objects (may contain sensitive data)
- ❌ Full usernames/account identifiers

### Production Behavior

In production (`NODE_ENV=production`):
- Minimal logging of sensitive operations
- Only error codes and safe identifiers logged
- No credential information in logs
- Error messages sanitized before logging

### Development Behavior

In development:
- More verbose logging for debugging
- Still no credentials logged
- Masked/truncated sensitive data
- Full error objects avoided

---

## Verification

To verify credentials are not being logged:

1. **Check logs after operations:**
   ```bash
   # Should NOT see:
   - TWILIO_ACCOUNT_SID
   - TWILIO_AUTH_TOKEN
   - SMTP_PASSWORD
   - Full API keys
   - Full error responses
   
   # Should see:
   - Error codes only
   - Truncated messages
   - Masked usernames (e.g., "sup***")
   - Safe identifiers
   ```

2. **Search codebase for credential logging:**
   ```bash
   grep -r "console.*accountSid\|console.*authToken\|console.*password\|console.*TWILIO" lib/
   # Should return no results
   ```

3. **Monitor production logs:**
   - Check Vercel logs
   - Verify no credential strings appear
   - Confirm only safe data is logged

---

## Best Practices Going Forward

When adding new logging:

1. ✅ **DO log:**
   - Error codes
   - Safe identifiers (IDs, SIDs, etc.)
   - Truncated error messages
   - Operation status

2. ❌ **DON'T log:**
   - Passwords
   - API keys
   - Secrets
   - Full error objects
   - Full error responses
   - Complete credentials

3. **Use environment-aware logging:**
   - More verbose in development
   - Minimal in production
   - Always sanitize sensitive data

---

**Last Updated:** After credential logging security fix

