# Twilio SMS Setup Guide

## 📍 Where to Get Your Twilio Credentials

1. Go to [Twilio Console](https://console.twilio.com/)
2. Sign up for a free account (or log in if you already have one)
3. You'll get free trial credits to test SMS functionality
4. Navigate to **Dashboard** → You'll see:
   - **Account SID** (starts with `AC...`)
   - **Auth Token** (click "View" to reveal)
5. Get a phone number:
   - Go to **Phone Numbers** → **Manage** → **Buy a number**
   - For testing, you can use Twilio's trial number (limited to verified numbers)
   - For production, purchase a number (costs ~$1/month)

## 🔧 Configuration Steps

### 1. Backend Configuration (`.env.local` file in root)

Add your Twilio credentials:

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890
```

**Important Notes:**
- `TWILIO_ACCOUNT_SID` starts with `AC` (Account SID)
- `TWILIO_AUTH_TOKEN` is your secret auth token (keep it secure!)
- `TWILIO_PHONE_NUMBER` must include country code (e.g., `+1` for US/Canada)
- The phone number format should be: `+[country code][number]` (e.g., `+15551234567`)

## ✅ After Adding Credentials

1. **Restart your backend server:**
   ```bash
   # Stop current server (Ctrl+C)
   npm run dev
   ```

2. **Test SMS sending:**
   - Go to `/settings/verification`
   - Enter your phone number
   - Click "Send Verification Code"
   - You should receive an SMS with the code

## 🧪 Testing with Twilio Trial Account

**Trial Account Limitations:**
- Can only send SMS to verified phone numbers
- To verify a number: Twilio Console → Phone Numbers → Verified Caller IDs → Add a new number
- Free trial credits available (usually $15-20 worth)

**For Production:**
- Upgrade your Twilio account
- Purchase a phone number (~$1/month)
- SMS costs ~$0.0083 per message in US/Canada

## 🚨 Important Notes

- ✅ **Use TEST credentials** for development (trial account)
- ✅ Keep `TWILIO_AUTH_TOKEN` secret (never commit to git)
- ✅ Phone numbers must include country code (e.g., `+1` for US/Canada)
- ❌ **Never commit your auth token to git** (it's already in `.gitignore`)

## 🔄 Development Mode Behavior

If Twilio credentials are not configured:
- In **development**: SMS codes are logged to console for testing
- In **production**: API will return an error if SMS cannot be sent

## 📱 Phone Number Format

The system automatically formats phone numbers:
- If number starts with `+`, it's used as-is
- If number doesn't start with `+`, it's prefixed with `+`
- Example: `15551234567` → `+15551234567`

## 💰 Cost Estimate

- **Per SMS**: ~$0.0083 (US/Canada)
- **Phone Number**: ~$1/month
- **100 verifications/month**: ~$0.83
- **1,000 verifications/month**: ~$8.30

## 🔄 When Going to Production

1. Upgrade your Twilio account from trial
2. Purchase a dedicated phone number
3. Update environment variables with production credentials
4. Test SMS delivery to unverified numbers
5. Monitor usage and costs in Twilio Console

## Troubleshooting

**"SMS service not configured" error:**
- Verify `.env.local` exists in project root
- Check variable names match exactly (case-sensitive)
- Ensure `TWILIO_PHONE_NUMBER` includes country code with `+`
- Restart your dev server

**SMS not received:**
- Check Twilio Console → Logs → Messaging for delivery status
- Verify phone number format (must include country code)
- For trial accounts, ensure recipient number is verified in Twilio
- Check Twilio account balance/credits

**"Invalid phone number" error:**
- Ensure phone number includes country code
- Format: `+[country code][number]` (e.g., `+15551234567`)
- Remove spaces, dashes, or parentheses
