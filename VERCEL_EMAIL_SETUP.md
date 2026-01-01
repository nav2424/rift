# Vercel Email Configuration Setup Guide

## Quick Setup Steps

### 1. Choose an Email Provider

**Recommended Options:**
- **Zoho Mail** ⭐ (If you're already using it - recommended!)
- **SendGrid** (Best for production, free tier: 100 emails/day)
- **Mailgun** (Good for production, free tier: 5,000 emails/month)
- **Postmark** (Great deliverability, free tier: 100 emails/month)
- **Gmail** (Good for development/testing, requires App Password)

---

## Option 1: Zoho Mail ⭐ (If Already Using It)

### Step 1: Get Your Zoho SMTP Settings

**For Personal/Free Accounts:**
- SMTP Server: `smtp.zoho.com`
- Port: `587` (TLS) or `465` (SSL)

**For Business/Paid Accounts:**
- SMTP Server: `smtppro.zoho.com` or `smtp.zohocloud.ca`
- Port: `587` (TLS) or `465` (SSL)

### Step 2: Get App Password (If 2FA Enabled)

If you have 2-Factor Authentication enabled:
1. Go to https://accounts.zoho.com/u/h#security
2. Scroll to **Application-Specific Passwords**
3. Click **Generate New Password**
4. Name it: `Rift Vercel`
5. Copy the generated password

**If 2FA is NOT enabled:** Use your regular Zoho password

### Step 3: Add to Vercel

Go to your Vercel project → **Settings** → **Environment Variables** and add:

```
SMTP_HOST=smtp.zoho.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@yourdomain.com
SMTP_PASSWORD=your-zoho-password-or-app-password
SMTP_FROM=your-email@yourdomain.com
```

**OR if using Zoho Cloud (business):**
```
SMTP_HOST=smtp.zohocloud.ca
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@yourdomain.com
SMTP_PASSWORD=your-zoho-password-or-app-password
SMTP_FROM=your-email@yourdomain.com
```

**Important:**
- Use the **same settings** you're using in development
- If 2FA is enabled, use App Password (not regular password)
- `SMTP_USER` is your full Zoho email address
- `SMTP_FROM` should match your Zoho email

### Step 4: Verify Settings Match Development

Check your `.env.local` file and make sure the Vercel variables match:
- Same `SMTP_HOST` (smtp.zoho.com or smtp.zohocloud.ca)
- Same `SMTP_PORT` (587 or 465)
- Same `SMTP_SECURE` (false for 587, true for 465)
- Same email address

---

## Option 2: SendGrid (Recommended for Production)

### Step 1: Create SendGrid Account
1. Go to https://sendgrid.com/
2. Sign up for free account (100 emails/day free)
3. Verify your email address

### Step 2: Create API Key
1. Go to **Settings** → **API Keys**
2. Click **Create API Key**
3. Name it: `Rift Production`
4. Select **Full Access** or **Restricted Access** (Mail Send permission)
5. Copy the API key (starts with `SG.`)

### Step 3: Verify Sender Identity
1. Go to **Settings** → **Sender Authentication**
2. Click **Verify a Single Sender** (for testing)
   - OR **Authenticate Your Domain** (for production)
3. Complete verification process

### Step 4: Add to Vercel
Go to your Vercel project → **Settings** → **Environment Variables** and add:

```
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASSWORD=SG.your-actual-api-key-here
SMTP_FROM=your-verified-email@yourdomain.com
```

**Important:** 
- `SMTP_USER` must be exactly `apikey` (not your email)
- `SMTP_PASSWORD` is your SendGrid API key
- `SMTP_FROM` must be a verified sender email

---

## Option 3: Mailgun

### Step 1: Create Mailgun Account
1. Go to https://www.mailgun.com/
2. Sign up (5,000 emails/month free)
3. Verify your email

### Step 2: Get SMTP Credentials
1. Go to **Sending** → **Domain Settings**
2. Click on your domain (or add a new one)
3. Go to **SMTP credentials** tab
4. Copy:
   - **SMTP hostname**: `smtp.mailgun.org`
   - **Port**: `587`
   - **Username**: (shown in dashboard)
   - **Password**: (shown in dashboard)

### Step 3: Add to Vercel
```
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-mailgun-username
SMTP_PASSWORD=your-mailgun-password
SMTP_FROM=noreply@yourdomain.com
```

---

## Option 4: Postmark

### Step 1: Create Postmark Account
1. Go to https://postmarkapp.com/
2. Sign up (100 emails/month free)
3. Verify your email

### Step 2: Create Server
1. Go to **Servers** → **Add Server**
2. Name it: `Rift Production`
3. Copy the **Server API Token**

### Step 3: Verify Sender
1. Go to **Senders** → **Add Sender**
2. Add and verify your email address

### Step 4: Add to Vercel
```
SMTP_HOST=smtp.postmarkapp.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-server-api-token
SMTP_PASSWORD=your-server-api-token
SMTP_FROM=your-verified-email@yourdomain.com
```

**Note:** For Postmark, `SMTP_USER` and `SMTP_PASSWORD` are the same (your Server API Token)

---

## Option 5: Gmail (Development/Testing Only)

### Step 1: Enable 2-Factor Authentication
1. Go to https://myaccount.google.com/security
2. Enable **2-Step Verification**

### Step 2: Generate App Password
1. Go to https://myaccount.google.com/apppasswords
2. Select **Mail** and **Other (Custom name)**
3. Name it: `Rift Vercel`
4. Copy the 16-character password (no spaces)

### Step 3: Add to Vercel
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-16-char-app-password
SMTP_FROM=your-email@gmail.com
```

**⚠️ Warning:** Gmail has strict rate limits. Not recommended for production.

---

## How to Add Variables in Vercel

### Step-by-Step:
1. Go to your Vercel project dashboard
2. Click **Settings** (gear icon)
3. Click **Environment Variables** (left sidebar)
4. Click **Add New**
5. For each variable:
   - **Key**: Enter the variable name (e.g., `SMTP_HOST`)
   - **Value**: Enter the value (e.g., `smtp.sendgrid.net`)
   - **Environment**: Select **Production**, **Preview**, and **Development**
6. Click **Save**
7. Repeat for all 6 SMTP variables

### Required Variables:
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_FROM`

---

## After Adding Variables

### 1. Redeploy Your Application
- Go to **Deployments** tab
- Click the **⋯** menu on latest deployment
- Click **Redeploy**
- OR push a new commit to trigger deployment

### 2. Verify Variables Are Set
- Check Vercel deployment logs
- Look for: `✅ Email sent successfully` (not `⚠️ SMTP not configured`)

---

## Troubleshooting

### Emails Still Not Sending?

#### 1. Check Vercel Logs
- Go to **Deployments** → Click on latest deployment → **Logs**
- Look for email-related errors
- Common errors:
  - `SMTP_USER not set` → Variable not added correctly
  - `Authentication failed` → Wrong password/API key
  - `Connection timeout` → Wrong host/port

#### 2. Verify Variable Names
- Must be **exactly** as shown (case-sensitive):
  - `SMTP_HOST` (not `smtp_host` or `SMTPHost`)
  - `SMTP_PORT` (not `SMTPPort`)
  - etc.

#### 3. Check Variable Values
- **SMTP_SECURE**: Must be `false` (for port 587) or `true` (for port 465)
- **SMTP_PORT**: Usually `587` (TLS) or `465` (SSL)
- **SMTP_FROM**: Must match verified sender email

#### 4. Test Connection
Add this to a test API route to verify:

```typescript
// app/api/test-email/route.ts
import { sendEmail } from '@/lib/email'

export async function GET() {
  const result = await sendEmail(
    'your-test-email@example.com',
    'Test Email',
    '<h1>Test</h1><p>If you receive this, email is working!</p>'
  )
  return Response.json({ sent: result })
}
```

Then visit: `https://yourdomain.com/api/test-email`

#### 5. Common Issues

**Issue: "Authentication failed"**
- **SendGrid**: Make sure `SMTP_USER=apikey` (not your email)
- **Gmail**: Use App Password, not regular password
- **Mailgun/Postmark**: Check username/password are correct

**Issue: "Connection timeout"**
- Check `SMTP_HOST` is correct
- Check `SMTP_PORT` matches provider (usually 587)
- Check firewall/network restrictions

**Issue: "Sender not verified"**
- Verify sender email in provider dashboard
- `SMTP_FROM` must match verified sender

**Issue: "Rate limit exceeded"**
- Gmail: Very strict limits (500/day)
- SendGrid: 100/day on free tier
- Upgrade plan or use different provider

---

## Recommended Setup for Production

**Best Choice: SendGrid**
- ✅ 100 emails/day free
- ✅ Easy setup
- ✅ Good deliverability
- ✅ Reliable API
- ✅ Easy to upgrade

**Alternative: Mailgun**
- ✅ 5,000 emails/month free
- ✅ Good for higher volume
- ✅ Domain authentication

---

## Quick Reference

### Zoho Mail ⭐
```
SMTP_HOST=smtp.zoho.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@yourdomain.com
SMTP_PASSWORD=your-zoho-password-or-app-password
SMTP_FROM=your-email@yourdomain.com
```

**OR for Zoho Cloud (business):**
```
SMTP_HOST=smtp.zohocloud.ca
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@yourdomain.com
SMTP_PASSWORD=your-zoho-password-or-app-password
SMTP_FROM=your-email@yourdomain.com
```

### SendGrid
```
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASSWORD=SG.your-api-key
SMTP_FROM=your-verified-email@domain.com
```

### Mailgun
```
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-username
SMTP_PASSWORD=your-password
SMTP_FROM=noreply@yourdomain.com
```

### Postmark
```
SMTP_HOST=smtp.postmarkapp.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-server-token
SMTP_PASSWORD=your-server-token
SMTP_FROM=your-verified-email@domain.com
```

### Gmail (Dev Only)
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=your-email@gmail.com
```

---

## Next Steps

1. ✅ Choose a provider (SendGrid recommended)
2. ✅ Create account and get credentials
3. ✅ Add all 6 variables to Vercel
4. ✅ Redeploy application
5. ✅ Test with verification email
6. ✅ Check Vercel logs for confirmation

---

**Need Help?** Check Vercel deployment logs for specific error messages.

