# NextAuth Configuration Guide

## NEXTAUTH_SECRET

**What it is:** A random secret string used to encrypt and sign JWT tokens for NextAuth.js sessions.

**How to generate it:**

### Method 1: Using Node.js (Recommended)
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Method 2: Using OpenSSL
```bash
openssl rand -base64 32
```

### Method 3: Online Generator
Visit: https://generate-secret.vercel.app/32

**Example output:**
```
aB3dE5fG7hI9jK1lM3nO5pQ7rS9tU1vW3xY5zA7bC9dE1fG3hI5jK7lM9nO1p
```

**Important:**
- Must be at least 32 characters long
- Should be unique and random
- **Never commit to git** (should be in `.gitignore`)
- Use a different secret for production than development

---

## NEXTAUTH_URL

**What it is:** The public URL of your application (where it's accessible).

### For Development (Local)
```
NEXTAUTH_URL=http://localhost:3000
```

### For Production
```
NEXTAUTH_URL=https://yourdomain.com
```

**Examples:**
- `https://rift.app`
- `https://www.joinrift.co`
- `https://app.joinrift.co`

**Important:**
- Must include the protocol (`http://` or `https://`)
- Must NOT include a trailing slash (`/`)
- For production, always use `https://`
- This is used for callback URLs and email links

---

## Setup Instructions

### 1. Add to `.env.local` (Development)

Create or edit `.env.local` in your project root:

```env
# NextAuth Configuration
NEXTAUTH_SECRET=your-generated-secret-here
NEXTAUTH_URL=http://localhost:3000
```

### 2. Add to Production Environment

When deploying to production (Vercel, Railway, Heroku, etc.):

1. **Generate a NEW secret** for production (never reuse development secret)
2. **Add both variables** in your hosting platform's environment variables:
   - `NEXTAUTH_SECRET` = your production secret
   - `NEXTAUTH_URL` = your production domain (e.g., `https://rift.app`)

#### Vercel
1. Go to Project Settings → Environment Variables
2. Add `NEXTAUTH_SECRET` and `NEXTAUTH_URL`
3. Select "Production" environment
4. Deploy again

#### Railway
1. Go to your project → Variables tab
2. Add `NEXTAUTH_SECRET` and `NEXTAUTH_URL`
3. Redeploy

#### Heroku
```bash
heroku config:set NEXTAUTH_SECRET=your-secret
heroku config:set NEXTAUTH_URL=https://yourdomain.com
```

---

## Quick Setup Script

Run this in your terminal to generate a secret and add it to `.env.local`:

```bash
# Generate secret
SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")

# Add to .env.local (development)
echo "NEXTAUTH_SECRET=$SECRET" >> .env.local
echo "NEXTAUTH_URL=http://localhost:3000" >> .env.local

# Print the secret (save this for production!)
echo "✅ NEXTAUTH_SECRET generated: $SECRET"
echo "⚠️  Save this secret for production use!"
```

---

## Verification

After setting up, verify it's working:

1. **Start your dev server:**
   ```bash
   npm run dev
   ```

2. **Try signing in** at `http://localhost:3000/auth/signin`

3. **Check for errors** in the console - if you see "NEXTAUTH_SECRET is not set" warnings, restart your server

---

## Security Notes

⚠️ **CRITICAL:**
- **Never commit secrets to git** - they should be in `.gitignore`
- **Use different secrets** for development and production
- **Keep secrets secure** - anyone with the secret can create valid sessions
- **Regenerate if compromised** - if exposed, generate a new one immediately

---

## Troubleshooting

**"NEXTAUTH_SECRET is not set" warning:**
- Verify `.env.local` exists in project root
- Check variable name is exactly `NEXTAUTH_SECRET` (case-sensitive)
- Restart your dev server after adding/changing env variables

**Session not persisting:**
- Verify `NEXTAUTH_URL` matches your actual domain
- Check that cookies are being set in browser
- Ensure `NEXTAUTH_SECRET` is set and valid

**Production deployment issues:**
- Verify environment variables are set in hosting platform
- Check that `NEXTAUTH_URL` uses `https://` (not `http://`)
- Ensure `NEXTAUTH_URL` matches your production domain exactly
- Redeploy after adding environment variables

---

## Current Usage in Code

These variables are used in:
- `lib/auth.ts` - NextAuth configuration
- `lib/stripe.ts` - Stripe Connect callback URLs
- `lib/email.ts` - Email notification links

All of these automatically use `NEXTAUTH_URL` for generating callback URLs and links in emails.

