# Rate Limiting Application Guide

This document shows how to apply rate limiting to API endpoints that haven't been updated yet.

## Pattern

For each API route file:

1. Import the middleware:
```typescript
import { withRateLimit } from '@/lib/api-middleware'
```

2. Rename the handler function (add `handle` prefix):
```typescript
// Before:
export async function GET(request: NextRequest) {
  // ...
}

// After:
async function handleGET(request: NextRequest) {
  // ...
}

export const GET = withRateLimit(handleGET, { rateLimit: 'default' })
```

3. Choose appropriate rate limit:
- `'auth'` - For authentication endpoints (5 requests per 15 min)
- `'strict'` - For sensitive endpoints (30 requests per 15 min)
- `'default'` - For regular API endpoints (100 requests per 15 min)

## Priority Endpoints to Update

### High Priority (Security Critical)
- [x] `/api/auth/custom-signup` - DONE
- [x] `/api/auth/mobile-signin` - DONE
- [x] `/api/auth/mobile-signup` - DONE
- [ ] `/api/rifts/[id]/mark-paid` - Payment processing
- [ ] `/api/rifts/[id]/release-funds` - Money transfers
- [ ] `/api/wallet/withdraw` - Withdrawals
- [ ] `/api/admin/**` - All admin endpoints

### Medium Priority
- [ ] `/api/rifts/create` - Rift creation
- [ ] `/api/rifts/list` - Data fetching
- [ ] `/api/conversations/**` - Messaging
- [ ] `/api/disputes/**` - Dispute handling

### Lower Priority
- [ ] `/api/me/**` - User profile endpoints
- [ ] `/api/notifications` - Notification fetching
- [ ] `/api/activity/feed` - Activity feed

## Automated Application

You can use find/replace with regex in your editor:

Find: `export async function (GET|POST|PUT|PATCH|DELETE)\(request: NextRequest\)`
Replace: `async function handle$1(request: NextRequest)`

Then add export: `export const $1 = withRateLimit(handle$1, { rateLimit: 'default' })`

