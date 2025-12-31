# Quick Deploy to Vercel

## 🚀 Fastest Way to Deploy

### 1. Push Code to GitHub
```bash
git add .
git commit -m "Ready for deployment"
git push origin main
```

### 2. Deploy via Vercel Dashboard

1. Go to **[vercel.com/new](https://vercel.com/new)**
2. Import your GitHub repository
3. Click **Deploy** (skip configuration for now)
4. After first deployment, configure environment variables (Step 3)

### 3. Set Environment Variables

Go to **Project Settings → Environment Variables** and add:

```env
# Database (MUST SET FIRST)
DATABASE_URL=postgresql://user:pass@host:5432/db?schema=public

# NextAuth (generate new secrets!)
NEXTAUTH_SECRET=<generate-new-secret>
NEXTAUTH_URL=https://your-project.vercel.app

# JWT
JWT_SECRET=<generate-new-secret>

# Stripe (production keys)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Email
SMTP_HOST=smtp.zohocloud.ca
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=support@joinrift.co
SMTP_PASSWORD=your-password
SMTP_FROM="Rift <support@joinrift.co>"

# Optional: Supabase (if using messaging)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Optional: Cron Secret
CRON_SECRET=<generate-new-secret>
```

**Generate secrets:**
```bash
# Run these commands to generate secrets:
node -e "console.log('NEXTAUTH_SECRET:', require('crypto').randomBytes(32).toString('base64'))"
node -e "console.log('JWT_SECRET:', require('crypto').randomBytes(64).toString('hex'))"
node -e "console.log('CRON_SECRET:', require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Set Up Database

**Option A: Vercel Postgres (Easiest)**
1. In Vercel project → **Storage** tab
2. Click **Create Database** → **Postgres**
3. Copy the connection string → Add as `DATABASE_URL`

**Option B: External Database**
- Use Supabase, Neon, Railway, etc.
- Get connection string → Add as `DATABASE_URL`

### 5. Run Migrations

```bash
# Set your DATABASE_URL
export DATABASE_URL="your-production-database-url"

# Run migrations
npx prisma migrate deploy
```

### 6. Redeploy

After setting environment variables:
1. Go to **Deployments** tab
2. Click **Redeploy** on latest deployment
3. Or push a new commit

### 7. Configure Stripe Webhook

1. Go to **Stripe Dashboard** → **Webhooks**
2. Add endpoint: `https://your-project.vercel.app/api/webhooks/stripe`
3. Select events: `account.updated`, `payment_intent.succeeded`
4. Copy signing secret → Add as `STRIPE_WEBHOOK_SECRET` in Vercel
5. Redeploy

---

## ✅ Checklist

- [ ] Code pushed to GitHub
- [ ] Project deployed to Vercel
- [ ] Database created and `DATABASE_URL` set
- [ ] Migrations run (`npx prisma migrate deploy`)
- [ ] All environment variables added
- [ ] Stripe webhook configured
- [ ] Application redeployed
- [ ] Test sign up / sign in
- [ ] Test payment flow

---

## 🔗 Quick Links

- **Full Guide**: See `VERCEL_DEPLOYMENT.md` for detailed instructions
- **Environment Variables**: See `PRODUCTION_CHECKLIST.md`
- **NextAuth Setup**: See `NEXTAUTH_SETUP.md`

---

## ⚠️ Important Notes

1. **Generate NEW secrets** for production (don't reuse development secrets)
2. **Set `NEXTAUTH_URL`** to your actual Vercel domain
3. **Use production Stripe keys** (`sk_live_...` not `sk_test_...`)
4. **Run migrations** after setting up database
5. **Redeploy** after adding environment variables

---

## 🆘 Common Issues

**Build fails?**
- Check that `DATABASE_URL` is set (needed for Prisma generate)
- Verify all required env vars are added

**App crashes?**
- Check deployment logs in Vercel Dashboard
- Verify database connection string is correct
- Ensure all secrets are set

**Webhooks not working?**
- Verify `STRIPE_WEBHOOK_SECRET` matches Stripe Dashboard
- Check webhook URL in Stripe matches your Vercel domain

