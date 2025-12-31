# Payment Processing Fee Handling Explanation

## Rift Platform Fee Strategy (FINALIZED)

### Buyer Fee: 3%
- Buyers pay: subtotal + 3% payment processing fee
- Covers card network and payment processing costs

### Seller Fee: 5% Flat
- Platform fee deducted from seller payout
- Calculated as 5% of original rift amount

### Stripe Processing Fees: Passed to Seller
- Standard Stripe fees: 2.9% + $0.30 per transaction
- Automatically deducted by Stripe
- **Passed to seller** (not absorbed by platform)

## How Payment Processing Fees Work

### Payment Processing Fees
When a buyer makes a payment:
- **Payment processing fees are automatically deducted** (2.9% + $0.30) from the payment
- The platform receives the **net amount** (after payment processing fees)
- Example: Buyer pays $103 → Platform receives ~$100.01
- **These fees are passed to the seller** (not absorbed by platform)

### Transfer Fees
When transferring money to a seller's payment account:
- **No additional fees** are charged on transfers
- Transfers are free (the fee was already taken from the original payment)
- We transfer the seller amount (rift amount - 5% platform fee - Stripe fees) directly

## Platform Fee Implementation

### Fee Calculation
1. **Buyer Fee**: 3% of subtotal (paid by buyer)
2. **Platform Fee**: 5% of subtotal (paid by seller)
3. **Seller Payout**: Subtotal - Platform fee (5%) - Stripe fees (2.9% + $0.30)

### Example Calculation
- Rift subtotal: $100.00
- Buyer pays: $103.00 (subtotal $100 + 3% buyer fee $3)
- Stripe processing fees: ~$2.99 (2.9% + $0.30) [AUTOMATIC - passed to seller]
- Platform fee (5%): $5.00 [DEDUCTED from seller]
- Seller receives: $92.01 (subtotal $100 - platform fee $5 - Stripe fees $2.99)

### Fee Flow

```
Buyer Payment ($103.00)
    ↓
Buyer pays: $103.00 (subtotal $100 + 3% buyer fee $3)
    ↓
Stripe Processing Fee (~$2.99) [AUTOMATIC - passed to seller]
    ↓
Platform Receives (~$100.01)
    ↓
Platform Fee ($5.00 - 5% of subtotal) [DEDUCTED from seller]
    ↓
Seller Receives ($92.01) [TRANSFERRED]
```

## Important Notes

1. **Buyer pays 3%**: Buyers pay subtotal + 3% payment processing fee
2. **Payment processing fees are automatic**: Stripe deducts them automatically, and they're passed to sellers
3. **Platform fee is our deduction**: We calculate and deduct 5% (of subtotal) before paying seller
4. **Transfers are free**: No additional fees on transfers to payment accounts
5. **Fee tracking**: We store `buyerFee`, `sellerFee`, `sellerNet`, and `platformFee` in the database for accounting

## Code Implementation

### Fee Calculation (`lib/fees.ts`)
```typescript
// Calculate buyer fee (3% of subtotal)
const buyerFee = calculateBuyerFee(subtotal) // $3.00 for $100

// Calculate seller fee (5% of subtotal)
const sellerFee = calculateSellerFee(subtotal) // $5.00 for $100

// Calculate seller net (subtotal - seller fee)
const sellerNet = calculateSellerNet(subtotal) // $95.00 for $100
```

### Payment Intent Creation
```typescript
// When buyer pays
const buyerTotal = calculateBuyerTotal(subtotal) // $103.00 (subtotal + 3%)
await createPaymentIntent(buyerTotal, currency, riftId, buyerEmail)
```

### Payout Process
```typescript
// When releasing funds to seller
await creditSellerOnRelease(
  riftId,
  sellerId,
  sellerNet,  // $95.00 (after 5% platform fee, before Stripe fees)
  currency
)

// Stripe fees are automatically deducted when processing payout
// Final seller amount: $95.00 - Stripe fees (~$2.76) = ~$92.24
```
