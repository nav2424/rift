# Plaid Integration Setup Guide

## Overview

Rift now supports bank transfers via Plaid integration, prioritized over credit card payments. This provides lower fees and faster processing for buyers.

## How It Works

1. **Stripe Integration**: Plaid is integrated through Stripe's `us_bank_account` payment method type
2. **Automatic Flow**: When a buyer selects bank transfer, Stripe Elements automatically shows the Plaid Link interface
3. **Priority**: Bank transfers are shown first in the payment method selector

## Required Environment Variables

Add these to your `.env` file and Vercel environment variables:

```env
# Plaid Configuration (Required for bank transfers)
PLAID_CLIENT_ID=your_plaid_client_id
PLAID_SECRET_KEY=your_plaid_secret_key
PLAID_ENV=sandbox  # Use 'sandbox' for testing, 'production' for live

# Optional: Plaid Webhook URL (for account updates)
PLAID_WEBHOOK_URL=https://your-domain.com/api/webhooks/plaid
```

## Getting Plaid Credentials

### 1. Create a Plaid Account

1. Go to https://dashboard.plaid.com/signup
2. Sign up for a Plaid account
3. Complete your business information

### 2. Get API Keys

1. Log in to the Plaid Dashboard
2. Go to **Team Settings** → **Keys**
3. Copy your **Client ID** and **Secret Key**
4. Select the appropriate environment:
   - **Sandbox**: For testing
   - **Development**: For development
   - **Production**: For live payments

### 3. Configure Webhooks (Optional)

1. Go to **Team Settings** → **Webhooks**
2. Add your webhook URL: `https://your-domain.com/api/webhooks/plaid`
3. Select the events you want to receive (account updates, transactions, etc.)

## Stripe Configuration

### Enable ACH Direct Debit in Stripe

1. Log in to your Stripe Dashboard
2. Go to **Settings** → **Payment methods**
3. Enable **ACH Direct Debit** (if not already enabled)
4. Complete any required verification steps

### Enable Plaid Integration

1. In Stripe Dashboard, go to **Settings** → **Integrations**
2. Find **Plaid** and enable it
3. Connect your Plaid account
4. Verify the connection

## Testing

### Sandbox Mode

1. Set `PLAID_ENV=sandbox` in your environment variables
2. Use Plaid's test credentials
3. Use test bank accounts from Plaid's test credentials page:
   - https://plaid.com/docs/sandbox/test-credentials/

### Test Bank Accounts

Use these test credentials in Plaid Link:
- **Institution**: any
- **Username**: `user_good`
- **Password**: `pass_good`

## Payment Flow

### For Buyers

1. When making a payment, they'll see "Bank Transfer" as the first option
2. Clicking "Bank Transfer" opens Plaid Link
3. They connect their bank account
4. The payment is processed as an ACH transfer
5. Funds are typically available in 1-3 business days

### For Sellers

- Payments from bank transfers work the same as credit card payments
- Funds are held in escrow until delivery is confirmed
- Processing times may be slightly longer than credit cards

## Fees

- **Bank Transfers**: Lower fees (typically 0.8% vs 2.9% for cards)
- **Credit Cards**: Standard Stripe fees (2.9% + $0.30)

## Troubleshooting

### Bank Transfer Not Showing

1. Verify `PLAID_CLIENT_ID` and `PLAID_SECRET_KEY` are set
2. Check that `us_bank_account` is in the payment method types (it should be automatically)
3. Ensure Stripe has ACH Direct Debit enabled
4. Verify Plaid integration is enabled in Stripe Dashboard

### Payment Fails

1. Check Plaid logs in the Plaid Dashboard
2. Verify the bank account has sufficient funds
3. Ensure the bank supports ACH transfers
4. Check Stripe logs for payment intent errors

## Security Notes

- Never commit Plaid credentials to git
- Use environment variables for all secrets
- Use sandbox mode for testing
- Switch to production only after thorough testing

## Support

- Plaid Documentation: https://plaid.com/docs/
- Stripe ACH Documentation: https://stripe.com/docs/payments/ach-direct-debit
- Stripe Plaid Integration: https://stripe.com/docs/payments/ach-direct-debit/plaid
