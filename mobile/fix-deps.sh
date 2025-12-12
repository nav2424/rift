#!/bin/bash
# Fix script for React Native dependency issues

echo "Cleaning all caches and node_modules..."
rm -rf node_modules
rm -rf .expo
rm -rf node_modules/.cache
npm cache clean --force

echo "Reinstalling dependencies..."
npm install

echo "Fixing Expo packages..."
npx expo install --fix

echo "Clearing Metro bundler cache..."
npx expo start --clear

echo "Done! Now run: npm start"

