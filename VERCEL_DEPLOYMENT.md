# Vercel Deployment Guide

This guide will walk you through deploying your Rift application to Vercel.

## Prerequisites

1. **Vercel Account** - Sign up at [vercel.com](https://vercel.com)
2. **GitHub/GitLab/Bitbucket Repository** - Your code should be in a git repository
3. **PostgreSQL Database** - You'll need a production database (see Database Setup section)
4. **Stripe Account** - For payment processing (if using payments)
5. **Email Service** - SMTP configuration (Zoho Mail, SendGrid, etc.)

---

## Step 1: Prepare Your Repository

Ensure your code is committed and pushed to your git repository:

```bash
git add .
git commit -m "Prepare for Vercel deployment"
git push origin main
```

---

## Step 2: Database Setup

You need a PostgreSQL database for production. Recommended options:

### Option A: Vercel Postgres (Recommended)

1. Go to your Vercel project
2. Navigate to **Storage** tab
3. Click **Create Database** → **Postgres**
4. Choose a region close to your users
5. Copy the `POSTGRES_PRISMA_URL` or `POSTGRES_URL_NON_POOLING` connection string

### Option B: External Database Providers

- **Supabase** (Free tier available)
- **Neon** (Free tier available)
- **Railway** (Free tier available)
- **AWS RDS**
- **Google Cloud SQL**

After setting up, you'll get a connection string like:
```
postgresql://user:password@host:5432/database?schema=public
```

**Run Prisma migrations:**
```bash
# Set DATABASE_URL to your production database
export DATABASE_URL="postgresql://user:password@host:5432/database?schema=public"

# Run migrations
npx prisma migrate deploy
```

---

## Step 3: Deploy to Vercel

### Method 1: Via Vercel Dashboard (Recommended)

1. **Go to [vercel.com/new](https://vercel.com/new)**
2. **Import your Git repository**
   - Connect your GitHub/GitLab/Bitbucket account if needed
   - Select your repository
   - Click **Import**

3. **Configure Project Settings:**
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `./` (default)
   - **Build Command**: `prisma generate && next build` (already in package.json)
   - **Output Directory**: `.next` (default)
   - **Install Command**: `npm install` (default)

4. **Add Environment Variables** (see Step 4 below)

5. **Deploy!**

### Method 2: Via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy (follow prompts)
vercel

# For production deployment
vercel --prod
```

---

## Step 4: Environment Variables

Add all required environment variables in Vercel Dashboard:

### Location: Project Settings → Environment Variables

### Required Variables

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/database?schema=public

# NextAuth
NEXTAUTH_SECRET=your-production-secret-here
NEXTAUTH_URL=https://your-domain.vercel.app

# JWT (for mobile API)
JWT_SECRET=your-production-jwt-secret-here

# Stripe (if using payments)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Email (SMTP)
SMTP_HOST=smtp.zohocloud.ca
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=support@joinrift.co
SMTP_PASSWORD=your-smtp-password
SMTP_FROM="Rift <support@joinrift.co>"

# Supabase (if using messaging)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Cron Secret (for scheduled jobs)
CRON_SECRET=your-cron-secret-here
```

### Generate Secrets

If you need to generate secrets:

```bash
# NEXTAUTH_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# JWT_SECRET
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# CRON_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Important Notes:
- **Select "Production" environment** for all variables
- **Optionally add to Preview/Development** if you want different values for preview deployments
- After adding variables, **redeploy** for them to take effect

---

## Step 5: Run Database Migrations

After deployment, run Prisma migrations on your production database:

```bash
# Option 1: Using Vercel CLI
vercel env pull .env.production
export DATABASE_URL="your-production-database-url"
npx prisma migrate deploy

# Option 2: Using DATABASE_URL directly
DATABASE_URL="your-production-database-url" npx prisma migrate deploy
```

Or use the Vercel Postgres integration which handles this automatically.

---

## Step 6: Configure Stripe Webhooks

1. **Go to Stripe Dashboard** → **Developers** → **Webhooks**
2. **Add endpoint**: `https://your-domain.vercel.app/api/webhooks/stripe`
3. **Select events to listen to:**
   - `account.updated` (for Connect account status)
   - `payment_intent.succeeded`
   - `charge.dispute.created` (if using disputes)
   - Other events as needed
4. **Copy the Signing Secret** (starts with `whsec_`)
5. **Add to Vercel environment variables** as `STRIPE_WEBHOOK_SECRET`
6. **Redeploy** your application

---

## Step 7: Custom Domain (Optional)

1. Go to **Project Settings** → **Domains**
2. Add your custom domain (e.g., `joinrift.co`)
3. Update `NEXTAUTH_URL` environment variable to your custom domain
4. Redeploy

---

## Step 8: Verify Deployment

1. **Check build logs** in Vercel Dashboard
2. **Visit your deployed URL** (e.g., `https://your-project.vercel.app`)
3. **Test key features:**
   - Sign up / Sign in
   - Create a rift transaction
   - Test payment flow (in test mode first)
   - Verify email sending
   - Check webhook delivery

---

## Troubleshooting

### Build Fails

**"Prisma Client not generated"**
- The build command already includes `prisma generate`, but if it fails:
- Check that `DATABASE_URL` is set correctly
- Verify Prisma schema is valid: `npx prisma validate`

**"Environment variables not found"**
- Ensure all required variables are set in Vercel Dashboard
- Redeploy after adding variables
- Check variable names match exactly (case-sensitive)

### Runtime Errors

**"Database connection failed"**
- Verify `DATABASE_URL` is correct
- Check database allows connections from Vercel IPs
- Ensure database is accessible (not behind firewall)

**"NextAuth secret not set"**
- Add `NEXTAUTH_SECRET` to environment variables
- Redeploy application

**"Stripe webhook verification failed"**
- Verify `STRIPE_WEBHOOK_SECRET` matches the one in Stripe Dashboard
- Check webhook URL in Stripe matches your Vercel deployment URL
- Ensure webhook secret starts with `whsec_`

### Database Migration Issues

**"Migration failed"**
- Run migrations manually: `npx prisma migrate deploy`
- Check database connection string
- Verify database user has migration permissions

---

## Environment-Specific Configuration

### Production Environment
- Use production database
- Use live Stripe keys (`sk_live_...`)
- Use production domain in `NEXTAUTH_URL`
- Enable all security features

### Preview Environment (Optional)
- Can use separate database for testing
- Use Stripe test keys
- Use preview domain in `NEXTAUTH_URL`

---

## Post-Deployment Checklist

- [ ] Database migrations run successfully
- [ ] Environment variables configured
- [ ] Stripe webhooks configured and tested
- [ ] Custom domain configured (if applicable)
- [ ] Test sign up / sign in flow
- [ ] Test payment processing
- [ ] Verify email sending works
- [ ] Check error tracking (if using Sentry/logging)
- [ ] Monitor first few deployments for errors
- [ ] Set up monitoring/alerting

---

## Automated Deployments

Vercel automatically deploys on:
- **Push to main branch** → Production deployment
- **Pull requests** → Preview deployment
- **Manual deployment** → Via Vercel Dashboard

To disable automatic deployments, go to **Settings** → **Git** and configure deployment preferences.

---

## Monitoring & Analytics

Vercel provides built-in:
- **Analytics** - Already included (`@vercel/analytics`)
- **Speed Insights** - Already included (`@vercel/speed-insights`)
- **Function Logs** - View in Vercel Dashboard
- **Deployment Logs** - View build and runtime logs

For additional monitoring:
- Set up **Sentry** for error tracking
- Use **Vercel Analytics** for performance monitoring
- Monitor **Stripe Dashboard** for payment/webhook issues

---

## Quick Reference

**Vercel Dashboard:** https://vercel.com/dashboard

**Project Settings:** https://vercel.com/[username]/[project]/settings

**Environment Variables:** Settings → Environment Variables

**Deployments:** Deployments tab in project dashboard

**Logs:** Click on any deployment → View logs

---

## Need Help?

- **Vercel Docs:** https://vercel.com/docs
- **Next.js Deployment:** https://nextjs.org/docs/deployment
- **Prisma Deployment:** https://www.prisma.io/docs/guides/deployment
- **Check your build logs** in Vercel Dashboard for specific errors
