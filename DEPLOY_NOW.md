# 🚀 Deploy Changes to Production - Quick Guide

## Option 1: Automatic Deployment via Git (Recommended)

If your Vercel project is connected to GitHub, simply push your changes:

```bash
# Stage all changes
git add .

# Commit with descriptive message
git commit -m "Fix mobile UI: menu positioning, AI assistant centering, proof upload infinite loading, date picker fixes"

# Push to trigger automatic deployment
git push origin main
```

**Vercel will automatically:**
- Detect the push
- Build your application
- Deploy to production
- Provide you with a deployment URL

Check deployment status at: https://vercel.com/dashboard

---

## Option 2: Manual Deployment via Vercel CLI

If you prefer manual control or want to deploy without pushing:

```bash
# Install Vercel CLI (if not installed)
npm i -g vercel

# Login to Vercel
vercel login

# Deploy to production
vercel --prod
```

---

## Option 3: Deploy via Vercel Dashboard

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Select your Rift project
3. Click **Deployments** tab
4. Click **Redeploy** on the latest deployment
5. Or click **Deploy** button to trigger a new deployment from your latest commit

---

## Changes Being Deployed

✅ Mobile menu opens from right side (not left)
✅ Year picker in date selector fixed (no longer cut off)
✅ AI assistant opens centered on mobile with backdrop
✅ Proof upload infinite loading fixed (removed blocking AI classification)
✅ Button overlap issues resolved
✅ Mobile layout optimizations

---

## After Deployment

1. **Test the changes:**
   - Open your production URL on mobile
   - Test the menu (should slide from right)
   - Test AI assistant (should open centered)
   - Test proof upload (should not show infinite loading)
   - Test date pickers (year selector should be visible)

2. **Monitor for issues:**
   - Check Vercel deployment logs
   - Monitor error tracking (if set up)
   - Test key user flows

---

## Troubleshooting

**Build fails?**
- Check build logs in Vercel Dashboard
- Ensure all environment variables are set
- Verify Prisma schema is valid

**Changes not showing?**
- Clear browser cache
- Check deployment completed successfully
- Verify you're looking at the correct URL

**Need to rollback?**
- Go to Vercel Dashboard → Deployments
- Find the previous working deployment
- Click "..." → "Promote to Production"

