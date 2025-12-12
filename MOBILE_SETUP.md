# Mobile App Setup Guide

This guide will help you set up and launch the TrustHold iOS mobile app alongside your web platform.

## Quick Start

### 1. Install Mobile Dependencies

```bash
cd mobile
npm install
```

### 2. Configure Backend for Mobile

The backend now supports both web (session-based) and mobile (JWT-based) authentication. The mobile auth endpoints are already set up:

- `/api/auth/mobile-signin` - Mobile sign in
- `/api/auth/mobile-signup` - Mobile sign up

### 3. Set API URL

Update `mobile/app.json` with your backend URL:

```json
{
  "extra": {
    "apiUrl": "http://localhost:3000"  // For simulator
    // or "http://YOUR_IP:3000" for physical device
  }
}
```

### 4. Start Development

```bash
# Terminal 1: Start backend
npm run dev

# Terminal 2: Start mobile app
cd mobile
npm start
```

Then press `i` to open in iOS Simulator, or scan QR code with Expo Go app.

## Building for App Store

### Prerequisites

1. Apple Developer Account ($99/year)
2. EAS CLI: `npm install -g eas-cli`
3. Expo account (free)

### Build Steps

1. **Login to Expo:**
   ```bash
   eas login
   ```

2. **Configure build:**
   ```bash
   cd mobile
   eas build:configure
   ```

3. **Build for iOS:**
   ```bash
   eas build --platform ios
   ```

4. **Submit to App Store:**
   ```bash
   eas submit --platform ios
   ```

## Environment Variables

Add to your `.env` file:

```env
JWT_SECRET=your-secret-key-here-change-in-production
```

**Important:** Use a strong, random secret in production!

## Features

✅ Full feature parity with web app:
- Authentication
- Dashboard with escrow list
- Create escrow (all item types)
- View escrow details
- Mark payments
- Upload shipment proof
- Confirm receipt
- Release funds
- Raise disputes
- Cancel escrows

## Architecture

- **Frontend:** React Native with Expo
- **Navigation:** Expo Router (file-based)
- **State:** React Context (Auth)
- **Storage:** Expo SecureStore (tokens)
- **API:** REST API with JWT authentication
- **Backend:** Next.js API routes (shared with web)

## Testing

1. **Development:** Use Expo Go app on your iPhone
2. **Staging:** Build with EAS and install via TestFlight
3. **Production:** Submit to App Store

## Troubleshooting

### "Unauthorized" errors
- Check JWT_SECRET is set in backend
- Verify API URL in mobile/app.json
- Ensure backend is running

### Connection issues on physical device
- Use your computer's local IP instead of localhost
- Ensure device and computer are on same WiFi network
- Check firewall settings

### Build failures
- Clear cache: `expo start -c`
- Update Expo: `npm install -g expo-cli@latest`
- Check EAS status: `eas build:list`

## Next Steps

1. Add app icons and splash screens to `mobile/assets/`
2. Configure app store metadata
3. Set up push notifications (optional)
4. Add analytics (optional)

## Support

For issues or questions, check:
- Expo docs: https://docs.expo.dev
- React Native docs: https://reactnative.dev
- Project README.md

