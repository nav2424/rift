# Vercel Environment Variables Guide

This guide tells you **exactly what to put** for each environment variable in Vercel.

## Where to Add These

1. Go to: https://vercel.com/dashboard
2. Select your project: **Rift**
3. Go to: **Settings** → **Environment Variables**
4. Add each variable below
5. **Important:** Select **Production**, **Preview**, and **Development** for each variable
6. Click **Save**
7. **Redeploy** after adding variables (they only apply to new deployments)

---

## 🔴 REQUIRED Variables (Must Have)

### 1. `DATABASE_URL`

**What it is:** PostgreSQL database connection string

**Where to get it:**
- If using **Supabase**: 
  - Go to Supabase Dashboard → Settings → Database
  - Copy "Connection string" → "URI" (not "Pooler")
  - Format: `postgresql://postgres:[YOUR-PASSWORD]@[HOST]:5432/postgres`
- If using **other PostgreSQL**:
  - Format: `postgresql://username:password@host:5432/database_name`

**Example:**
```
postgresql://postgres.abcdefghijk:your-password@aws-0-us-east-1.pooler.supabase.com:5432/postgres
```

---

### 2. `NEXTAUTH_SECRET`

**What it is:** Secret key for encrypting NextAuth.js sessions

**How to generate:**
Run this command in your terminal:
```bash
openssl rand -base64 32
```
Or use: https://generate-secret.vercel.app/32

**Example:**
```
xK8mN9pQ2rS5vY8zA1bC4dE7fH0jK3mN6pQ9sT2vW5yZ8=
```

**Important:** 
- Generate a NEW secret (don't reuse from development)
- Keep it secure
- At least 32 characters long

---

### 3. `NEXTAUTH_URL`

**What it is:** The public URL of your deployed app

**What to put:**
Use your Vercel deployment URL:
```
https://rift-6fbrrlxtl-arnavs-projects-a09defee.vercel.app
```

Or if you have a custom domain:
```
https://yourdomain.com
```

**Important:** 
- Must start with `https://`
- No trailing slash
- Must match your actual deployment URL

---

### 4. `JWT_SECRET`

**What it is:** Secret for signing JWT tokens (for mobile app auth)

**How to generate:**
Run this command:
```bash
openssl rand -hex 64
```

**Example:**
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2a3b4c5d6e7f8g9h0i1j2k3l4m5n6o7p8q9r0s1t2
```

**Important:**
- Generate a NEW secret (different from NEXTAUTH_SECRET)
- At least 64 characters
- Keep it secure

---

## 🟡 OPTIONAL but Recommended (Depending on Features)

### 5. `STRIPE_SECRET_KEY`

**Only needed if:** You're using payment processing

**Where to get it:**
1. Go to: https://dashboard.stripe.com/apikeys
2. Make sure you're in **Test mode** (toggle in top right)
3. Copy the **Secret key** (starts with `sk_test_...`)

**For production:** Switch to **Live mode** and use `sk_live_...`

**Example:**
```
sk_test_51ABC123... (for testing)
sk_live_51ABC123... (for production)
```

---

### 6. `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

**Only needed if:** You're using payment processing

**Where to get it:**
1. Same place as above: https://dashboard.stripe.com/apikeys
2. Copy the **Publishable key** (starts with `pk_test_...`)

**For production:** Use `pk_live_...`

**Example:**
```
pk_test_51ABC123... (for testing)
pk_live_51ABC123... (for production)
```

**Important:** This one has `NEXT_PUBLIC_` prefix, so it's exposed to the browser (that's safe for publishable keys)

---

### 7. `STRIPE_WEBHOOK_SECRET`

**Only needed if:** You're using Stripe webhooks

**Where to get it:**
1. Go to: https://dashboard.stripe.com/webhooks
2. Create or select a webhook endpoint
3. Copy the **Signing secret** (starts with `whsec_...`)

**Example:**
```
whsec_1234567890abcdef...
```

---

### 8. `NEXT_PUBLIC_SUPABASE_URL`

**Only needed if:** You're using Supabase for messaging/real-time features

**Where to get it:**
1. Go to your Supabase project: https://supabase.com/dashboard
2. Select your project
3. Go to: **Settings** → **API**
4. Copy **Project URL**

**Example:**
```
https://abcdefghijklmnop.supabase.co
```

