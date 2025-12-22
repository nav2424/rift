# Email Setup Guide (SMTP Configuration)

## 📍 Why Email Verification Might Not Work

If email verification isn't working, it's likely because SMTP (email sending) is not configured. The system needs SMTP credentials to send verification codes.

## 🔧 Quick Setup Options

### Option 1: Gmail (Easiest for Development)

1. **Enable App Passwords in Gmail:**
   - Go to your Google Account settings
   - Security → 2-Step Verification (enable if not already)
   - App Passwords → Generate a new app password
   - Copy the 16-character password

2. **Add to `.env.local`:**
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your-email@gmail.com
   SMTP_PASSWORD=your-16-char-app-password
   SMTP_FROM=your-email@gmail.com
   ```

### Option 2: SendGrid (Recommended for Production)

1. **Sign up at [SendGrid](https://sendgrid.com/)**
2. **Create an API Key:**
   - Settings → API Keys → Create API Key
   - Copy the API key

3. **Add to `.env.local`:**
   ```env
   SMTP_HOST=smtp.sendgrid.net
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=apikey
   SMTP_PASSWORD=your-sendgrid-api-key
   SMTP_FROM=noreply@yourdomain.com
   ```

### Option 3: AWS SES

1. **Set up AWS SES**
2. **Get SMTP credentials from AWS Console**
3. **Add to `.env.local`:**
   ```env
   SMTP_HOST=email-smtp.us-east-1.amazonaws.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your-ses-smtp-username
   SMTP_PASSWORD=your-ses-smtp-password
   SMTP_FROM=noreply@yourdomain.com
   ```

### Option 4: Other SMTP Providers

Any SMTP provider will work. Just configure:
- `SMTP_HOST` - Your SMTP server hostname
- `SMTP_PORT` - Usually 587 (TLS) or 465 (SSL)
- `SMTP_SECURE` - `true` for SSL (port 465), `false` for TLS (port 587)
- `SMTP_USER` - Your SMTP username
- `SMTP_PASSWORD` - Your SMTP password
- `SMTP_FROM` - The "from" email address

## ✅ After Adding SMTP Configuration

1. **Restart your dev server:**
   ```bash
   # Stop current server (Ctrl+C)
   npm run dev
   ```

2. **Test email verification:**
   - Go to `/settings/verification`
   - Click "Send Code" for email verification
   - Check your email inbox

## 🧪 Development Mode Behavior

**Without SMTP configured:**
- Email verification codes are logged to console
- The code is still returned in the API response (for testing)
- You can manually copy the code from the console/logs

**With SMTP configured:**
- Emails are actually sent
- Codes are not returned in API response (security)
- Check your email inbox for the code

## 🚨 Troubleshooting

**"Failed to send verification email" error:**
- Check that all SMTP variables are set in `.env.local`
- Verify SMTP credentials are correct
- Check server console for detailed error messages
- For Gmail: Make sure you're using an App Password, not your regular password
- For SendGrid: Make sure your account is verified

**Email sent but not received:**
- Check spam/junk folder
- Verify the email address is correct
- Check SMTP provider's sending logs
- Some providers have sending limits (check your plan)

**"SMTP not configured" warning:**
- This is normal in development without SMTP
- Codes will still be generated and shown in console
- Configure SMTP to actually send emails

## 🔒 Security Notes

- ✅ **Never commit `.env.local` to git** (it's already in `.gitignore`)
- ✅ Use App Passwords for Gmail (not your main password)
- ✅ For production, use a dedicated email service (SendGrid, AWS SES, etc.)
- ✅ The `SMTP_PASSWORD` should be kept secret

## 📧 Email Templates

The system sends HTML emails for:
- Email verification codes
- Rift notifications
- Payment confirmations
- Proof submissions
- Dispute notifications

All emails use the same SMTP configuration.
