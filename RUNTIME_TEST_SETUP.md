# Runtime Test Setup Guide

This guide will help you set up and run the end-to-end rift flow test.

## Prerequisites

### 1. Database Connection
Ensure your database is accessible via the `DATABASE_URL` environment variable.

**Check your .env file:**
```bash
cat .env | grep DATABASE_URL
```

The format should be:
```
DATABASE_URL="postgresql://user:password@host:port/database?connection_limit=20&pool_timeout=20&connect_timeout=60"
```

### 2. Environment Variables
Make sure these are set in your `.env` file (or `.env.local`):
- `DATABASE_URL` - PostgreSQL connection string (required)

**Optional** (for full testing):
- `STRIPE_SECRET_KEY` - For actual payment processing (test mode recommended)
- `NEXTAUTH_SECRET` - For authentication (if testing auth flows)
- `SUPABASE_URL` - If testing messaging features
- `SUPABASE_SERVICE_ROLE_KEY` - If testing messaging features

### 3. Prisma Client
Ensure Prisma client is generated:
```bash
npx prisma generate
```

### 4. Database Migrations
Ensure all migrations are applied:
```bash
npx prisma migrate status
```

If migrations are pending:
```bash
npx prisma migrate deploy
```

## Running the Test

### Option 1: Using npm script (Recommended)
```bash
npm run test:rift-flow
```

### Option 2: Direct tsx execution
```bash
npx tsx scripts/test-rift-flow.ts
```

## What the Test Does

The test script will:

1. **Setup Test Users**
   - Creates `test-buyer@rift.test` (if doesn't exist)
   - Creates `test-seller@rift.test` (if doesn't exist)

2. **Test Fee Calculations**
   - Verifies 3% buyer fee
   - Verifies 5% seller fee
   - Verifies seller net calculation

3. **Create a Rift**
   - Creates a test rift with $100 subtotal
   - Verifies initial state is `AWAITING_PAYMENT`

4. **Simulate Payment**
   - Transitions to `FUNDED` status
   - Verifies state transition

5. **Simulate Proof Submission**
   - Transitions to `PROOF_SUBMITTED` status

6. **Test Release Logic**
   - Simulates fund release
   - Credits seller wallet
   - Verifies wallet balance update

7. **Test Payout Scheduling**
   - Creates payout record
   - Verifies scheduling logic

8. **Verify Timeline Events**
   - Checks that timeline events were created

9. **Cleanup** (unless `KEEP_TEST_DATA=true`)
   - Removes test data
   - Resets wallet balance

## Keeping Test Data

To keep test data for inspection, set the environment variable:
```bash
KEEP_TEST_DATA=true npm run test:rift-flow
```

Or export it:
```bash
export KEEP_TEST_DATA=true
npm run test:rift-flow
```

## Expected Output

```
🧪 Starting End-to-End Rift Flow Test

Step 1: Setting up test users...
✅ Test users ready

Step 2: Testing fee calculations...
  Subtotal: $100.00
  Buyer fee (3%): $3.00
  Seller fee (5%): $5.00
  Seller net: $95.00
  Buyer total: $103.00
✅ Fee calculations correct

Step 3: Creating rift...
✅ Rift created: <rift-id> (Status: AWAITING_PAYMENT)

Step 4: Verifying initial state...
✅ Initial state correct

Step 5: Simulating payment (transitioning to FUNDED)...
✅ Rift funded: <rift-id> (Status: FUNDED)

Step 6: Simulating proof submission...
✅ Proof submitted: <rift-id> (Status: PROOF_SUBMITTED)

Step 7: Verifying wallet setup...
✅ Wallet ready: <wallet-id> (Balance: $0.00)

Step 8: Testing release logic...
✅ Funds released: <rift-id>
   Wallet balance: $95.00 (credited $95.00)

Step 9: Testing payout scheduling...
✅ Payout scheduled: <payout-id> (Amount: $95.00)

Step 10: Verifying timeline events...
   Found X timeline events
   1. ESCROW_CREATED: ...
   2. PAYMENT_RECEIVED: ...
   3. FUNDS_RELEASED: ...
✅ Timeline events verified

============================================================
TEST SUMMARY
============================================================
Total steps: 10
✅ Successful: 10
❌ Failed: 0

✅ Setup test users
✅ Fee calculations
✅ Create rift
✅ Verify initial state
✅ Payment (FUNDED)
✅ Proof submission
✅ Wallet setup
✅ Release funds
✅ Schedule payout
✅ Timeline events

============================================================

🧹 Cleaning up test data...
✅ Test data cleaned up

🎉 All tests passed!
```

## Troubleshooting

### Database Connection Error
```
Error: Can't reach database server
```

**Solution:**
- Verify `DATABASE_URL` is correct
- Check database server is running
- Verify network connectivity
- Check firewall rules

### Prisma Client Not Generated
```
Error: Cannot find module '@prisma/client'
```

**Solution:**
```bash
npx prisma generate
```

### Migration Errors
```
Error: Migration failed
```

**Solution:**
```bash
# Check migration status
npx prisma migrate status

# Apply pending migrations
npx prisma migrate deploy

# Or reset database (WARNING: Deletes all data)
npx prisma migrate reset
```

### User Already Exists
The script handles existing users gracefully, but if you want fresh users:

```bash
# Manually delete test users
npx tsx -e "
import { prisma } from './lib/prisma.js';
(async () => {
  await prisma.user.deleteMany({
    where: {
      email: { in: ['test-buyer@rift.test', 'test-seller@rift.test'] }
    }
  });
  await prisma.\$disconnect();
})();
"
```

### Test Data Not Cleaning Up
If cleanup fails, you can manually clean:

```bash
# Delete test data
npx tsx -e "
import { prisma } from './lib/prisma.js';
(async () => {
  const testRifts = await prisma.riftTransaction.findMany({
    where: {
      OR: [
        { buyer: { email: 'test-buyer@rift.test' } },
        { seller: { email: 'test-seller@rift.test' } }
      ]
    }
  });
  for (const rift of testRifts) {
    await prisma.timelineEvent.deleteMany({ where: { escrowId: rift.id } });
    await prisma.payout.deleteMany({ where: { riftId: rift.id } });
    await prisma.riftTransaction.delete({ where: { id: rift.id } });
  }
  await prisma.\$disconnect();
})();
"
```

## Next Steps

After running the test successfully:

1. **Review the output** - Check all steps passed
2. **Inspect test data** (if kept) - Verify database state
3. **Run manual tests** - Use `END_TO_END_TEST_CHECKLIST.md`
4. **Test with real API** - Test actual endpoints via HTTP
5. **Test in staging** - Run full integration tests

## Related Documentation

- `END_TO_END_TEST_CHECKLIST.md` - Manual testing guide
- `FLOW_VERIFICATION_REPORT.md` - Code verification report
- `RIFT_FLOW_ANALYSIS.md` - Complete flow analysis

