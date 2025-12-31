# Remaining Tasks & Improvement Opportunities

> **Note**: Many critical items have been completed! See `IMPLEMENTATION_SUMMARY.md` for what's been done.

## 🚨 Critical Issues (Fix Immediately)

### 1. Security & API Hardening
- **Rate Limiting**: Infrastructure exists (`lib/rate-limit.ts`) but needs to be applied to all API endpoints
  - Priority: HIGH
  - Files: All API route handlers in `app/api/`
  
- **Input Validation**: Add Zod schemas for all API endpoints to prevent invalid data
  - Priority: HIGH
  - Recommendation: Create shared validation schemas in `lib/validation/`

- **CSRF Protection**: Verify SameSite cookies are working correctly
  - Priority: HIGH
  - Check: All state-changing endpoints (POST, PUT, PATCH, DELETE)

### 2. Auto-Release Cron Job
- **Issue**: Auto-release endpoint exists (`/api/escrows/auto-release`) but not scheduled
- **Fix**: Set up Vercel Cron or external cron service
  - Priority: HIGH
  - File: `vercel.json` or external service
  - Schedule: Every hour (or as needed)

### 3. Frontend Pagination Updates
- **Issue**: Backend pagination implemented, but frontend components expect old format
- **Files needing updates**:
  - ✅ `app/dashboard/page.tsx` - Partially fixed (handles both formats)
  - ⚠️ `app/rifts/page.tsx` - Needs update
  - ⚠️ `app/activity/page.tsx` - Needs update
  - ⚠️ `app/wallet/page.tsx` - Needs ledger pagination
  - ⚠️ Mobile app components - Need updates

### 4. Read Receipts Frontend Integration
- **Issue**: API endpoints created but not called from frontend
- **Files**:
  - `components/MessagingPanel.tsx`
  - `app/messages/[id]/page.tsx`
- **Action**: Mark messages as read when user views conversation

---

## 🔧 High Priority Improvements

### 1. Server-Side Filtering & Search
- **Current**: Client-side filtering causes performance issues
- **Fix**: Move filtering to backend API
- **Files**:
  - `app/api/escrows/list/route.ts` - Add filter params
  - `app/activity/page.tsx` - Use server-side filters
  - `app/rifts/page.tsx` - Use server-side filters
  - `app/admin/page.tsx` - Add search/filter to admin lists

### 2. Toast Notification Integration
- **Issue**: Toast system created but not integrated
- **Fix**: 
  - Add `ToastProvider` to `app/layout.tsx`
  - Replace `console.error` with `toast.showToast()` throughout app
- **Priority**: HIGH (UX)

### 3. Loading States
- **Issue**: Generic "Loading..." text
- **Fix**: Create skeleton loaders for:
  - Dashboard
  - Rifts list
  - Activity feed
  - Messages
  - Admin pages
- **Priority**: MEDIUM (UX)

### 4. Error Handling
- **Issue**: Errors logged to console but not shown to users
- **Fix**: Use toast notifications for all error states
- **Priority**: MEDIUM (UX)

### 5. Admin Pagination
- **Issue**: Admin pages load all users/escrows at once
- **Files**:
  - `app/admin/page.tsx`
  - `components/AdminUserList.tsx`
  - `app/api/admin/escrows/route.ts` - ✅ Already fixed
- **Priority**: HIGH (Performance)

---

## 📱 Missing Features

### 1. Carrier API Integration
- **Issue**: Tracking verification has placeholder TODOs
- **File**: `lib/tracking-verification.ts`
- **Action**: Integrate with:
  - UPS Tracking API
  - FedEx Tracking API
  - USPS Tracking API
  - DHL Tracking API
- **Priority**: MEDIUM

### 2. Privacy Preferences UI
- **Issue**: API exists but no UI to toggle settings
- **Endpoint**: `PATCH /api/me/preferences`
- **Action**: Create settings page with toggles for:
  - "Appear in Rift activity feed"
  - "Show exact amounts in feed"
- **Priority**: MEDIUM

### 3. Account Deletion
- **Issue**: No way for users to delete accounts
- **Action**: Create account deletion flow with proper data cleanup
- **Priority**: MEDIUM (GDPR compliance)

### 4. Withdrawal History
- **Issue**: Users can't see past withdrawal requests
- **Action**: Add withdrawal history section showing payout status
- **Priority**: HIGH (UX)

### 5. Message Features
- **Missing**:
  - Direct messaging (currently requires transaction)
  - File attachments
  - Typing indicators
  - Message search within conversations
- **Priority**: LOW to MEDIUM

### 6. Admin Features
- **Missing**:
  - User suspend/edit/delete actions
  - Audit log of admin actions
  - Export functionality (CSV/Excel)
  - Advanced filtering (date range, amount, status combinations)
  - Bulk actions
- **Priority**: MEDIUM

### 7. Export Functionality
- **Missing**: CSV/PDF export for:
  - Transactions
  - Activity log
  - Wallet ledger
  - Admin reports
- **Priority**: LOW

### 8. Support Pages
- **Issue**: Support links may lead to placeholders
- **Action**: Implement proper FAQ/support pages
- **Priority**: MEDIUM

---

## 🧪 Testing

