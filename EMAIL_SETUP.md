# Email Configuration Setup

Email verification codes require SMTP configuration to be sent. Currently, emails are not being sent because SMTP settings are not configured.

## Quick Fix

Add the following environment variables to your `.env` or `.env.local` file:

```bash
# SMTP Configuration (for sending emails)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=your-email@gmail.com

# Or for other email providers:
# SMTP_HOST=smtp.mailgun.org
# SMTP_HOST=smtp.sendgrid.net
# SMTP_HOST=smtp.postmarkapp.com
```

## Gmail Setup (Recommended for Development)

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate an App Password**:
   - Go to https://myaccount.google.com/apppasswords
   - Select "Mail" and "Other (Custom name)"
   - Name it "Rift Development"
   - Copy the 16-character password
3. **Add to `.env.local`**:
   ```bash
   SMTP_USER=your-email@gmail.com
   SMTP_PASSWORD=xxxx xxxx xxxx xxxx  # The 16-char app password (no spaces)
   SMTP_FROM=your-email@gmail.com
   ```

## Other Email Providers

### SendGrid
```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=your-sendgrid-api-key
SMTP_FROM=your-verified-sender@domain.com
```

### Mailgun
```bash
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=your-mailgun-username
SMTP_PASSWORD=your-mailgun-password
SMTP_FROM=noreply@your-domain.com
```

### Postmark
```bash
SMTP_HOST=smtp.postmarkapp.com
SMTP_PORT=587
SMTP_USER=your-postmark-server-token
SMTP_PASSWORD=your-postmark-server-token
SMTP_FROM=noreply@your-domain.com
```

## Development Mode

Currently, in development mode, verification codes are:
- ✅ Still generated and stored
- ✅ Returned in the API response (for testing)
- ❌ Not actually sent via email (if SMTP not configured)

The API will return:
```json
{
  "success": true,
  "message": "Verification code generated (SMTP not configured - check console)",
  "code": "123456"
}
```

You can use the returned code to verify manually during development.

## Production Mode

In production, if SMTP is not configured:
- ❌ API will return an error
- ❌ Verification codes will not be returned in the response

Make sure to configure SMTP before deploying to production.

## Testing Email Configuration

After adding SMTP configuration, restart your dev server and test:

1. Request a verification code via `/api/verify/email/send`
2. Check your email inbox
3. Check server logs for email send status:
   - ✅ `Email sent successfully` = working
   - ❌ `Email send error` = check SMTP settings
   - ⚠️ `SMTP not configured` = environment variables not loaded

## Troubleshooting

### Emails still not sending after configuration:

1. **Restart your dev server** - Environment variables are loaded at startup
2. **Check environment variable names** - Must be exactly `SMTP_USER`, `SMTP_PASSWORD`, etc.
3. **Verify credentials** - Test with a simple email client first
4. **Check firewall/network** - Some networks block SMTP ports
5. **Check server logs** - Look for error messages in console

### Common Errors:

- **"Invalid login"** - Wrong username/password or app password not set up correctly
- **"Connection timeout"** - Check SMTP_HOST and SMTP_PORT
- **"Authentication failed"** - For Gmail, make sure you're using an App Password, not your regular password

## Next Steps

1. Add SMTP configuration to `.env.local`
2. Restart dev server: `npm run dev`
3. Test email verification endpoint
4. Verify emails are being received
