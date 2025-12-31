# How to Get Twilio Credentials

## What You Need

For SMS verification, you need **3 things** from Twilio:

1. **TWILIO_ACCOUNT_SID** - Your account identifier
2. **TWILIO_AUTH_TOKEN** - Your API secret key (like a password)
3. **TWILIO_PHONE_NUMBER** - Your phone number (`+12762938005`)

## Where to Find Them

### 1. Account SID & Auth Token

**Location:** Twilio Console Dashboard

1. Go to https://console.twilio.com
2. You should be on the **Account Dashboard** (home page)
3. Look for **"Account Info"** or **"Console Dashboard"** section
4. You'll see:
   - **Account SID** - Starts with `AC...` (e.g., `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)
   - **Auth Token** - Click the eye icon or "View" button to reveal it

**Screenshot location:**
- Left sidebar: Click "Account Dashboard" (home icon)
- Main page: Look for "Account Info" card/box
- Or: Top right dropdown (your account name) → "Account" → "Account Info"

### 2. Phone Number

**You already have this:** `+1 276 293 8005`

**Format for .env.local:** `+12762938005` (remove spaces)

**To verify:**
- Left sidebar: **Develop** → **Phone Numbers** → **Manage** → **Active numbers**
- You should see your number there (as shown in your screenshot)

## Add to .env.local

Once you have all three, add them to `.env.local`:

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+12762938005
```

## Important Notes

✅ **Account SID** is safe to see (it's like a username)
⚠️ **Auth Token** is SECRET (like a password) - keep it safe!
✅ **Phone Number** is safe to share

**Security:**
- Never commit these to git (`.env.local` should be in `.gitignore`)
- Never share your Auth Token publicly
- If compromised, regenerate it in Twilio Dashboard

## Can't Find Your Credentials?

**Account SID & Auth Token:**
1. Go to https://console.twilio.com
2. Click your account name (top right dropdown)
3. Select "Account" or "Account Info"
4. Look for "Account SID" and "Auth Token"

**Phone Number:**
- You already have it: `+1 276 293 8005`
- Or check: **Develop** → **Phone Numbers** → **Active numbers**

## Verify Setup

After adding credentials, restart your server and test:

1. `npm run dev` (restart)
2. Try sending phone verification
3. Check logs: Should see `✅ SMS sent successfully via Twilio`
4. Check your phone: Should receive SMS

