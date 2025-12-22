# Vercel Deployment Guide

## Quick Deploy

If you're already logged in to Vercel:

```bash
vercel --prod
```

## First Time Setup

1. **Login to Vercel:**
   ```bash
   vercel login
   ```

2. **Link your project:**
   ```bash
   vercel link
   ```
   - Choose or create a project
   - Use default settings or customize

3. **Deploy:**
   ```bash
   vercel --prod
   ```

## Environment Variables Setup

⚠️ **IMPORTANT:** Set these in Vercel Dashboard before deploying:

### Required Environment Variables

Go to: **Vercel Dashboard → Your Project → Settings → Environment Variables**

#### Database
```env
DATABASE_URL=postgresql://user:password@host:5432/database
```

#### Authentication
```env
NEXTAUTH_SECRET=your-secret-key-here
NEXTAUTH_URL=https://your-app.vercel.app
JWT_SECRET=your-jwt-secret-here
```

#### Stripe (if using payments)
```env
STRIPE_SECRET_KEY=sk_live_... (or sk_test_... for testing)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_... (or pk_test_... for testing)
```

#### Supabase (if using messaging)
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

#### Email (if using email notifications)
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=noreply@yourdomain.com
```

### How to Set Environment Variables

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add each variable:
   - **Key:** Variable name (e.g., `DATABASE_URL`)
   - **Value:** Your value
   - **Environment:** Select `Production`, `Preview`, and/or `Development`
5. Click **Save**

**Important:** After adding environment variables, you need to redeploy for them to take effect.

## Build Configuration

Your project is already configured with:
- ✅ Build command: `prisma generate && next build`
- ✅ Output directory: `.next` (default)
- ✅ Install command: `npm install`
- ✅ Cron job configured for auto-release

## Deployment Commands

### Production Deploy
```bash
vercel --prod
```

### Preview Deploy (for testing)
```bash
vercel
```

### Deploy with specific environment
```bash
vercel --prod --env DATABASE_URL=your-db-url
```

## Post-Deployment Checklist

After deploying:

- [ ] Test the site at your Vercel URL
- [ ] Verify environment variables are set correctly
- [ ] Test authentication
- [ ] Test database connections
- [ ] Verify cron jobs are working (check Vercel Dashboard → Cron Jobs)
- [ ] Test mobile responsiveness
- [ ] Check browser console for errors

## Troubleshooting

### Build Fails: "Prisma Client not generated"

**Solution:** The build command includes `prisma generate`, but if it still fails:

1. Make sure `DATABASE_URL` is set correctly
2. Check Vercel build logs for Prisma errors
3. Ensure Prisma schema is valid: `npx prisma validate`

### Build Fails: "Environment variable not found"

**Solution:** 
1. Go to Vercel Dashboard → Settings → Environment Variables
2. Verify all required variables are set
3. Make sure you selected the correct environment (Production/Preview)
4. Redeploy after adding variables

### Database Connection Issues

**Solution:**
1. Verify `DATABASE_URL` is correct
2. Check if your database allows connections from Vercel IPs
3. Some databases (like Supabase) need to whitelist Vercel IPs

### Cron Jobs Not Working

**Solution:**
1. Verify cron configuration in `vercel.json`
2. Check Vercel Dashboard → Cron Jobs
3. Ensure the endpoint is accessible (returns 200 status)
4. Check function logs for errors

## Updating Your Deployment

To update your site after making changes:

1. **Commit your changes:**
   ```bash
   git add .
   git commit -m "Your update message"
   git push
   ```

2. **Auto-deploy (if connected to Git):**
   - Vercel automatically deploys on push to main branch

3. **Manual deploy:**
   ```bash
   vercel --prod
   ```

## Domain Setup

To use a custom domain:

1. Go to Vercel Dashboard → Settings → Domains
2. Add your domain
3. Follow DNS configuration instructions
4. Update `NEXTAUTH_URL` to your custom domain

## Performance Tips

- ✅ Images are automatically optimized with Next.js Image component
- ✅ Static assets are cached on Vercel Edge Network
- ✅ API routes are serverless functions
- ✅ Database connection pooling is recommended for production

## Support

- Vercel Docs: https://vercel.com/docs
- Next.js Deployment: https://nextjs.org/docs/deployment
- Vercel Status: https://www.vercel-status.com/
