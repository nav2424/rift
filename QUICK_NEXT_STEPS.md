# Quick Next Steps - You're Almost Done!

## ✅ What's Already Done
- ✅ Vercel Postgres database created
- ✅ Environment variables automatically added by Vercel:
  - `DATABASE_URL`
  - `PRISMA_DATABASE_URL` (use this one - it has connection pooling)
  - `POSTGRES_URL`

## 🔧 What You Need to Do Now

### Step 1: Pull Environment Variables Locally

Open your terminal and run:

```bash
cd /Users/arnavsaluja/Rift

# Install Vercel CLI if you haven't already
npm install -g vercel

# Login to Vercel (if not already logged in)
vercel login

# Link your project (if not already linked)
vercel link

# Pull production environment variables
vercel env pull .env.production
```

This downloads your production environment variables (including `PRISMA_DATABASE_URL`) to a local file.

### Step 2: Run Database Migrations

This creates all your database tables:

```bash
npx prisma migrate deploy
```

You should see output like:
```
Applying migration `20241211_xxxxx_init_postgres`
✔ Applied migration
```

### Step 3: Commit and Push Code Changes

```bash
# Check what changed
git status

# Stage the changes
git add prisma/schema.prisma lib/prisma.ts README.md DATABASE_MIGRATION.md PRODUCTION_FIX_STEPS.md

# Commit
git commit -m "Migrate from SQLite to PostgreSQL for production"

# Push (Vercel will auto-deploy)
git push
```

### Step 4: Wait for Deployment & Test

1. Go to your Vercel dashboard → **Deployments** tab
2. Wait for the new deployment to finish (usually 1-2 minutes)
3. Test your site: https://www.joinrift.co/api/auth/custom-signup
4. Try creating a test account - the error should be gone! 🎉

---

## Troubleshooting

**If migrations fail:**
- Make sure you ran `vercel env pull .env.production` first
- Check that `PRISMA_DATABASE_URL` is in your `.env.production` file
- Try using `DATABASE_URL` instead if `PRISMA_DATABASE_URL` doesn't work

**If you get "relation does not exist":**
- Make sure migrations ran: `npx prisma migrate deploy`
- Check the output for any errors

**If the error persists:**
- Make sure Vercel finished deploying
- Check Vercel's deployment logs for errors
- Verify `PRISMA_DATABASE_URL` is set in Vercel's environment variables

