# Twilio SMS Setup Guide

## Quick Setup

### 1. Get Twilio Credentials

1. Sign up at https://www.twilio.com (free trial available)
2. Go to **Console Dashboard** → **Account Info**
3. Copy:
   - **Account SID** (starts with `AC...`)
   - **Auth Token** (click to reveal)
4. Get a **Phone Number**:
   - Go to **Phone Numbers** → **Manage** → **Buy a number**
   - Choose a number that supports SMS
   - Copy the number (format: `+1234567890`)

### 2. Add to `.env.local`

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890
```

**Important:**
- `TWILIO_PHONE_NUMBER` must include country code with `+` (e.g., `+1` for US)
- Format: `+[country code][number]` (e.g., `+14155552671`)

### 3. Restart Your Server

After adding credentials, restart your development server:

```bash
# Stop server (Ctrl+C)
npm run dev
```

The server needs to restart to load new environment variables.

### 4. Test

1. Try sending a phone verification code
2. Check your server logs - you should see:
   ```
   ✅ SMS sent successfully via Twilio: { to: '+11234567890', sid: 'SM...' }
   ```
3. Check your phone - you should receive the SMS

## Troubleshooting

### "SMS service not configured" Error

**Check:**
1. ✅ Variables are in `.env.local` (not `.env`)
2. ✅ Variable names are exact: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
3. ✅ No extra spaces or quotes around values
4. ✅ Server was restarted after adding variables

**Test if variables are loaded:**
```bash
# In your terminal
node -e "require('dotenv').config({ path: '.env.local' }); console.log('SID:', process.env.TWILIO_ACCOUNT_SID ? 'SET' : 'NOT SET')"
```

### "Invalid phone number format" Error

**Twilio requires E.164 format:**
- ✅ `+11234567890` (correct)
- ❌ `1234567890` (missing country code)
- ❌ `(123) 456-7890` (wrong format)

The system automatically formats numbers, but ensure:
- US/Canada: Include country code `+1` or provide 10-digit number
- International: Include `+` and country code

### "Phone number cannot receive SMS" Error

**Possible causes:**
- Number is a landline (can't receive SMS)
- Number is blocked or invalid
- Number format is incorrect

**Solutions:**
- Use a mobile number
- Verify number format is correct
- Check Twilio logs in dashboard

### SMS Not Received

**Check:**
1. ✅ Twilio account has balance (trial accounts have free credits)
2. ✅ Phone number is correct
3. ✅ Check spam/filtered messages
4. ✅ Check Twilio logs in dashboard for delivery status
5. ✅ Verify phone number can receive SMS (not landline)

### Error Codes

**Common Twilio Error Codes:**

- `21211` - Invalid phone number format
- `21608` - Phone number not reachable
- `21614` - Phone number cannot receive SMS
- `20003` / `20008` - Authentication error (check credentials)

## Twilio Dashboard

Monitor SMS delivery:
- **Console** → **Monitor** → **Logs** → **Messaging**
- Check delivery status, errors, and costs

## Production Deployment

For Vercel/production:

1. Add environment variables in Vercel Dashboard:
   - Project Settings → Environment Variables
   - Add all three Twilio variables
   - Select "Production" environment

2. Redeploy after adding variables

3. Verify variables are set:
   - Check Vercel deployment logs
   - Look for "✅ SMS sent successfully" messages

## Cost

- **Trial Account**: Free credits for testing
- **Paid Account**: ~$0.0075 per SMS in US/Canada
- Check pricing: https://www.twilio.com/sms/pricing

## Testing

**Test Mode:**
- Twilio provides test credentials for testing
- Test credentials won't send real SMS
- Use actual credentials for production

**Verification:**
1. Send verification code
2. Check server logs for success message
3. Receive SMS on phone
4. Enter code to verify

---

**Need Help?**
- Twilio Docs: https://www.twilio.com/docs/sms
- Twilio Console: https://console.twilio.com
- Check server logs for detailed error messages
