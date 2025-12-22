# Mobile Testing Guide

This guide shows you how to test your Rift website on a real mobile device.

## Method 1: Chrome DevTools (Fastest - Desktop Testing)

For quick mobile testing without a physical device:

1. **Open Chrome DevTools:**
   - Press `F12` or `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows/Linux)
   - Or right-click → "Inspect"

2. **Toggle Device Toolbar:**
   - Press `Cmd+Shift+M` (Mac) / `Ctrl+Shift+M` (Windows/Linux)
   - Or click the device icon in the toolbar

3. **Select a Device:**
   - Choose from presets (iPhone, iPad, Samsung, etc.)
   - Or set custom dimensions

4. **Test Touch Interactions:**
   - Click to simulate taps
   - Drag to simulate swipes
   - Use throttling to simulate slow networks

**Pros:** Fast, no setup needed
**Cons:** Not a real device, may miss some mobile-specific issues

---

## Method 2: Test on Real Mobile Device (Recommended)

### Step 1: Find Your Computer's IP Address

**On Mac:**
```bash
ipconfig getifaddr en0
# Or if that doesn't work:
ifconfig | grep "inet " | grep -v 127.0.0.1
```

**On Windows:**
```bash
ipconfig
# Look for "IPv4 Address" under your active network adapter
```

**On Linux:**
```bash
hostname -I
# Or:
ip addr show | grep "inet "
```

You should see something like: `192.168.1.100` or `10.0.0.50`

### Step 2: Start Your Dev Server

Your dev server is already configured to accept connections from all network interfaces:

```bash
npm run dev
```

You should see:
```
- Local:        http://localhost:3000
- Network:      http://192.168.1.100:3000
```

### Step 3: Connect Your Mobile Device

1. **Make sure your phone and computer are on the same WiFi network**

2. **Open your phone's browser** (Safari on iOS, Chrome on Android)

3. **Navigate to:**
   ```
   http://YOUR_IP_ADDRESS:3000
   ```
   For example: `http://192.168.1.100:3000`

4. **Test the site!**
   - Test the hamburger menu
   - Test touch interactions
   - Test scrolling performance
   - Test form inputs

### Troubleshooting Connection Issues

**If you can't connect:**

1. **Check Firewall:**
   - Mac: System Settings → Network → Firewall → Turn off or allow Node
   - Windows: Windows Defender → Allow app through firewall → Node.js
   - Linux: Check `ufw` or `iptables`

2. **Verify Same Network:**
   - Both devices must be on the same WiFi network
   - Don't use guest networks (they often block device-to-device communication)

3. **Try Different Port:**
   If port 3000 is blocked, you can change it:
   ```bash
   PORT=3001 npm run dev
   ```
   Then use: `http://YOUR_IP:3001`

4. **Check Dev Server Output:**
   Make sure you see "Network: http://YOUR_IP:3000" in the terminal

---

## Method 3: Using ngrok (For Testing from Anywhere)

If you need to test from a different network (or share with others):

### Install ngrok:
```bash
# Using Homebrew (Mac)
brew install ngrok

# Or download from https://ngrok.com/download
```

### Start ngrok:
```bash
# In a new terminal, run:
ngrok http 3000
```

You'll get a URL like: `https://abc123.ngrok.io`

### Access from Mobile:
1. Open the ngrok URL on your phone's browser
2. Works from any network, anywhere!

**Pros:** Works from any network, shareable URL
**Cons:** Requires ngrok account for permanent URLs, slight latency

---

## Method 4: Deploy to Vercel (Best for Real-World Testing)

For production-like testing:

1. **Push to GitHub** (if not already)

2. **Deploy to Vercel:**
   ```bash
   npm install -g vercel
   vercel
   ```

3. **Get your deployment URL:**
   - Example: `https://your-app.vercel.app`

4. **Test on mobile:**
   - Open the URL on your phone
   - Test in production-like conditions

**Pros:** Production environment, works from anywhere, shareable
**Cons:** Requires deployment step

---

## Quick Testing Checklist

When testing on mobile, check:

- [ ] **Navigation:** Hamburger menu opens/closes smoothly
- [ ] **Touch Targets:** All buttons are easily tappable (44×44px minimum)
- [ ] **Typography:** Text is readable without zooming
- [ ] **Images:** Load quickly and display correctly
- [ ] **Forms:** Inputs are easy to fill (keyboard pops up correctly)
- [ ] **Scrolling:** Smooth scrolling, no jank
- [ ] **Layout:** Content doesn't overflow horizontally
- [ ] **Performance:** Pages load in under 3 seconds
- [ ] **Orientation:** Works in both portrait and landscape
- [ ] **Viewport:** No weird zooming or scaling issues

---

## Tips for Mobile Testing

1. **Test on Multiple Devices:**
   - iOS (iPhone, iPad)
   - Android (various screen sizes)
   - Different browsers (Safari, Chrome)

2. **Test Different Networks:**
   - WiFi
   - 4G/5G (use your phone's mobile data)

3. **Use Browser DevTools on Mobile:**
   - iOS Safari: Enable Web Inspector (Settings → Safari → Advanced → Web Inspector)
   - Android Chrome: Use `chrome://inspect` on desktop Chrome

4. **Test Real Scenarios:**
   - Slow network (use throttling)
   - Offline behavior
   - Interrupted connections

---

## Quick Reference

**Start Dev Server:**
```bash
npm run dev
```

**Get IP Address (Mac):**
```bash
ipconfig getifaddr en0
```

**Access on Mobile:**
```
http://YOUR_IP:3000
```

**Using ngrok:**
```bash
ngrok http 3000
```
