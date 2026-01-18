'use client'

import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import GlassCard from './ui/GlassCard'
import PremiumButton from './ui/PremiumButton'
import { useToast } from './ui/Toast'

// Initialize Stripe - use publishable key from environment
const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''
if (!publishableKey) {
  console.warn('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set. Stripe Elements will not work.')
}

const stripePromise = publishableKey ? loadStripe(publishableKey) : null

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
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasInteracted, setHasInteracted] = useState(false)
  const [elementsError, setElementsError] = useState<string | null>(null)
  
  // Reset error and interaction state when clientSecret changes (modal reopened)
  useEffect(() => {
    setError(null)
    setHasInteracted(false)
    setElementsError(null)
  }, [clientSecret])

  // Check if Stripe and Elements are loaded
  useEffect(() => {
    if (!stripe) {
      setElementsError('Stripe is not loaded. Please check your Stripe publishable key.')
    } else if (!elements) {
      setElementsError('Stripe Elements is not initialized. Please try refreshing the page.')
    } else {
      setElementsError(null)
    }
  }, [stripe, elements])

  // Handle change events from PaymentElement to track user interaction
  // This must be called before any conditional returns to satisfy Rules of Hooks
  useEffect(() => {
    if (!elements) return
    
    try {
      const paymentElement = elements.getElement('payment')
      if (!paymentElement) {
        console.warn('PaymentElement not found in elements')
        return
      }

      const handleChange = () => {
        setHasInteracted(true)
        setElementsError(null)
      }

      paymentElement.on('change', handleChange)
      
      return () => {
        try {
          paymentElement.off('change', handleChange)
        } catch (err) {
          // Ignore errors when cleaning up
        }
      }
    } catch (err: any) {
      console.error('Error setting up PaymentElement:', err)
      setElementsError('Failed to initialize payment form. Please try again.')
    }
  }, [elements])

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
        const errorMessage = submitError.message || 'Please check your payment details'
        setError(errorMessage)
        setHasInteracted(true) // Mark as interacted when validation fails
        showToast(errorMessage, 'error')
        setLoading(false)
        return
      }

      // Then confirm payment
      let confirmResult
      try {
        confirmResult = await stripe.confirmPayment({
          elements,
          clientSecret,
          confirmParams: {
            return_url: `${window.location.origin}/rifts/${escrowId}`,
          },
          redirect: 'if_required',
        })
      } catch (stripeError: any) {
        console.error('Stripe confirmPayment exception:', {
          error: stripeError,
          message: stripeError?.message,
          code: stripeError?.code,
          type: stripeError?.type,
          stack: stripeError?.stack
        })
        const errorMessage = stripeError?.message || stripeError?.code || 'Payment confirmation failed. Please try again.'
        setError(errorMessage)
        showToast(errorMessage, 'error')
        setLoading(false)
        return
      }

      // Check if confirmResult exists and has an error
      if (!confirmResult) {
        console.error('Stripe confirmPayment returned undefined result')
        const errorMessage = 'Payment confirmation failed. Please try again.'
        setError(errorMessage)
        showToast(errorMessage, 'error')
        setLoading(false)
        return
      }

      // Check for error in confirmResult
      if (confirmResult.error) {
        const stripeError = confirmResult.error as any
        
        // Extract error details using JSON.stringify since Stripe error objects
        // have non-enumerable properties that aren't directly accessible
        let errorMessage = 'Payment failed'
        let errorCode = ''
        let errorType = ''
        
        try {
          // Use JSON.stringify to serialize the error object, which exposes all properties
          const errorJson = JSON.parse(JSON.stringify(stripeError, Object.getOwnPropertyNames(stripeError)))
          
          if (errorJson.message) {
            errorMessage = errorJson.message
          }
          if (errorJson.code) {
            errorCode = errorJson.code
          }
          if (errorJson.type) {
            errorType = errorJson.type
          }
        } catch (parseError) {
          // If JSON parsing fails, try direct property access as fallback
          if (stripeError.message) {
            errorMessage = stripeError.message
          }
          if (stripeError.code) {
            errorCode = stripeError.code
          }
          if (stripeError.type) {
            errorType = stripeError.type
          }
        }
        
        // Use code-specific messages for better UX
        if (errorCode === 'payment_intent_unexpected_state') {
          errorMessage = 'Payment is in an unexpected state. Please try again or use a different payment method.'
        } else if (errorCode && errorMessage === 'Payment failed') {
          errorMessage = `Payment error: ${errorCode}`
        } else if (errorMessage === 'Payment failed') {
          errorMessage = 'Payment processing error. Please try again.'
        }
        
        // Log error details for debugging
        console.error('Stripe payment error:', 
          `Message: ${errorMessage}, Code: ${errorCode || 'N/A'}, Type: ${errorType || 'N/A'}`
        )
        
        setError(errorMessage)
        showToast(errorMessage, 'error')
        setLoading(false)
        return
      }
      
      // Also check if paymentIntent exists and has an error status
      const paymentIntent = (confirmResult as any).paymentIntent
      if (paymentIntent?.status) {
        const status = paymentIntent.status
        if (status === 'requires_payment_method' || status === 'canceled' || status === 'requires_action') {
          console.warn('Payment intent status indicates failure:', status)
          const errorMessage = status === 'requires_payment_method' 
            ? 'Payment method was declined. Please try a different card.'
            : status === 'canceled'
            ? 'Payment was canceled. Please try again.'
            : 'Payment requires additional action. Please try again.'
          setError(errorMessage)
          showToast(errorMessage, 'error')
          setLoading(false)
          return
        }
      }

      // Wait a moment for Stripe to update the payment intent status
      // Sometimes the status takes a moment to update from 'processing' to 'succeeded'
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Payment succeeded - confirm payment and transition to FUNDED
      let confirmResponse
      try {
        confirmResponse = await fetch(`/api/rifts/${escrowId}/fund`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ paymentIntentId }),
        })
      } catch (fetchError: any) {
        console.error('Network error confirming payment:', fetchError)
        const errorMessage = 'Network error. Please check your connection and try again.'
        setError(errorMessage)
        showToast(errorMessage, 'error')
        setLoading(false)
        return
      }

      if (!confirmResponse.ok) {
        let errorData: any = {}
        let responseText = ''
        try {
          responseText = await confirmResponse.text()
          if (responseText) {
            try {
              errorData = JSON.parse(responseText)
            } catch {
              // If JSON parsing fails, use the text as error message
              errorData = { error: responseText.substring(0, 200) }
            }
          }
        } catch (parseError) {
          console.error('Failed to parse error response:', parseError)
        }
        
        // Ensure we have at least a basic error message
        if (!errorData.error && !errorData.message && !errorData.details) {
          errorData.error = `HTTP ${confirmResponse.status}: ${confirmResponse.statusText || 'Unknown error'}`
        }
        
        const errorMessage = errorData.error || errorData.message || errorData.details || `Failed to confirm payment (${confirmResponse.status})`
        
        const errorLogData: any = {
          status: confirmResponse.status,
          statusText: confirmResponse.statusText,
          error: errorMessage,
        }
        
        // Only include additional fields if they have meaningful content
        if (errorData.details) {
          errorLogData.details = errorData.details
        }
        if (Object.keys(errorData).length > 0 && (errorData.error || errorData.message)) {
          errorLogData.fullError = errorData
        }
        if (responseText) {
          errorLogData.responseText = responseText.substring(0, 500)
        }
        
        console.error('Payment confirmation error:', errorLogData)
        
        setError(errorMessage)
        showToast(errorMessage, 'error')
        setLoading(false)
        return
      }

      let confirmData
      try {
        confirmData = await confirmResponse.json()
        console.log('Payment confirmed successfully:', confirmData)
      } catch (parseError) {
        console.error('Failed to parse confirmation response:', parseError)
        // Even if we can't parse, the status was 200, so assume success
        console.log('Payment confirmed (unable to parse response)')
      }
      
      showToast('Payment successful!', 'success')
      onSuccess()
    } catch (err: any) {
      console.error('Payment processing error:', err)
      const errorMessage = err.message || err.toString() || 'Payment processing failed. Please try again.'
      setError(errorMessage)
      showToast(errorMessage, 'error')
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

  // Show error if Stripe or Elements is not loaded
  if (!stripe || !elements || elementsError) {
    return (
      <div className="p-8 text-center">
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
          <p className="text-red-400 text-sm font-light mb-2">
            {elementsError || 'Payment form could not be loaded'}
          </p>
          <p className="text-red-300/60 text-xs font-light">
            Please check your browser console or try refreshing the page.
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-white text-sm transition-colors"
        >
          Refresh Page
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement 
        options={{
          // PaymentIntent supports us_bank_account (Plaid) for USD, card for all currencies
          // Bank transfers are prioritized for USD payments based on payment_method_types order
          fields: {
            billingDetails: 'auto' as const,
          },
        }}
        onReady={() => {
          setElementsError(null)
        }}
      />
      
      {(error || elementsError) && (hasInteracted || elementsError) && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
          <p className="text-red-400 text-sm font-light">{error || elementsError}</p>
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
  const { showToast } = useToast()
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null)
  const [stripeLoaded, setStripeLoaded] = useState(false)

  // Check if Stripe is loaded
  useEffect(() => {
    if (!stripePromise) {
      console.error('Stripe publishable key is missing')
      showToast('Payment system is not configured. Please contact support.', 'error')
      return
    }

    stripePromise.then((stripe) => {
      if (stripe) {
        setStripeLoaded(true)
      } else {
        console.error('Failed to load Stripe')
        showToast('Failed to load payment system. Please try refreshing the page.', 'error')
      }
    }).catch((err) => {
      console.error('Error loading Stripe:', err)
      showToast('Failed to initialize payment system. Please check your connection.', 'error')
    })
  }, [])

  // Disable background scroll while modal is open
  useEffect(() => {
    if (!isOpen) return
    
    // Lock body scroll and prevent content from showing behind modal
    const prevOverflow = document.body.style.overflow
    const prevPosition = document.body.style.position
    const prevWidth = document.body.style.width
    
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.width = '100%'
    document.body.classList.add('modal-open')
    
    return () => {
      document.body.style.overflow = prevOverflow
      document.body.style.position = prevPosition
      document.body.style.width = prevWidth
      document.body.classList.remove('modal-open')
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      setClientSecret(null)
      setPaymentIntentId(null)
      return
    }

    // Pay for rift and create payment intent when modal opens
    const fundRift = async () => {
      try {
        const response = await fetch(`/api/rifts/${escrowId}/fund`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to pay for rift')
        }

        const data = await response.json()
        setClientSecret(data.clientSecret)
        setPaymentIntentId(data.paymentIntentId)
      } catch (err: any) {
        console.error('Pay for rift error:', err)
        showToast(err.message || 'Failed to initialize payment. Please try again.', 'error')
        onClose()
      }
    }

    fundRift()
  }, [isOpen, escrowId])

  // Memoize options to prevent Elements from re-initializing
  const options: StripeElementsOptions = useMemo(() => ({
    clientSecret: clientSecret || undefined,
    appearance: {
      theme: 'night' as const,
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
    // PaymentIntent now supports both us_bank_account (Plaid) and card
    // Bank transfers are prioritized and shown first in the payment method selector
  }), [clientSecret])

  // Render modal in portal to ensure it's above all other content
  if (!isOpen) return null

  // Show error if Stripe publishable key is missing
  if (!publishableKey || !stripePromise) {
    const errorModalContent = (
      <>
        <div
          data-modal-backdrop
          className="fixed inset-0 bg-black pointer-events-auto"
          style={{
            zIndex: 2147483647,
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
          }}
          onClick={onClose}
        />
        <div
          data-modal-content
          className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none"
          style={{
            zIndex: 2147483647,
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}
        >
          <GlassCard variant="strong" className="relative w-full max-w-lg p-8 pointer-events-auto">
            <div className="text-center">
              <p className="text-red-400 mb-4">Payment system is not configured</p>
              <p className="text-white/60 text-sm mb-4">
                Stripe publishable key is missing. Please contact support.
              </p>
              <PremiumButton onClick={onClose}>Close</PremiumButton>
            </div>
          </GlassCard>
        </div>
      </>
    )
    if (typeof window === 'undefined') return null
    return createPortal(errorModalContent, document.body)
  }

  const modalContent = (
    <>
      {/* Backdrop - fully opaque, blocks all interaction, highest z-index */}
      <div
        data-modal-backdrop
        className="fixed inset-0 bg-black pointer-events-auto"
        style={{
          zIndex: 2147483647,
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100vh',
        }}
        onClick={onClose}
      />
      {/* Modal Container */}
      <div
        data-modal-content
        className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none"
        style={{
          zIndex: 2147483647,
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
      >
        <GlassCard variant="strong" className="relative w-full max-w-lg p-8 max-h-[90vh] overflow-y-auto pointer-events-auto">
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

        {/* Dispute Fee Disclosure */}
        <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1 space-y-1">
              <p className="text-sm text-white/90 font-light">
                <strong className="text-white">Disputes are free</strong> when handled through Rift.
              </p>
              <p className="text-xs text-white/60 font-light leading-relaxed">
                Filing a bank or card chargeback instead may result in a $15 processing fee, refunded if you win.
              </p>
            </div>
          </div>
        </div>

        {!stripeLoaded ? (
          <div className="p-8 text-center">
            <div className="animate-spin h-8 w-8 border-2 border-white/20 border-t-white rounded-full mx-auto mb-4"></div>
            <p className="text-white/60 font-light">Loading payment system...</p>
          </div>
        ) : clientSecret && paymentIntentId ? (
          <Elements stripe={stripePromise} options={options} key={clientSecret}>
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
    </>
  )

  // Use portal to render at document.body level, ensuring it's above all content
  if (typeof window === 'undefined') return null
  return createPortal(modalContent, document.body)
}

