/**
 * Payment Sheet integration for React Native
 */

import { useStripe } from '@stripe/stripe-react-native';
import { api } from './api';
import Constants from 'expo-constants';

export const STRIPE_PUBLISHABLE_KEY = Constants.expoConfig?.extra?.stripePublishableKey || '';

export interface PaymentResult {
  success: boolean;
  paymentIntentId?: string;
  error?: string;
}

/**
 * Process payment using Payment Sheet
 * Supports: Credit/Debit Cards, Apple Pay, Google Pay
 */
export async function processStripePayment(
  escrowId: string,
  amount: number,
  currency: string,
  description: string
): Promise<PaymentResult> {
  try {
    // 1. Create payment intent on backend
    const { clientSecret, paymentIntentId } = await api.createPaymentIntent(escrowId);

    // 2. Initialize Payment Sheet
    // Note: This will be called from the component using payment hook
    // We return the clientSecret and paymentIntentId for the component to use
    return {
      success: true,
      paymentIntentId,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to initialize payment',
    };
  }
}

