import { Slot } from 'expo-router';
import { AuthProvider } from '@/lib/auth';
import { StatusBar } from 'expo-status-bar';
import { LogBox } from 'react-native';
import React from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { StripeProvider } from '@stripe/stripe-react-native';
import Constants from 'expo-constants';

const STRIPE_PUBLISHABLE_KEY = Constants.expoConfig?.extra?.stripePublishableKey || '';

// Suppress the known navigation context warning (known Expo Router/React Navigation issue)
if (__DEV__) {
  LogBox.ignoreLogs([
    'Couldn\'t find the prevent remove context',
    'prevent remove context',
  ]);
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <StatusBar style="light" />
      <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>
        <AuthProvider>
          <Slot />
        </AuthProvider>
      </StripeProvider>
    </ErrorBoundary>
  );
}

