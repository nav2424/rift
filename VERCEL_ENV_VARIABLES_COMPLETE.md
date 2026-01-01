# Complete Vercel Environment Variables List

## 🔴 REQUIRED (Must Have for Production)

### Core Application
1. **`DATABASE_URL`**
   - PostgreSQL connection string
   - Format: `postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres`
   - Get from: Supabase Dashboard → Settings → Database → Connection string (URI)

2. **`NEXTAUTH_SECRET`**
   - Secret for encrypting NextAuth.js sessions
   - Generate: `openssl rand -base64 32`
   - Must be at least 32 characters

3. **`NEXTAUTH_URL`**
   - Your production URL
   - Format: `https://yourdomain.com` or `https://your-project.vercel.app`
   - Must start with `https://`, no trailing slash

4. **`JWT_SECRET`**
   - Secret for signing JWT tokens (mobile app auth)
   - Generate: `openssl rand -hex 64`
   - Must be at least 64 characters

---

## 🟡 STRONGLY RECOMMENDED (Needed for Core Features)

### Payment Processing (Stripe)
5. **`STRIPE_SECRET_KEY`**
   - Stripe secret key
   - Production: `sk_live_...`
   - Get from: Stripe Dashboard → API Keys → Secret key
   - **Required for:** Payment processing, payouts

6. **`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`**
   - Stripe publishable key
   - Production: `pk_live_...`
   - Get from: Stripe Dashboard → API Keys → Publishable key
   - **Required for:** Client-side payment forms

7. **`STRIPE_WEBHOOK_SECRET`**
   - Stripe webhook signing secret
   - Format: `whsec_...`
   - Get from: Stripe Dashboard → Webhooks → Click endpoint → Signing secret
   - **CRITICAL:** Required in production for webhook security

### Supabase (Storage & Messaging)
8. **`NEXT_PUBLIC_SUPABASE_URL`**
   - Supabase project URL
   - Format: `https://[PROJECT-ID].supabase.co`
   - Get from: Supabase Dashboard → Settings → API → Project URL
   - **Required for:** File storage, messaging, real-time features

9. **`NEXT_PUBLIC_SUPABASE_ANON_KEY`**
   - Supabase anonymous/public key
   - Get from: Supabase Dashboard → Settings → API → anon/public key
   - **Required for:** Client-side Supabase operations

10. **`SUPABASE_SERVICE_ROLE_KEY`**
    - Supabase service role key (⚠️ KEEP SECRET!)
    - Get from: Supabase Dashboard → Settings → API → service_role key
    - **Required for:** Server-side Supabase operations, file uploads

### Email (SMTP)
11. **`SMTP_HOST`**
    - SMTP server hostname
    - Examples: `smtp.gmail.com`, `smtp.zohocloud.ca`
    - **Required for:** Email notifications

12. **`SMTP_PORT`**
    - SMTP port number
    - Usually: `587` (TLS) or `465` (SSL)
    - **Required for:** Email notifications

13. **`SMTP_SECURE`**
    - SSL/TLS setting
    - Values: `false` (for port 587) or `true` (for port 465)
    - **Required for:** Email notifications

14. **`SMTP_USER`**
    - SMTP username/email
    - Example: `support@joinrift.co`
    - **Required for:** Email notifications

15. **`SMTP_PASSWORD`**
    - SMTP password or app password
    - For Gmail: Use App Password (not regular password)
    - **Required for:** Email notifications

16. **`SMTP_FROM`**
    - "From" email address
    - Format: `"Rift <support@joinrift.co>"` or `support@joinrift.co`
    - **Required for:** Email notifications

---

## 🟢 OPTIONAL (Add if Using These Features)

### AI Assistant
17. **`OPENAI_API_KEY`**
    - OpenAI API key for RIFT AI assistant
    - Format: `sk-...`
    - Get from: https://platform.openai.com/api-keys
    - **Required for:** AI chatbot functionality
    - **Note:** Without this, chatbot may not work or may have limited functionality

### SMS/Phone Verification (Twilio)
18. **`TWILIO_ACCOUNT_SID`**
    - Twilio account SID
    - Format: `AC...`
    - Get from: Twilio Console → Account Info
    - **Required for:** SMS verification codes

