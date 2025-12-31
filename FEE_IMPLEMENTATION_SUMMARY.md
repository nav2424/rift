# Platform Fee Implementation Summary

## ✅ Implementation Complete

### Rift Platform Fee Strategy (FINALIZED)

**Goal**: Maximize user growth, trust, and transaction volume while maintaining healthy platform margins.

### 1. Buyer Fee: 3%
- **Buyers pay: subtotal + 3%** - Payment processing and card network fee
- Transparent fee structure shown at checkout
- Covers Stripe payment processing costs

### 2. Seller Fee: 5% Flat
- **Automatically deducted** from all seller payouts
- Calculated as: `sellerFee = subtotal * 0.05`
- Covers:
  - Platform services and infrastructure
  - Fraud protection
  - Dispute resolution
  - Transaction support

### 3. Payment Processing Fees (Stripe)
- **Automatically handled** by Stripe (2.9% + $0.30 per transaction)
- **Passed to seller** - not absorbed by platform
- Standard across all payment platforms

### 4. Total Seller Deduction
- **~8% total** (5% platform fee + ~3% Stripe fees)
- Example: $100 transaction → Seller receives ~$92.01

### 5. Fee Tracking
- `buyerFee` stored in database (3% of subtotal)
- `sellerFee` stored in database (5% of subtotal)
- `sellerNet` stored in database (subtotal - sellerFee)
- All fields tracked in `RiftTransaction` model

### 6. Updated Endpoints
- ✅ `/api/rifts/create` - Calculates buyer fee (3%) and seller fee (5%)
- ✅ `/api/rifts/[id]/fund` - Creates payment intent with buyer total (subtotal + 3%)
- ✅ `/api/rifts/[id]/release` - Uses sellerNet for wallet credit
- ✅ `/api/rifts/auto-release` - Uses sellerNet for wallet credit
- ✅ `/api/admin/rifts/[id]/resolve-dispute` - Uses sellerNet for wallet credit

### 7. Transparency
- Timeline events show fee breakdown (for sellers)
- Email notifications include fee details (for sellers)
- All payouts show: "Platform fee (5%): $X. Seller receives: $Y"
- **Buyers see 3% fee** at checkout

## Fee Flow Example

**Rift Subtotal: $100.00**

1. **Buyer pays**: $103.00 (subtotal $100 + 3% buyer fee $3)
2. **Stripe processing fees**: ~$2.99 (2.9% + $0.30) [AUTOMATIC - passed to seller]
3. **Platform receives**: ~$100.01 (after Stripe fees)
4. **Platform fee (5% of $100)**: $5.00 [DEDUCTED from seller]
5. **Seller receives**: $92.01 [TRANSFERRED]

**Summary:**
- Buyer pays: $103.00 (subtotal $100 + 3% fee $3)
- Seller receives: $92.01
- Total seller deduction: $7.99 (~8%)
- Platform earns: $5.00 (5% platform fee)

## Important Notes

- **Buyer fees: 3%** - Buyers pay subtotal + 3% payment processing fee
- **Seller fees: 5%** - Platform fee calculated from subtotal
- **Stripe fees: Passed to seller** - Not absorbed by platform
- **Fee structure is fixed** - No customization allowed (reduces friction)
- **Transfers are free** - No additional fees on transfers to payment accounts
- **All fees are tracked** - Stored in database for accounting

## Strategic Justification

This fee structure:
- Provides transparent pricing for both buyers and sellers
- Keeps margins clean, UX friction low, and fees competitive
- Sets Rift up to scale quickly with clear value proposition
- Standard fee structure used by many successful platforms

See `PAYMENT_PROCESSING_FEES.md` for detailed explanation!
