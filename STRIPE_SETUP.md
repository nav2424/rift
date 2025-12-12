# Stripe Test Keys Setup Guide

## 📍 Where to Get Your Test Keys

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys)
2. Make sure you're in **Test mode** (toggle in top right)
3. You'll see two keys:
   - **Publishable key** (starts with `pk_test_...`)
   - **Secret key** (starts with `sk_test_...`)

## 🔧 Configuration Steps

### 1. Backend Configuration (`.env` file in root)

Add your **Secret Test Key**:

```env
STRIPE_SECRET_KEY=sk_test_YOUR_ACTUAL_SECRET_KEY_HERE
```

**Important:** The secret key starts with `sk_test_` (for test mode)

### 2. Mobile Configuration (`mobile/app.json`)

Update the `stripePublishableKey` in the `extra` section:

```json
"extra": {
  "apiUrl": "http://192.168.1.126:3000",
  "supabaseUrl": "...",
  "supabaseAnonKey": "...",
  "stripePublishableKey": "pk_test_YOUR_ACTUAL_PUBLISHABLE_KEY_HERE"
}
```

**Important:** The publishable key starts with `pk_test_` (for test mode)

## ✅ After Adding Keys

1. **Restart your backend server:**
   ```bash
   # Stop current server (Ctrl+C)
   npm run dev
   ```

2. **Restart Expo:**
   ```bash
   cd mobile
   # Stop current Expo (Ctrl+C)
   npx expo start --clear
   ```

## 🧪 Testing with Test Cards

Once configured, use these Stripe test cards:

- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- Use any future expiration date (e.g., `12/25`)
- Use any 3-digit CVC (e.g., `123`)
- Use any ZIP code (e.g., `12345`)

## 🚨 Important Notes

- ✅ **Use TEST keys** for development (`pk_test_...` and `sk_test_...`)
- ✅ Both keys must be from the same Stripe account
- ✅ Both keys must be TEST keys (not live/production keys)
- ❌ **Never commit your secret keys to git** (they're already in `.gitignore`)

## 🔄 When Going to Production

When you're ready for production:
1. Switch to **Live mode** in Stripe Dashboard
2. Get your **Live keys** (`pk_live_...` and `sk_live_...`)
3. Update both `.env` and `mobile/app.json`
4. Set `testEnv: false` for Google Pay in the payment code

