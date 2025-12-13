'use client'

import { useState, useEffect } from 'react'
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import GlassCard from './ui/GlassCard'
import PremiumButton from './ui/PremiumButton'

// Initialize Stripe - use publishable key from environment
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''
)

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  escrowId: string
  amount?: number // Subtotal
  buyerTotal?: number // Subtotal + buyer fee
  currency: string
  onSuccess: () => void
}

function PaymentForm({ escrowId, amount, buyerTotal, currency, onSuccess, onClose, clientSecret, paymentIntentId }: Omit<PaymentModalProps, 'isOpen'> & { clientSecret: string; paymentIntentId: string }) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements || !clientSecret) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      // First, submit the elements to validate the form
      const { error: submitError } = await elements.submit()
      
      if (submitError) {
        setError(submitError.message || 'Please check your payment details')
        setLoading(false)
        return
      }

      // Then confirm payment
      const { error: confirmError } = await stripe.confirmPayment({
        elements,
        clientSecret,
        confirmParams: {
          return_url: `${window.location.origin}/escrows/${escrowId}`,
        },
        redirect: 'if_required',
      })

      if (confirmError) {
        setError(confirmError.message || 'Payment failed')
        setLoading(false)
        return
      }

      // Payment succeeded - confirm payment and transition to FUNDED
      const confirmResponse = await fetch(`/api/escrows/${escrowId}/fund`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ paymentIntentId }),
      })

      if (!confirmResponse.ok) {
        const error = await confirmResponse.json()
        throw new Error(error.error || 'Failed to confirm payment')
      }

      onSuccess()
    } catch (err: any) {
      setError(err.message || 'Payment failed')
    } finally {
      setLoading(false)
    }
  }

  if (!clientSecret) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin h-8 w-8 border-2 border-white/20 border-t-white rounded-full mx-auto mb-4"></div>
        <p className="text-white/60 font-light">Initializing payment...</p>
      </div>
    )
  }

  const options: StripeElementsOptions = {
    clientSecret,
    appearance: {
      theme: 'night',
      variables: {
        colorPrimary: '#ffffff',
        colorBackground: 'rgba(0, 0, 0, 0.8)',
        colorText: '#ffffff',
        colorDanger: '#ef4444',
        fontFamily: 'system-ui, sans-serif',
        spacingUnit: '4px',
        borderRadius: '12px',
      },
    },
    // Note: paymentMethodTypes is not needed here when using clientSecret
    // The PaymentIntent already restricts to cards only via payment_method_types: ['card']
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement 
        options={{
          // PaymentIntent already restricts to cards only via payment_method_types: ['card']
          // This ensures only card input is shown, no Link or other payment methods
        }}
      />
      
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
          <p className="text-red-400 text-sm font-light">{error}</p>
        </div>
      )}

      <div className="flex gap-3">
        <PremiumButton
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={loading}
          className="flex-1"
        >
          Cancel
        </PremiumButton>
        <PremiumButton
          type="submit"
          disabled={!stripe || loading}
          className="flex-1"
        >
          {loading ? 'Processing...' : `Pay ${currency} ${(buyerTotal || amount || 0).toFixed(2)}`}
        </PremiumButton>
      </div>
    </form>
  )
}

export default function PaymentModal({ isOpen, onClose, escrowId, amount, buyerTotal, currency, onSuccess }: PaymentModalProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) {
      setClientSecret(null)
      setPaymentIntentId(null)
      return
    }

    // Fund rift and create payment intent when modal opens
    const fundRift = async () => {
      try {
        const response = await fetch(`/api/escrows/${escrowId}/fund`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to fund rift')
        }

        const data = await response.json()
        setClientSecret(data.clientSecret)
        setPaymentIntentId(data.paymentIntentId)
      } catch (err: any) {
        console.error('Fund rift error:', err)
      }
    }

    fundRift()
  }, [isOpen, escrowId])

  if (!isOpen) return null

  const options: StripeElementsOptions = {
    clientSecret: clientSecret || undefined,
    appearance: {
      theme: 'night',
      variables: {
        colorPrimary: '#ffffff',
        colorBackground: 'rgba(0, 0, 0, 0.8)',
        colorText: '#ffffff',
        colorDanger: '#ef4444',
        fontFamily: 'system-ui, sans-serif',
        spacingUnit: '4px',
        borderRadius: '12px',
      },
    },
    // Note: paymentMethodTypes is not needed here when using clientSecret
    // The PaymentIntent already restricts to cards only via payment_method_types: ['card']
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose}></div>
      <GlassCard variant="strong" className="relative w-full max-w-lg p-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-light text-white">Complete Payment</h2>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-6 p-4 bg-white/5 border border-white/10 rounded-xl">
          <p className="text-sm text-white/60 font-light mb-1">Total Amount</p>
          <p className="text-2xl font-light text-white">
            {currency} {(buyerTotal || amount || 0).toFixed(2)}
          </p>
          {buyerTotal && amount && buyerTotal > amount && (
            <p className="text-xs text-white/40 font-light mt-1">
              {currency} {amount.toFixed(2)} + {currency} {(buyerTotal - amount).toFixed(2)} processing fee
            </p>
          )}
        </div>

        {clientSecret && paymentIntentId ? (
          <Elements stripe={stripePromise} options={options}>
            <PaymentForm
              escrowId={escrowId}
              amount={amount}
              buyerTotal={buyerTotal}
              currency={currency}
              onSuccess={onSuccess}
              onClose={onClose}
              clientSecret={clientSecret}
              paymentIntentId={paymentIntentId}
            />
          </Elements>
        ) : (
          <div className="p-8 text-center">
            <div className="animate-spin h-8 w-8 border-2 border-white/20 border-t-white rounded-full mx-auto mb-4"></div>
            <p className="text-white/60 font-light">Initializing payment...</p>
          </div>
        )}
      </GlassCard>
    </div>
  )
}

