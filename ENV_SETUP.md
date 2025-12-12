# Environment Variables Setup Guide

This guide shows you exactly where to add your Supabase environment variables for the messaging system.

## For Web App (Next.js)

### Location: `.env.local` (in project root)

Create a file named `.env.local` in the root directory of your project (same level as `package.json`).

**File path:** `/Users/arnavsaluja/trusthold/.env.local`

**Contents:**
```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

**How to get these values:**
1. Go to your Supabase Dashboard
2. Navigate to **Settings** → **API**
3. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ Keep this secret!)

**Important Notes:**
- The `.env.local` file is automatically ignored by git (should be in `.gitignore`)
- Restart your Next.js dev server after adding/changing env variables
- Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser
- Variables without `NEXT_PUBLIC_` are server-only

## For Mobile App (Expo)

### Location: `mobile/app.json`

Update the `extra` field in `mobile/app.json`:

**File path:** `/Users/arnavsaluja/trusthold/mobile/app.json`

**Current structure:**
```json
{
  "expo": {
    "extra": {
      "apiUrl": "http://localhost:3000",
      "supabaseUrl": "https://your-project.supabase.co",
      "supabaseAnonKey": "your-anon-key-here"
    }
  }
}
```

**How to get these values:**
1. Same as above - use your Supabase Dashboard
2. Use the same values as your web app (anon key is safe to use in mobile)

**Important Notes:**
- After updating `app.json`, restart your Expo dev server
- For production builds, these values are bundled into the app
- You can also use environment variables with `EXPO_PUBLIC_` prefix, but `app.json` is simpler for Expo

## Alternative: Using Environment Variables for Mobile

If you prefer using environment variables instead of `app.json`:

1. Create `mobile/.env`:
```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

2. Install `expo-constants` (already installed) and use:
```typescript
import Constants from 'expo-constants'
const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl
```

The current setup uses `app.json` which is already configured.

## Quick Setup Checklist

- [ ] Create `.env.local` in project root with Supabase credentials
- [ ] Update `mobile/app.json` with Supabase credentials in `extra` field
- [ ] Restart Next.js dev server (`npm run dev`)
- [ ] Restart Expo dev server (`cd mobile && npm start`)
- [ ] Verify Supabase Realtime is enabled in Supabase Dashboard

## Security Notes

⚠️ **Never commit these files to git:**
- `.env.local` (should be in `.gitignore`)
- `SUPABASE_SERVICE_ROLE_KEY` should never be exposed to the client

✅ **Safe to commit:**
- `.env.local.example` (template file)
- `app.json` with anon key (it's public anyway)

## Testing Your Setup

After adding the environment variables:

1. **Web:** Check browser console for any Supabase connection errors
2. **Mobile:** Check Expo logs for any Supabase connection errors
3. **Both:** Try sending a message and verify realtime updates work

## Troubleshooting

**"Supabase configuration missing" error:**
- Verify `.env.local` exists in project root
- Check variable names match exactly (case-sensitive)
- Restart your dev server

**Mobile app can't connect:**
- Verify `app.json` has correct values in `extra` field
- Check that values don't have extra quotes or spaces
- Restart Expo dev server

**Realtime not working:**
- Verify Realtime is enabled in Supabase Dashboard (Database → Replication)
- Check that tables are added to the `supabase_realtime` publication
- Verify you're using the correct project URL and keys

