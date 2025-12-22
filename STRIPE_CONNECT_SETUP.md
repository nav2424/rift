# Stripe Connect Setup Guide

## ⚠️ Important: Platform Setup Required

Before users can connect their Stripe accounts, you must complete the Stripe Connect platform setup in your Stripe Dashboard.

## Step 1: Complete Stripe Connect Profile

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/)
2. Navigate to **Settings** → **Connect** → **Platform profile**
3. Complete all required information:
   - Business information
   - Platform details
   - Terms of service
   - Privacy policy
   - Review and accept responsibilities for managing losses

## Step 2: Configure Connect Settings

1. Go to **Settings** → **Connect** → **Settings**
2. Configure:
   - **Branding**: Your platform name and logo
   - **Onboarding**: Customize the onboarding experience
   - **Payouts**: Configure payout schedules and methods

## Step 3: Test Mode vs Live Mode

### Test Mode
- Use test API keys (`sk_test_...`)
- Create test connected accounts
- Test the full flow without real money

### Live Mode
- Use live API keys (`sk_live_...`)
- Real connected accounts
- Real payouts

**Important**: Complete the Connect profile setup in both test and live modes separately.

## Step 4: Verify Setup

After completing the setup, try creating a connected account through your application. The error should be resolved.

## Common Errors

### "Please review the responsibilities of managing losses"
- **Cause**: Connect profile not completed
- **Solution**: Complete the platform profile in Stripe Dashboard (Step 1)

### "Account creation failed"
- **Cause**: Missing required information in Connect settings
- **Solution**: Review all Connect settings and ensure all required fields are filled

### "Invalid country code"
- **Cause**: Country not supported or incorrectly specified
- **Solution**: Ensure the country code is valid (e.g., 'CA' for Canada, 'US' for United States)

## Testing

1. Use Stripe test mode
2. Create a test connected account
3. Complete the onboarding flow
4. Verify payouts work correctly

## Production Checklist

- [ ] Connect profile completed in live mode
- [ ] All required business information provided
- [ ] Terms of service and privacy policy URLs set
- [ ] Payout settings configured
- [ ] Tested with real connected accounts
- [ ] Webhook endpoints configured (if using webhooks)

## Support

If you continue to experience issues:
1. Check [Stripe Connect Documentation](https://stripe.com/docs/connect)
2. Review [Stripe Dashboard](https://dashboard.stripe.com/settings/connect/platform-profile)
3. Contact Stripe Support if needed
