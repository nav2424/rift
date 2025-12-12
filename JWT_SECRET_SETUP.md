# JWT Secret Setup

The JWT secret is used to sign and verify authentication tokens for the mobile app.

## Quick Setup

1. **Create a `.env` file** in the root directory (if it doesn't exist)

2. **Add the JWT secret:**
   ```env
   JWT_SECRET=your-secret-key-here
   ```

3. **Generate a secure secret** using one of these methods:

### Method 1: Using Node.js (Recommended)
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Method 2: Using OpenSSL
```bash
openssl rand -hex 64
```

### Method 3: Using Online Generator
Visit: https://generate-secret.vercel.app/64

## Important Notes

⚠️ **Security:**
- Never commit your `.env` file to git (it's already in `.gitignore`)
- Use a different secret for production
- Keep the secret secure - anyone with it can create valid tokens
- The secret should be at least 32 characters long (64+ recommended)

## Current Setup

A secure JWT secret has been generated and added to your `.env` file. The secret is:
- 128 characters long (64 bytes in hex)
- Cryptographically secure random
- Unique to your installation

## Verification

To verify your JWT secret is working:

1. Start your backend: `npm run dev`
2. Try signing in from the mobile app
3. If authentication works, the JWT secret is configured correctly

## Production

For production deployments:

1. Generate a new secret (never reuse development secrets)
2. Set it as an environment variable in your hosting platform:
   - Vercel: Project Settings → Environment Variables
   - Railway: Variables tab
   - Heroku: `heroku config:set JWT_SECRET=your-secret`
   - Docker: `-e JWT_SECRET=your-secret`

## Troubleshooting

**"Invalid token" errors:**
- Check that JWT_SECRET is set in `.env`
- Restart your backend after changing `.env`
- Ensure the secret matches between backend and any other services

**"JWT_SECRET is not defined":**
- Make sure `.env` file exists in the root directory
- Check that the variable name is exactly `JWT_SECRET`
- Restart your development server

