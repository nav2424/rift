# Test Setup Guide

## Prisma Import Fixes

### ✅ Fixed Issues

1. **Default Export Added**: `lib/prisma.ts` now exports both named and default export
2. **Relative Imports**: Test file uses relative imports (`../../lib/prisma`) for reliability
3. **Test DB Safety**: Added checks to ensure test database is used
4. **Stripe Mocking**: Properly mocked Stripe with deterministic values

### Running Tests

#### Prerequisites

1. **Set Test Database URL**:
   ```bash
   export TEST_DATABASE_URL="postgresql://user:password@host:port/rift_test"
   ```

   Or add to `.env.local`:
   ```
   TEST_DATABASE_URL=postgresql://user:password@host:port/rift_test
   ```

2. **Apply Migrations**:
   ```bash
   npx prisma migrate deploy
   ```

#### Run Integration Tests

```bash
# Set test database URL
export TEST_DATABASE_URL="your-test-db-url"

# Run stress tests
npm test tests/integration/refund-dispute-stress.test.ts

# Run all integration tests
npm test tests/integration/
```

#### Run Unit Tests (No DB Required)

```bash
npm test tests/unit/
```

### Test Database Setup

For integration tests, you need a separate test database:

1. **Create Test Database**:
   ```sql
   CREATE DATABASE rift_test;
   ```

2. **Run Migrations on Test DB**:
   ```bash
   DATABASE_URL="postgresql://user:password@host:port/rift_test" npx prisma migrate deploy
   ```

3. **Set Environment Variable**:
   ```bash
   export TEST_DATABASE_URL="postgresql://user:password@host:port/rift_test"
   ```

### Troubleshooting

#### Error: "Prisma client is not available"

**Cause**: Import path issue or Prisma not generated

**Fix**:
```bash
# Regenerate Prisma client
npx prisma generate

# Verify import works
node -e "const { prisma } = require('./lib/prisma'); console.log(prisma ? 'OK' : 'FAIL')"
```

#### Error: "DATABASE_URL must be set"

**Cause**: Test database URL not configured

**Fix**: Set `TEST_DATABASE_URL` environment variable

#### Error: "Unique constraint violation"

**Cause**: Test data not cleaned up properly

**Fix**: 
- Check that `beforeEach` cleanup runs
- Manually clean test data:
  ```sql
  DELETE FROM "MilestoneRelease" WHERE "riftId" LIKE 'test-%';
  DELETE FROM "RiftTransaction" WHERE "id" LIKE 'test-%';
  DELETE FROM "User" WHERE "email" LIKE '%@test-stress.com';
  ```

#### Error: "Model MilestoneRelease does not exist"

**Cause**: Migration not applied or model name mismatch

**Fix**:
1. Check schema: `grep "model MilestoneRelease" prisma/schema.prisma`
2. Apply migrations: `npx prisma migrate deploy`
3. Regenerate client: `npx prisma generate`

### Test File Structure

```
tests/
  integration/
    refund-dispute-stress.test.ts  # Uses REAL Prisma
  unit/
    fee-math-invariants.test.ts    # Uses MOCKED Prisma
  setup.ts                          # Global test setup
```

### Key Differences

- **Integration Tests**: Use real Prisma, need test database
- **Unit Tests**: Use mocked Prisma, no database needed

The `refund-dispute-stress.test.ts` is an **integration test** and requires:
- Real Prisma client
- Test database connection
- Migrations applied

### CI/CD Setup

For CI/CD, ensure:

```yaml
# Example GitHub Actions
env:
  TEST_DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}

steps:
  - name: Setup test database
    run: |
      # Create test database
      createdb rift_test
      
  - name: Run migrations
    run: |
      DATABASE_URL=$TEST_DATABASE_URL npx prisma migrate deploy
      
  - name: Run tests
    run: |
      npm test
```


