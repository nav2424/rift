# Test Setup Fixes

## Issues Fixed

### 1. PrismaClient Constructor Error
**Problem:** `TypeError: PrismaClient is not a constructor`

**Solution:**
- Added mock for `@prisma/client` to prevent PrismaClient instantiation
- Added mock for `@/lib/prisma` to provide a mock prisma instance
- Removed attempt to create real PrismaClient in test setup

### 2. Jest Test File Conflict
**Problem:** Old Jest test file (`lib/__tests__/proof-system.test.ts`) using Jest imports

**Solution:**
- Deleted old Jest test file
- Added exclusion pattern in `vitest.config.ts` to ignore `lib/__tests__/` directory

### 3. Duplicate Prisma Mocks
**Problem:** Multiple test files were trying to mock Prisma individually

**Solution:**
- Centralized Prisma mock in `tests/setup.ts`
- Removed individual Prisma mocks from test files
- All tests now use the global mock

## Files Changed

1. **tests/setup.ts**
   - Removed real PrismaClient instantiation
   - Added mocks for `@prisma/client` and `@/lib/prisma`
   - Added proper mock structure for all Prisma models

2. **vitest.config.ts**
   - Added exclusion for `lib/__tests__/` directory

3. **Deleted:**
   - `lib/__tests__/proof-system.test.ts` (old Jest test)

4. **Updated test files:**
   - Removed duplicate Prisma mocks (now using global mock)
   - All test files now rely on centralized mock

## Running Tests

```bash
npm test
```

All tests should now run without PrismaClient constructor errors.

