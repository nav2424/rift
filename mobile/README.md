# TrustHold Mobile App

iOS mobile application for TrustHold rift platform built with React Native and Expo.

## Features

- 🔐 Authentication (Sign In / Sign Up)
- 📊 Dashboard with rift list
- 📝 Create rift transactions (Physical, Tickets, Digital, Services)
- 📱 View rift details
- ✅ Mark payments, confirm receipt, release funds
- 📦 Upload shipment proof
- ⚠️ Raise disputes
- 🔄 Real-time status updates

## Prerequisites

- Node.js 18+ installed
- iOS Simulator (via Xcode) or physical iOS device
- Expo CLI: `npm install -g expo-cli`

## Setup

1. **Install dependencies:**
   ```bash
   cd mobile
   npm install
   ```

2. **Configure API URL:**
   
   Update `app.json` to point to your backend:
   ```json
   {
     "extra": {
       "apiUrl": "http://your-backend-url:3000"
     }
   }
   ```
   
   For iOS Simulator, use `http://localhost:3000`
   For physical device, use your computer's local IP (e.g., `http://192.168.1.100:3000`)

3. **Start the development server:**
   ```bash
   npm start
   ```

4. **Run on iOS:**
   - Press `i` in the terminal, or
   - Scan QR code with Expo Go app on your iPhone, or
   - Open in iOS Simulator

## Building for Production

### iOS Build

1. **Install EAS CLI:**
   ```bash
   npm install -g eas-cli
   ```

2. **Login to Expo:**
   ```bash
   eas login
   ```

3. **Configure build:**
   ```bash
   eas build:configure
   ```

4. **Build for iOS:**
   ```bash
   eas build --platform ios
   ```

5. **Submit to App Store:**
   ```bash
   eas submit --platform ios
   ```

## Project Structure

```
mobile/
├── app/                    # Expo Router pages
│   ├── (auth)/            # Authentication screens
│   ├── (tabs)/            # Tab navigation screens
│   └── escrows/           # Rift detail screens
├── components/            # Reusable components
├── lib/                   # Utilities and API client
│   ├── api.ts            # API client
│   └── auth.tsx           # Authentication context
└── assets/               # Images and fonts
```

## API Integration

The mobile app connects to the Next.js backend API. Make sure:

1. Backend is running on the configured URL
2. JWT authentication is enabled (see backend `lib/jwt-middleware.ts`)
3. Mobile auth endpoints are available:
   - `/api/auth/mobile-signin`
   - `/api/auth/mobile-signup`

## Development Notes

- Uses Expo Router for file-based routing
- Secure storage for authentication tokens
- Image picker for shipment proof uploads
- Pull-to-refresh on dashboard and rift details
- Dark theme matching web app design

## Troubleshooting

**Connection Issues:**
- Ensure backend is running
- Check API URL in `app.json`
- For physical device, ensure device and computer are on same network

**Build Issues:**
- Clear cache: `expo start -c`
- Reinstall dependencies: `rm -rf node_modules && npm install`

## License

Same as main TrustHold project.