---

### 9. `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Only needed if:** You're using Supabase

**Where to get it:**
1. Same place as above: Supabase Dashboard → Settings → API
2. Copy **anon/public** key

**Example:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY1MTMyNzY3NiwiZXhwIjoxOTY2OTA5Njc2fQ.abcdefghijklmnopqrstuvwxyz
```

**Important:** This is safe to expose (it's public by design)

---

### 10. `SUPABASE_SERVICE_ROLE_KEY`

**Only needed if:** You're using Supabase for server-side operations

**Where to get it:**
1. Same place: Supabase Dashboard → Settings → API
2. Copy **service_role** key (⚠️ **Keep this SECRET!**)

**Example:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjUxMzI3Njc2LCJleHAiOjE5NjY5MDk2NzZ9.xyzabcdefghijklmnopqrstuvw
```

**⚠️ WARNING:** This key bypasses all security rules. Never expose it to the client!

---

### 11-16. Email Configuration (SMTP)

**Only needed if:** You want email notifications to work

#### `SMTP_HOST`
**What to put:**
- Gmail: `smtp.gmail.com`
- Outlook: `smtp-mail.outlook.com`
- SendGrid: `smtp.sendgrid.net`
- Custom: Your SMTP server hostname

**Example:**
```
smtp.gmail.com
```

---

#### `SMTP_PORT`
**What to put:**
- Usually: `587` (TLS) or `465` (SSL)

**Example:**
```
587
```

---

#### `SMTP_SECURE`
**What to put:**
- `false` for port 587 (TLS)
- `true` for port 465 (SSL)

**Example:**
```
false
```

---

#### `SMTP_USER`
**What to put:** Your email address or SMTP username

**Example:**
```
noreply@yourdomain.com
```

---

#### `SMTP_PASSWORD`
**What to put:** Your email password or app-specific password

**For Gmail:**
- Use an "App Password" (not your regular password)
- Go to: Google Account → Security → 2-Step Verification → App passwords

**Example:**
```
abcdefghijklmnop
```

---

#### `SMTP_FROM`
**What to put:** The "from" email address that appears in emails

**Example:**
```
noreply@yourdomain.com
```

---

### 17. `CRON_SECRET`

**Only needed if:** You want to secure your cron endpoints

**What to put:** A secret string to protect cron jobs from unauthorized access

**How to generate:**
```bash
openssl rand -hex 32
```

**Example:**
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4
```

---

## 📋 Quick Checklist

Copy this and check off as you add each:

### Required (Must Have):
- [ ] `DATABASE_URL` - Your PostgreSQL connection string
- [ ] `NEXTAUTH_SECRET` - Generated secret (32+ chars)
- [ ] `NEXTAUTH_URL` - Your Vercel URL (`https://...`)
- [ ] `JWT_SECRET` - Generated secret (64+ chars)

### Optional (Add if using):
- [ ] `STRIPE_SECRET_KEY` - If using payments
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - If using payments
- [ ] `STRIPE_WEBHOOK_SECRET` - If using Stripe webhooks
- [ ] `NEXT_PUBLIC_SUPABASE_URL` - If using Supabase
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` - If using Supabase
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - If using Supabase
- [ ] `SMTP_HOST` - If sending emails
- [ ] `SMTP_PORT` - If sending emails
- [ ] `SMTP_SECURE` - If sending emails
- [ ] `SMTP_USER` - If sending emails
- [ ] `SMTP_PASSWORD` - If sending emails
- [ ] `SMTP_FROM` - If sending emails
- [ ] `CRON_SECRET` - If securing cron jobs

---

## 🔍 How to Find Your Current Values

If you have a local `.env.local` file, you can check it:

```bash
# View (don't share publicly!)
cat .env.local
```

**Important:** Never commit or share your actual secrets!

---

## ✅ After Adding Variables

1. **Redeploy** your app:
   ```bash
   vercel --prod
   ```
   Or use the Vercel Dashboard → Deployments → Redeploy

2. **Test** that everything works

3. **Check logs** if something breaks:
   ```bash
   vercel logs --follow
   ```

---

## 🆘 Need Help?

- Check Vercel build logs for errors
- Verify variable names match exactly (case-sensitive!)
- Make sure you selected the right environment (Production/Preview/Development)
- Ensure values don't have extra spaces or quotes
