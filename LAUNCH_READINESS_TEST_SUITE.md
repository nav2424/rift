# Launch Readiness Test Suite - Quick Start Guide

## Overview

This test suite provides comprehensive coverage for Rift's zero-trust proof + vault system. It includes 238 test cases across 4 test levels.

## Installation

```bash
npm install
```

This will install Vitest and all required dependencies.

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Specific Test Suites
```bash
# Unit tests only (fast, no dependencies)
npm run test:unit

# Integration tests (requires DB + storage mocks)
npm run test:integration

# E2E tests (requires full stack)
npm run test:e2e

# Security/abuse tests
npm run test:security
```

### Run with UI
```bash
npm run test:ui
```

### Run with Coverage
```bash
npm run test:coverage
```

## Test Structure

```
tests/
├── setup.ts                    # Test environment setup
├── factories/                  # Test data factories
│   ├── riftFactory.ts
│   ├── assetFactory.ts
│   ├── eventFactory.ts
│   └── userFactory.ts
├── unit/                       # Unit tests (pure functions)
│   ├── proof-type-validation.test.ts
│   ├── proof-deadlines.test.ts
│   ├── duplicate-proof-detection.test.ts
│   ├── vault-logging.test.ts
│   └── rate-limits.test.ts
├── integration/                # Integration tests (API + DB)
│   └── proof-submission.test.ts
└── security/                   # Security/abuse tests
    └── abuse-tests.test.ts
```

## Test Matrix

See `TEST_MATRIX.md` for complete test coverage matrix.

## Acceptance Criteria

### ✅ Ready for Launch

All of the following must pass:

1. **Unit Tests:** 95%+ pass rate
   - ✅ All type-locked validation tests pass
   - ✅ All deadline enforcement tests pass
   - ✅ All duplicate detection tests pass
   - ✅ All audit chain tests pass

2. **Integration Tests:** 90%+ pass rate
   - ✅ All API endpoint tests pass
   - ✅ All database integrity tests pass
   - ✅ All storage operation tests pass

3. **E2E Tests:** 100% pass rate (all critical flows)
   - ✅ Complete seller → buyer → release flow works
   - ✅ Dispute flow works end-to-end
   - ✅ Admin review flow works

4. **Security Tests:** 100% pass rate (all security tests must pass)
   - ✅ No bypass routes discovered
   - ✅ All tamper attempts detected
   - ✅ All rate limits enforced
   - ✅ All access controls verified

## Quick Verification

Run this command to verify all critical tests pass:

```bash
npm run test:unit && npm run test:security
```

If both pass, the core security and validation logic is working correctly.

## Test Data

Test factories are provided in `tests/factories/`:
- `createTestRift()` - Creates test rifts with various configurations
- `createTestAsset()` - Creates test vault assets
- `createTestEvent()` - Creates test vault events
- `createTestUser()` - Creates test users (buyers/sellers/admins)

## Environment Setup

Tests use a test database. Set `TEST_DATABASE_URL` in your `.env` file:

```
TEST_DATABASE_URL="postgresql://user:password@localhost:5432/rift_test"
```

## Continuous Integration

Add to your CI pipeline:

```yaml
- name: Run Tests
  run: |
    npm install
    npm run test:coverage
```

## Performance Benchmarks

Tests should complete within:
- Unit tests: < 30 seconds
- Integration tests: < 2 minutes
- Full suite: < 5 minutes

## Troubleshooting

### Tests failing with "Cannot find module"
- Run `npm install` to ensure all dependencies are installed
- Check that `vitest.config.ts` has correct path aliases

### Database connection errors
- Ensure `TEST_DATABASE_URL` is set correctly
- Ensure test database exists and is accessible

### Mock errors
- Some tests use mocks - ensure mocks are properly configured
- Check that Prisma client is properly mocked in integration tests

## Next Steps

1. Run `npm test` to execute all tests
2. Review test coverage report
3. Fix any failing tests
4. Verify all acceptance criteria are met
5. **Ready for launch!** 🚀

---

**Last Updated:** 2025-12-28  
**Test Framework:** Vitest 2.1.8  
**Total Test Cases:** 280+ (238 original + 42 new critical tests)

