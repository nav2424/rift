# Plaid Bank Transfer Limitations

## Current Status

**Important**: Bank transfers via Plaid are currently **US-only** (USD currency).

### Why Bank Transfers Don't Show for Non-US Users

Stripe's `us_bank_account` payment method type (which integrates with Plaid) is only available for:
- **Currency**: USD only
- **Country**: United States only

For transactions in other currencies (CAD, EUR, GBP, etc.) or from other countries, only credit card payments are available.

## Implementation Details

The code automatically detects the currency and only includes `us_bank_account` for USD transactions:

```typescript
const isUSD = currency.toLowerCase() === 'usd'
const paymentMethodTypes = isUSD 
  ? ['us_bank_account', 'card'] // US: prioritize bank transfers
  : ['card'] // Non-US: card only
```

## Supported Regions

### ✅ United States (USD)
- **Payment Methods**: Bank transfers (ACH) + Credit cards
- **Bank Transfer Method**: `us_bank_account` via Plaid/Stripe
- **Fees**: Lower fees for bank transfers (~0.8% vs 2.9% for cards)

### ❌ Canada (CAD)
- **Payment Methods**: Credit cards only
- **Reason**: `us_bank_account` is US-only
- **Future**: Would require EFT (Electronic Funds Transfer) implementation

### ❌ Other Countries
- **Payment Methods**: Credit cards only
- **Reason**: Bank transfers require country-specific implementations

## Future Enhancements

To support bank transfers in other countries, we would need:

1. **Canada**: Implement EFT (Electronic Funds Transfer) via Stripe or direct bank integration
2. **UK**: Implement BACS Direct Debit
3. **EU**: Implement SEPA Direct Debit
4. **Other Regions**: Country-specific bank transfer implementations

Each would require:
- Different Stripe payment method types
- Country-specific compliance and verification
- Different fee structures
- Regulatory considerations

## Current User Experience

### For US Users (USD)
- Bank transfer option appears first
- Can connect bank account via Plaid
- Lower fees available
- Credit card still available as fallback

### For Non-US Users (CAD, EUR, etc.)
- Only credit card option available
- Standard card fees apply
- Bank transfers not available

## Testing

To test bank transfers:
1. Create a Rift transaction with USD currency
2. Payment modal will show bank transfer option first
3. Select bank transfer to connect via Plaid
4. Complete the payment

To test non-US (current state):
1. Create a Rift transaction with CAD currency (or other non-USD)
2. Only credit card option will be available
3. Complete payment with card
