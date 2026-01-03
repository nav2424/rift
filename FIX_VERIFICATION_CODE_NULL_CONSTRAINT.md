# Fix: VerificationCode userId Null Constraint

## Issue
The `VerificationCode` table had a NOT NULL constraint on the `userId` column, preventing creation of verification codes during signup (when `userId` should be null and `sessionId` should be set).

## Solution Applied

1. **Created and applied migration** (`20250102215000_fix_verification_code_userid_nullable`)
   - Made `userId` column nullable
   - Ensured `sessionId` column exists
   - Added proper foreign key relationships

2. **Regenerated Prisma Client**
   - Ran `npx prisma generate` to update the client with the new schema

3. **Verified schema**
   - Confirmed `userId` is now nullable (`String?`) in the Prisma schema

## Next Steps (REQUIRED)

**You must restart your Next.js development server** to pick up the new Prisma client:

```bash
# Stop your current dev server (Ctrl+C)
# Then restart it:
npm run dev
```

Or if you're running in production:
```bash
# Clear Next.js cache and restart
rm -rf .next
npm run build
npm start
```

## Verification

After restarting, the error should be resolved. The `generateVerificationCode` function can now create verification codes with:
- `userId: null` and `sessionId: <sessionId>` for signup sessions
- `userId: <userId>` and `sessionId: null` for existing users

## Database State

The database now has:
- ✅ `VerificationCode.userId` is nullable
- ✅ `VerificationCode.sessionId` exists and is nullable
- ✅ Foreign key relationship to `signup_sessions` table
- ✅ Proper indexes on both columns

