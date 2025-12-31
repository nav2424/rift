# Rate Limits Applied to Endpoints

## ✅ Endpoints with Rate Limits

### 1. Proof Submission
**Endpoint:** `POST /api/rifts/[id]/proof`  
**Rate Limit:** 10 submissions per hour per user  
**Implementation:** ✅ Applied

**Code:**
```typescript
// app/api/rifts/[id]/proof/route.ts
const rateLimitResult = checkProofRateLimit(request, 'submission')
if (!rateLimitResult.allowed) {
  return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
}
```

### 2. Vault Asset Views
**Endpoint:** `GET /api/rifts/[id]/vault`  
**Rate Limit:** 100 views per 15 minutes per user  
**Implementation:** ✅ Applied

**Code:**
```typescript
// app/api/rifts/[id]/vault/route.ts
const rateLimitResult = checkProofRateLimit(request, 'view')
if (!rateLimitResult.allowed) {
  return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
}
```

### 3. Vault Asset Downloads/Reveals
**Endpoint:** `POST /api/rifts/[id]/vault` (with action)  
**Rate Limits:**
- Downloads: 50 per hour per user
- License key reveals: 5 per day per user  
**Implementation:** ✅ Applied

**Code:**
```typescript
// app/api/rifts/[id]/vault/route.ts
const operation = action === 'reveal_license_key' ? 'reveal' : 'download'
const rateLimitResult = checkProofRateLimit(request, operation)
if (!rateLimitResult.allowed) {
  return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
}
```

## Rate Limit Configuration

**File:** `lib/rate-limits-proof.ts`

| Operation | Window | Max Requests | Key Generator |
|-----------|--------|--------------|---------------|
| Submission | 1 hour | 10 | `proof-submission:{userId}:{ip}` |
| Download | 1 hour | 50 | `vault-download:{userId}:{ip}` |
| Reveal | 24 hours | 5 | `license-reveal:{userId}:{ip}` |
| View | 15 minutes | 100 | `vault-view:{userId}:{ip}` |

## Response Headers

When rate limit is exceeded, response includes:

```
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 2025-01-22T12:00:00Z
Retry-After: 3600
```

## Rate Limit Scope: **Per User** (Not Global)

Rate limits are **per user**, not global. Each user gets their own independent rate limit bucket.

**Key Generation:**
- Format: `{operation}:{userId}:{ip}`
- Example: `proof-submission:user123:192.168.1.1`
- Each user has their own counter

**User Identification:**
- Primary: User ID from authenticated session
- Secondary: IP address from `x-forwarded-for` or `x-real-ip` headers
- Fallback: 'anonymous' if user ID not available (IP-based limiting)

**Example:**
- User A (userId: "user123") → 10 submissions/hour limit
- User B (userId: "user456") → 10 submissions/hour limit (separate counter)
- They don't share the same limit; each user gets their full allocation

## Testing

To test rate limits:

```bash
# Test proof submission limit (10/hour)
for i in {1..11}; do
  curl -X POST http://localhost:3000/api/rifts/{riftId}/proof \
    -H "Authorization: Bearer {token}" \
    -H "Content-Type: application/json"
done
# 11th request should return 429
```

## Production Considerations

1. **In-Memory Store:** Current implementation uses in-memory store
   - **Limitation:** Doesn't work across multiple server instances
   - **Solution:** Migrate to Redis for production scale

2. **Key Generation:** Uses user ID + IP
   - **Benefit:** Prevents single user from bypassing limits
   - **Note:** IP may change (mobile users, VPNs)

3. **Rate Limit Headers:** Always included in responses
   - **Benefit:** Clients can implement exponential backoff
   - **Standard:** Follows RFC 6585

---

**Status:** ✅ Rate limits applied  
**Last Updated:** 2025-01-22
