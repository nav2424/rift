# Next Steps Checklist

## 🧪 1. Test the Complete Flow (Priority: HIGH)

### Test Signup Flow
- [ ] Create a new test account via signup page
- [ ] Verify you receive email verification code (or check console for dev code)
- [ ] Verify you receive SMS verification code (or check console for dev code)
- [ ] Complete password setup with requirements (8+ chars, uppercase, lowercase, number, special char)
- [ ] Confirm auto sign-in and redirect to dashboard works

### Test Complete Rift Flow
- [ ] Sign in as buyer
- [ ] Create a rift (any item type)
- [ ] Pay for the rift (use Stripe test card: `4242 4242 4242 4242`)
- [ ] Sign in as seller
- [ ] Upload proof of shipment/delivery
- [ ] Sign in as buyer
- [ ] Confirm receipt
- [ ] Release funds (or wait for auto-release)
- [ ] Sign in as seller
- [ ] Verify wallet balance updated
- [ ] Test withdrawal (requires Stripe Connect setup)

## ⚙️ 2. Verify Configuration (Priority: HIGH)

### Environment Variables
Check your `.env.local` file has:
- [ ] `DATABASE_URL` - PostgreSQL connection string
- [ ] `NEXTAUTH_SECRET` - Random secret for NextAuth
- [ ] `NEXTAUTH_URL` - Your app URL (e.g., `http://localhost:3000`)
- [ ] `JWT_SECRET` - Random secret for JWT tokens
- [ ] `STRIPE_SECRET_KEY` - Stripe secret key (test or live)
- [ ] `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` - Email configuration
- [ ] `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` - SMS configuration

### Stripe Setup
- [ ] Stripe account created
- [ ] Stripe API keys obtained (test mode keys for development)
- [ ] Stripe webhook endpoint configured (for production)
- [ ] Stripe Connect enabled (for seller payouts)
- [ ] Test webhook locally using Stripe CLI (optional but recommended)

### Database
- [ ] Database migrations applied: `npx prisma migrate dev` (if needed)
- [ ] Prisma client generated: `npx prisma generate`
- [ ] Test database connection works

## 🔍 3. Test Critical Paths (Priority: MEDIUM)

- [ ] Test with unverified email → should block sign-in
- [ ] Test with unverified phone → should block sign-in
- [ ] Test password requirements → should reject weak passwords
- [ ] Test duplicate email signup → should show error
- [ ] Test duplicate phone signup → should show error
- [ ] Test incomplete signup abandonment → email/phone should be reusable

## 🐛 4. Fix Any Issues Found (Priority: HIGH)

If you find issues during testing:
1. Note the exact steps to reproduce
2. Check browser console for errors
3. Check server logs for errors
4. Test with different user accounts/roles

## 🚀 5. Production Preparation (Priority: MEDIUM - When Ready)

### Before Production Deployment
- [ ] Switch to production Stripe keys
- [ ] Configure production SMTP (not Gmail personal)
- [ ] Configure production Twilio account
- [ ] Set up Stripe webhook endpoint in production
- [ ] Update `NEXTAUTH_URL` to production URL
- [ ] Review and set all production environment variables in Vercel
- [ ] Test production database connection
- [ ] Review security settings (rate limiting, etc.)

### Deployment
- [ ] Deploy to Vercel: `vercel --prod`
- [ ] Verify environment variables are set in Vercel dashboard
- [ ] Test production signup flow
- [ ] Test production payment flow (with test cards)
- [ ] Monitor logs for errors

## 📝 6. Documentation (Priority: LOW)

- [ ] Review `END_TO_END_FLOW_STATUS.md` for complete flow details
- [ ] Document any custom configurations you made
- [ ] Note any environment-specific settings

## 🎯 Recommended Order

1. **Start with testing** - Run through the complete signup and rift flow
2. **Fix any issues** - Address problems found during testing
3. **Verify configuration** - Ensure all environment variables are set
4. **Test critical paths** - Verify edge cases and error handling
5. **Production prep** - When ready, prepare for deployment

---

## Quick Start Testing Command

To quickly test the flow:

```bash
# Make sure dev server is running
npm run dev

# Then test in browser:
# 1. Go to http://localhost:3000/auth/signup
# 2. Complete signup flow
# 3. Create a rift
# 4. Test payment with Stripe test card: 4242 4242 4242 4242
```

## Need Help?

- Check `END_TO_END_FLOW_STATUS.md` for detailed flow information
- Review error logs in terminal and browser console
- Check environment variables are properly loaded

