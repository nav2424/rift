# Payment Processing Fee Handling Explanation

## Rift Platform Fee Strategy (FINALIZED)

### Buyer Fee: 0%
- Buyers pay exactly the listed price
- No fees shown to buyers at checkout
- Increases trust and conversion

### Seller Fee: 8% Flat
- Platform fee deducted from seller payout
- Calculated as 8% of original rift amount

### Stripe Processing Fees: Passed to Seller
- Standard Stripe fees: 2.9% + $0.30 per transaction
- Automatically deducted by Stripe
- **Passed to seller** (not absorbed by platform)

## How Payment Processing Fees Work

### Payment Processing Fees
When a buyer makes a payment:
- **Payment processing fees are automatically deducted** (2.9% + $0.30) from the payment
- The platform receives the **net amount** (after payment processing fees)
- Example: Buyer pays $100 → Platform receives ~$96.80
- **These fees are passed to the seller** (not absorbed by platform)

### Transfer Fees
When transferring money to a seller's payment account:
- **No additional fees** are charged on transfers
- Transfers are free (the fee was already taken from the original payment)
- We transfer the seller amount (rift amount - 8% platform fee - Stripe fees) directly

## Platform Fee Implementation

### Fee Calculation
1. **Platform Fee**: 8% of original rift amount (paid by seller)
2. **Seller Payout**: Rift amount - Platform fee (8%) - Stripe fees (2.9% + $0.30)

### Example Calculation
- Rift amount: $100.00
- Buyer pays: $100.00 (0% fee - exactly the listed price)
- Stripe processing fees: ~$3.20 (2.9% + $0.30) [AUTOMATIC - passed to seller]
- Platform fee (8%): $8.00 [DEDUCTED from seller]
- Seller receives: $88.80

### Fee Flow

```
Buyer Payment ($100.00)
    ↓
Buyer pays: $100.00 (0% fee - listed price only)
    ↓
Stripe Processing Fee (~$3.20) [AUTOMATIC - passed to seller]
    ↓
Platform Receives (~$96.80)
    ↓
Platform Fee ($8.00 - 8% of original) [DEDUCTED from seller]
    ↓
Seller Receives ($88.80) [TRANSFERRED]
```

## Important Notes

1. **Buyer pays 0%**: Buyers pay exactly the listed price, no fees shown
2. **Payment processing fees are automatic**: Stripe deducts them automatically, and they're passed to sellers
3. **Platform fee is our deduction**: We calculate and deduct 8% (of original amount) before paying seller
4. **Transfers are free**: No additional fees on transfers to payment accounts
5. **Fee tracking**: We store `platformFee` and `sellerPayoutAmount` in the database for accounting
6. **Fixed fee structure**: No customization allowed - keeps UX simple and friction-free

## Code Implementation

### Fee Calculation (`lib/fees.ts`)
```typescript
// Calculate 8% platform fee (from original amount)
const platformFee = calculatePlatformFee(escrowAmount) // $8.00 for $100

// Calculate seller payout (original - 8% platform fee - Stripe fees)
const sellerPayout = calculateSellerPayout(escrowAmount) // $88.80 for $100
```

### Payout Process
```typescript
// When releasing funds to seller
await createPayout(
  sellerPayoutAmount,  // $88.80 (after platform fee and Stripe fees)
  escrowAmount,        // $100.00 (original amount)
  platformFee,         // $8.00 (8% platform fee)
  currency,
  sellerStripeAccountId,
  escrowId
)
```

## Strategic Benefits

- **Buyer trust**: 0% buyer fees increase conversion and trust
- **Simple UX**: Fixed fee structure eliminates decision friction
- **Healthy margins**: 8% platform fee covers costs and profit
- **Scalable**: Mirrors successful strategies from Vinted, Etsy, StockX, Whop
- **Transparent**: Sellers see all fees upfront, buyers see none (as designed)