19. **`TWILIO_AUTH_TOKEN`**
    - Twilio auth token
    - Get from: Twilio Console → Account Info
    - **Required for:** SMS verification codes

20. **`TWILIO_PHONE_NUMBER`**
    - Twilio phone number
    - Format: `+1234567890`
    - Get from: Twilio Console → Phone Numbers
    - **Required for:** SMS verification codes

### Cron Jobs
21. **`CRON_SECRET`**
    - Secret for securing cron endpoints
    - Generate: `openssl rand -hex 32`
    - **Required for:** Securing auto-release and payout cron jobs
    - **Note:** Without this, cron endpoints are unprotected (security risk)

### Vault Encryption (if using custom encryption)
22. **`VAULT_ENCRYPTION_KEY`** (if applicable)
    - Encryption key for vault files
    - Generate: `openssl rand -hex 32`
    - **Note:** Check if your vault system requires this

---

## 📋 Quick Checklist for Vercel

### Must Have (4):
- [ ] `DATABASE_URL`
- [ ] `NEXTAUTH_SECRET`
- [ ] `NEXTAUTH_URL`
- [ ] `JWT_SECRET`

### Strongly Recommended (12):
- [ ] `STRIPE_SECRET_KEY`
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- [ ] `STRIPE_WEBHOOK_SECRET` ⚠️ **CRITICAL**
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `SMTP_HOST`
- [ ] `SMTP_PORT`
- [ ] `SMTP_SECURE`
- [ ] `SMTP_USER`
- [ ] `SMTP_PASSWORD`
- [ ] `SMTP_FROM`

### Optional (5):
- [ ] `OPENAI_API_KEY` (for AI assistant)
- [ ] `TWILIO_ACCOUNT_SID` (for SMS)
- [ ] `TWILIO_AUTH_TOKEN` (for SMS)
- [ ] `TWILIO_PHONE_NUMBER` (for SMS)
- [ ] `CRON_SECRET` (for cron security)

---

## 🔧 How to Generate Secrets

```bash
# NEXTAUTH_SECRET
openssl rand -base64 32

# JWT_SECRET
openssl rand -hex 64

# CRON_SECRET
openssl rand -hex 32
```

Or use online generator: https://generate-secret.vercel.app/

---

## 📝 Complete Example .env File

```env
# Core (Required)
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres
NEXTAUTH_SECRET=[GENERATED_SECRET_32_CHARS]
NEXTAUTH_URL=https://yourdomain.com
JWT_SECRET=[GENERATED_SECRET_64_CHARS]

# Stripe (Required for payments)
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Supabase (Required for storage/messaging)
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Email (Required for notifications)
SMTP_HOST=smtp.zohocloud.ca
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=support@joinrift.co
SMTP_PASSWORD=[YOUR_PASSWORD]
SMTP_FROM="Rift <support@joinrift.co>"

# AI Assistant (Optional)
OPENAI_API_KEY=sk-...

# SMS/Phone Verification (Optional)
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1234567890

# Cron Security (Recommended)
CRON_SECRET=[GENERATED_SECRET_32_CHARS]
```

---

## ⚠️ Important Notes

1. **Select Environment:** When adding in Vercel, select **Production**, **Preview**, and **Development** for each variable (or at least Production)

2. **Redeploy Required:** After adding variables, you must redeploy for them to take effect

3. **Case Sensitive:** Variable names are case-sensitive. Use exact names shown above.

4. **No Quotes:** Don't wrap values in quotes unless the value itself contains spaces (like `SMTP_FROM`)

5. **Security:** Never commit these values to git. They should only exist in Vercel's environment variables.

---

## 🚨 Critical for Production

These MUST be set in production:
- `STRIPE_WEBHOOK_SECRET` - Without this, webhooks will fail
- `DATABASE_URL` - App won't work without database
- `NEXTAUTH_SECRET` & `NEXTAUTH_URL` - Authentication won't work
- `JWT_SECRET` - Mobile app auth won't work

---

**Last Updated:** Based on current codebase analysis

