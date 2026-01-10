# Fix: Stripe Connect Platform Profile Setup Required

## Error Message

```
You must complete your platform profile to use Connect and create live connected accounts. 
Visit your dashboard at https://dashboard.stripe.com/connect/accounts/overview to answer the questionnaire.
```

## Problem

Stripe requires you to complete a platform profile questionnaire before you can create connected accounts (for sellers to receive payouts). This is a one-time setup required in both test and live modes.

## Solution: Complete Stripe Connect Platform Profile

### Step 1: Navigate to Stripe Dashboard

1. **Go to Stripe Dashboard**: https://dashboard.stripe.com/
2. **Select the correct mode**:
   - **Test Mode**: Toggle "Test mode" ON (top right) - for development/testing
   - **Live Mode**: Toggle "Test mode" OFF - for production
3. **Navigate to Connect Settings**:
   - Click **Settings** (gear icon in sidebar)
   - Click **Connect** → **Platform profile**

   OR directly visit:
   - **Test Mode**: https://dashboard.stripe.com/test/connect/accounts/overview
   - **Live Mode**: https://dashboard.stripe.com/connect/accounts/overview

### Step 2: Complete the Questionnaire

The questionnaire will ask about:

1. **Platform Information**:
   - Platform name (already set to "Rift" typically)
   - Platform URL
   - Support email
   - Support phone number

2. **Business Model**:
   - What type of marketplace/platform you operate
   - How you verify sellers/users
   - How disputes are handled

3. **Legal & Compliance**:
   - Terms of Service URL
   - Privacy Policy URL
   - Whether you verify user identities
   - Your dispute resolution process

4. **Responsibilities**:
   - Review and accept responsibilities for managing losses
   - Confirm you understand your obligations as a platform

### Step 3: Complete All Required Fields

- Fill out all required fields (marked with *)
- Ensure URLs are valid and accessible
- Review all information before submitting

### Step 4: Submit and Wait for Approval

- Click "Submit" or "Save"
- Stripe will review your submission (usually instant for test mode, may take longer for live mode)
- You'll receive an email confirmation when approved

### Step 5: Verify Setup

After completing the questionnaire:

1. **Check the dashboard**: The error should no longer appear
2. **Test account creation**: Try creating a connected account through your app
3. **Verify both modes**: Complete the setup in both test and live modes if you're using both

## Important Notes

### Separate Setup for Test and Live Modes

- **You must complete the setup separately** for test mode and live mode
- If you're using test keys (`sk_test_...`), complete it in test mode
- If you're using live keys (`sk_live_...`), complete it in live mode

### Environment Variables

Make sure your environment variables are correctly set:

```bash
# For Test Mode (development)
STRIPE_SECRET_KEY=sk_test_...

# For Live Mode (production)
STRIPE_SECRET_KEY=sk_live_...
```

### After Setup

Once the platform profile is completed:

1. ✅ Connected accounts can be created
2. ✅ Sellers can complete onboarding
3. ✅ Payouts can be processed
4. ✅ The error will no longer appear

## Quick Links

- **Test Mode Platform Profile**: https://dashboard.stripe.com/test/connect/accounts/overview
- **Live Mode Platform Profile**: https://dashboard.stripe.com/connect/accounts/overview
- **Stripe Connect Documentation**: https://stripe.com/docs/connect
- **Platform Responsibilities**: https://stripe.com/docs/connect/account-management

## Troubleshooting

### "Questionnaire still showing as incomplete"
- Make sure you're in the correct mode (test vs live)
- Check that all required fields are filled
- Try refreshing the page
- Clear browser cache if needed

### "Error persists after completing questionnaire"
- Wait a few minutes for Stripe to process the submission
- Verify you completed it in the correct mode (test/live)
- Check that your Stripe API keys match the mode you completed the questionnaire in
- Try regenerating your API keys if the issue persists

### "I don't have Terms of Service or Privacy Policy URLs"
- You can use placeholder URLs temporarily for test mode
- For live mode, you'll need actual, published legal pages
- Consider using a service like Termly or iubenda if needed

## Status

✅ **Code Updated**: Error handling improved to detect and provide clear guidance for this issue
✅ **Documentation**: This guide created
⏳ **Action Required**: Complete the questionnaire in your Stripe Dashboard (see Step 1-2 above)