### Critical Gap: No Tests Exist
- **Issue**: Zero test files found in codebase
- **Action**: Add comprehensive test coverage:
  - Unit tests for utilities (`lib/`)
  - Integration tests for API endpoints
  - E2E tests for critical flows
- **Priority**: HIGH
- **Recommendation**: Start with:
  - Rift state machine logic
  - Payment processing flows
  - Dispute resolution flows

---

## 🎨 UX Enhancements

### 1. Filtering & Sorting
- **Rifts page**: Add date range, amount range, item type filters + sort options
- **Activity page**: Add activity type filter
- **Wallet**: Add ledger filtering by type, date, amount

### 2. Bulk Actions
- Select multiple rifts for bulk cancel/archive
- Admin bulk actions for users/transactions

### 3. Advanced Search
- Search within messages
- Global search across all entities

### 4. Conversation Archiving
- Archive/hide old conversations
- Filter conversations by archived status

### 5. Profile Picture Upload
- Currently only shows generic avatar

---

## 🏗️ Technical Debt

### 1. Code Quality
- **TypeScript Strict Mode**: Enable strict mode
- **Code Duplication**: Extract shared utilities:
  - Status formatting (`getStatusLabel`)
  - Currency formatting
  - Date formatting
- **Error Boundaries**: Add React error boundaries to major sections

### 2. Performance
- **Database Indexes**: Audit query performance, add indexes where needed
- **N+1 Queries**: Review and optimize with Prisma includes
- **Caching**: Consider Redis for frequently accessed data
- **Real-time Subscriptions**: Audit cleanup functions to prevent memory leaks

### 3. Documentation
- Add JSDoc comments to major functions
- Improve README with setup instructions
- API documentation (OpenAPI/Swagger)

### 4. Environment Variables
- Add startup validation (use Zod) to ensure required env vars are set
- Better error messages when env vars missing

---

## 🔄 Partially Completed Items

### 1. Database Migrations
- **Addictive Features Migration**: May need to be applied
  - Check: `20251210034422_add_addictive_features`
- **Phase 6 Migration**: Verify all migrations applied
  - Check Supabase migration: `007_phase6_chargeback_defense.sql`
  - Check Prisma migrations

### 2. Badge Seeding
- **Action**: Run `ensureBadgesExist()` to create initial badge definitions
- **File**: `lib/badges.ts`

### 3. User Stats Recalculation
- **Action**: Recalculate stats for existing users
- **Function**: `recalculateUserStats(userId)` from `lib/balance.ts`

---

## 🚀 Production Readiness

### 1. Email System
- Verify SMTP configuration works
- Add email queue system with retry logic
- Improve email templates

### 2. Mobile Push Notifications
- **Missing**: No push notification system for mobile app
- **Solution**: Add Expo Notifications
- **Priority**: MEDIUM

### 3. File Storage
- **Current**: Files stored in `/public/uploads` (local)
- **Consider**: Move to cloud storage (S3, Cloudinary)
- **Priority**: LOW (works but not scalable)

### 4. Multi-Currency Support
- **Current**: Only CAD supported
- **Priority**: LOW

### 5. Withdrawal Limits
- **Missing**: No minimum/maximum withdrawal amounts
- **Action**: Add configurable limits with clear messaging
- **Priority**: MEDIUM

---

## 📊 Analytics & Monitoring

### Missing Features
- No analytics tracking
- No error monitoring (Sentry, etc.)
- No performance monitoring
- No user analytics

### Recommendations
- Add analytics for key user actions
- Implement error tracking
- Add performance monitoring
- Track conversion funnels

---

## 🔐 Security Enhancements

### Additional Security Items
- SQL Injection Prevention: Audit all raw queries (Prisma is good, but verify)
- XSS Prevention: Sanitize all user-generated content
- API Versioning: Consider `/api/v1/...` for future-proofing
- Audit Log: Track admin actions for compliance

---

## 🎯 Quick Wins (Easy to Implement)

1. **Toast Integration**: ~1 hour
   - Add ToastProvider to layout
   - Replace console.error with toast calls

2. **Skeleton Loaders**: ~2-3 hours
   - Create reusable skeleton component
   - Add to loading states

3. **Privacy Preferences UI**: ~2 hours
   - Simple toggle component in settings

4. **Withdrawal History**: ~3-4 hours
   - Query payout history
   - Display in wallet page

5. **Read Receipts Integration**: ~1 hour
   - Call API when viewing conversation

---

## 📋 Implementation Priority Summary

### Week 1 (Critical)
1. Apply rate limiting to API endpoints
2. Set up auto-release cron job
3. Update frontend pagination
4. Integrate toast notifications
5. Add basic test coverage

### Week 2 (High Priority)
1. Server-side filtering/search
2. Admin pagination
3. Withdrawal history
4. Privacy preferences UI
5. Error handling improvements

### Week 3 (Medium Priority)
1. Loading states (skeleton loaders)
2. Account deletion
3. Admin user management actions
4. Carrier API integration
5. Export functionality

### Ongoing
- Test coverage expansion
- Performance optimization
- Documentation improvements
- UX polish

---

## 📝 Notes

- Many features are "backend ready" but need frontend integration
- Most critical issues are around scalability (pagination) and security (rate limiting)
- Test coverage is the biggest gap - should be prioritized
- Mobile app has admin access, but may need feature parity updates

