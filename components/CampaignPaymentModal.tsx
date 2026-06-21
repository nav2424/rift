'use client'

import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import GlassCard from './ui/GlassCard'
import PremiumButton from './ui/PremiumButton'
import { useToast } from './ui/Toast'

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''
const stripePromise = publishableKey ? loadStripe(publishableKey) : null

interface CampaignPaymentModalProps {
  isOpen: boolean
  onClose: () => void
  campaignId: string
  amount: number
  currency: string
  onSuccess: () => void
}

function CampaignPaymentForm({
  campaignId,
  amount,
  currency,
  onSuccess,
  onClose,
  clientSecret,
  paymentIntentId,
}: Omit<CampaignPaymentModalProps, 'isOpen'> & { clientSecret: string; paymentIntentId: string }) {
  const stripe = useStripe()
  const elements = useElements()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return

    setLoading(true)
    setError(null)

    try {
      const { error: submitError } = await elements.submit()
      if (submitError) {
        setError(submitError.message || 'Please check your payment details')
        setLoading(false)
        return
      }

      const isMock = paymentIntentId.startsWith('pi_mock_')

      if (!isMock) {
        const confirmResult = await stripe.confirmPayment({
          elements,
          clientSecret,
          confirmParams: {
            return_url: `${window.location.origin}/brand/campaigns`,
          },
          redirect: 'if_required',
        })

        if (confirmResult.error) {
          setError(confirmResult.error.message || 'Payment failed')
          showToast(confirmResult.error.message || 'Payment failed', 'error')
          setLoading(false)
          return
        }
      }

      const confirmRes = await fetch(`/api/campaigns/${campaignId}/confirm-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ paymentIntentId }),
      })

      if (!confirmRes.ok) {
        const err = await confirmRes.json()
        throw new Error(err.error || 'Failed to confirm payment')
      }

      showToast('Payment successful!', 'success')
      onSuccess()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Payment failed'
      setError(message)
      showToast(message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {paymentIntentId.startsWith('pi_mock_') ? (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          Dev mode: Stripe is not configured. Click pay to simulate a successful payment.
        </div>
      ) : (
        <PaymentElement options={{ fields: { billingDetails: 'auto' } }} />
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      <div className="flex gap-3">
        <PremiumButton type="button" variant="outline" onClick={onClose} disabled={loading} className="flex-1">
          Cancel
        </PremiumButton>
        <PremiumButton type="submit" disabled={(!stripe && !paymentIntentId.startsWith('pi_mock_')) || loading} className="flex-1">
          {loading ? 'Processing...' : `Pay ${currency} ${amount.toFixed(2)}`}
        </PremiumButton>
      </div>
    </form>
  )
}

export default function CampaignPaymentModal({
  isOpen,
  onClose,
  campaignId,
  amount,
  currency,
  onSuccess,
}: CampaignPaymentModalProps) {
  const { showToast } = useToast()
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) {
      setClientSecret(null)
      setPaymentIntentId(null)
      return
    }

    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const init = async () => {
      try {
        const res = await fetch(`/api/campaigns/${campaignId}/payment-intent`, {
          method: 'POST',
          credentials: 'include',
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Failed to initialize payment')
        }
        const data = await res.json()
        setClientSecret(data.clientSecret)
        setPaymentIntentId(data.paymentIntentId)
      } catch (err: unknown) {
        showToast(err instanceof Error ? err.message : 'Payment failed to load', 'error')
        onClose()
      }
    }
    init()
  }, [isOpen, campaignId, onClose, showToast])

  const options: StripeElementsOptions = useMemo(
    () => ({
      clientSecret: clientSecret || undefined,
      appearance: {
        theme: 'stripe',
        variables: { borderRadius: '12px' },
      },
    }),
    [clientSecret]
  )

  if (!isOpen || typeof window === 'undefined') return null

  return createPortal(
    <>
      <div className="fixed inset-0 bg-black/40 z-[9998]" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center p-4 z-[9999] pointer-events-none">
        <GlassCard variant="strong" className="relative w-full max-w-lg p-8 pointer-events-auto bg-white">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold text-[#1d1d1f]">Pay campaign budget</h2>
            <button type="button" onClick={onClose} className="text-[#86868b] hover:text-[#1d1d1f]">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-xl">
            <p className="text-sm text-[#86868b] mb-1">Total</p>
            <p className="text-2xl font-semibold text-[#1d1d1f]">
              {currency} {amount.toFixed(2)}
            </p>
          </div>

          {!clientSecret || !paymentIntentId ? (
            <div className="p-8 text-center">
              <div className="animate-spin h-8 w-8 border-2 border-gray-200 border-t-gray-600 rounded-full mx-auto mb-4" />
              <p className="text-[#86868b] text-sm">Loading checkout...</p>
            </div>
          ) : paymentIntentId.startsWith('pi_mock_') ? (
            <CampaignPaymentForm
              campaignId={campaignId}
              amount={amount}
              currency={currency}
              onSuccess={onSuccess}
              onClose={onClose}
              clientSecret={clientSecret}
              paymentIntentId={paymentIntentId}
            />
          ) : stripePromise ? (
            <Elements stripe={stripePromise} options={options} key={clientSecret}>
              <CampaignPaymentForm
                campaignId={campaignId}
                amount={amount}
                currency={currency}
                onSuccess={onSuccess}
                onClose={onClose}
                clientSecret={clientSecret}
                paymentIntentId={paymentIntentId}
              />
            </Elements>
          ) : (
            <p className="text-red-600 text-sm">Stripe publishable key is not configured.</p>
          )}
        </GlassCard>
      </div>
    </>,
    document.body
  )
}
