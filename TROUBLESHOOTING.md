# Mobile App Troubleshooting Guide

## App Not Loading / Stuck on Loading Screen

### Quick Fixes:

1. **Restart the app:**
   ```bash
   cd mobile
   npm start -- --clear
   ```

2. **Check backend is running:**
   ```bash
   # In root directory
   npm run dev
   ```
   Backend should be running on `http://localhost:3000`

3. **Check API URL:**
   - Open `mobile/app.json`
   - Verify `apiUrl` is correct:
     - iOS Simulator: `http://localhost:3000`
     - Physical device: `http://YOUR_IP:3000` (e.g., `http://192.168.1.100:3000`)

4. **Clear app data:**
   - In Expo Go: Shake device → "Clear cache"
   - Or reinstall the app

## Common Issues

### 1. "Network error" or "Failed to fetch"
- **Cause:** Backend not running or wrong API URL
- **Fix:** 
  - Start backend: `npm run dev`
  - Check API URL in `mobile/app.json`
  - For physical device, use your computer's IP address

### 2. "Unauthorized" errors
- **Cause:** Invalid or expired token
- **Fix:** Sign out and sign in again

### 3. App stuck on loading screen
- **Cause:** Auth check hanging
- **Fix:** 
  - Wait 2-5 seconds (timeout will kick in)
  - Or restart the app with `npm start -- --clear`

### 4. White/black screen
- **Cause:** JavaScript error
- **Fix:**
  - Check console for errors
  - Restart Metro bundler
  - Clear cache: `npm start -- --clear`

## Testing the Connection

1. **Test backend:**
   ```bash
   curl http://localhost:3000/api/auth/me
   # Should return: {"error":"Unauthorized"}
   ```

2. **Test mobile API:**
   - Open `mobile/app/debug.tsx` in the app
   - Tap "Test Connection"
   - Check the status

## Getting Your Computer's IP (for physical device)

**Mac:**
```bash
ipconfig getifaddr en0
```

**Windows:**
```bash
ipconfig
# Look for IPv4 Address
```

**Linux:**
```bash
hostname -I
```

Then update `mobile/app.json`:
```json
{
  "extra": {
    "apiUrl": "http://YOUR_IP:3000"
  }
}
```

## Still Not Working?

1. Check console logs in terminal running Expo
2. Check browser console if testing on web
3. Check React Native Debugger
4. Verify all dependencies are installed: `cd mobile && npm install`

