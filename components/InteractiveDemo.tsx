'use client'

import { useState } from 'react'
import PremiumButton from './ui/PremiumButton'

interface DemoStep {
  id: string
  title: string
  description: string
  status: 'pending' | 'active' | 'completed'
  icon: React.ReactNode
  details?: string
}

export default function InteractiveDemo() {
  const [currentStep, setCurrentStep] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)

  const steps: DemoStep[] = [
    {
      id: 'create',
      title: 'Create a Rift',
      description: 'Buyer sets terms and amount',
      status: currentStep >= 0 ? 'completed' : 'pending',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      ),
      details: 'Transaction amount: $500\nCounterparty: Secure ID\nTerms: Digital license key'
    },
    {
      id: 'secure',
      title: 'Secure Payment',
      description: 'Buyer pays; funds are secured',
      status: currentStep >= 1 ? 'completed' : currentStep === 0 ? 'active' : 'pending',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      ),
      details: 'Payment: $515.00\nProcessing fee: $15.00\nStatus: Funds Secured'
    },
    {
      id: 'deliver',
      title: 'Deliver to Vault',
      description: 'Seller submits proof',
      status: currentStep >= 2 ? 'completed' : currentStep === 1 ? 'active' : 'pending',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
      details: 'Proof uploaded: License key file\nVault access: Buyer + Admin\nVerification window: 24 hours'
    },
    {
      id: 'verify',
      title: 'Verify',
      description: 'Review and confirm',
      status: currentStep >= 3 ? 'completed' : currentStep === 2 ? 'active' : 'pending',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      details: 'Buyer reviews proof\nVerification: Approved\nReady for release'
    },
    {
      id: 'release',
      title: 'Release',
      description: 'Funds released to seller',
      status: currentStep >= 4 ? 'completed' : currentStep === 3 ? 'active' : 'pending',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      ),
      details: 'Payout: $475.00\nPlatform fee: $25.00\nStatus: Completed'
    }
  ]

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      setCurrentStep(0) // Reset
    }
  }

  const handlePlay = () => {
    setIsPlaying(true)
    let step = 0
    const interval = setInterval(() => {
      setCurrentStep(step)
      step++
      if (step >= steps.length) {
        clearInterval(interval)
        setIsPlaying(false)
        setTimeout(() => setCurrentStep(0), 2000) // Reset after 2 seconds
      }
    }, 2000)
  }

  const activeStep = steps[currentStep]

  return (
    <div className="relative max-w-6xl mx-auto">

      <div className="grid md:grid-cols-2 gap-8">
        {/* Step Cards */}
        <div className="space-y-3">
          {steps.map((step, index) => (
            <button
              key={step.id}
              onClick={() => setCurrentStep(index)}
              className={`w-full rounded-xl px-4 py-3 text-left glass-soft hover:bg-white/[0.035] transition ${
                step.status === 'active'
                  ? 'bg-white/[0.035] border-white/12'
                  : step.status === 'completed'
                  ? 'opacity-70'
                  : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-lg glass-soft flex items-center justify-center text-sm ${
                    step.status === 'active'
                      ? 'text-white'
                      : step.status === 'completed'
                      ? 'text-emerald-400'
                      : 'text-white/60'
                  }`}
                >
                  {step.status === 'completed' ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-current" />
                  )}
                </div>
                <div className="flex-1 text-left">
                  <div className="text-sm font-medium text-white">{step.title}</div>
                  <div className="text-xs text-white/55 mt-0.5">{step.description}</div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Active Step Details */}
        <div className="sticky top-24">
          <div className="rounded-2xl glass glass-highlight p-6 h-full">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl glass stroke flex items-center justify-center bg-white/10 text-white">
                  {activeStep.icon}
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">{activeStep.title}</h3>
                  <p className="text-sm text-white/60">{activeStep.description}</p>
                </div>
              </div>
            </div>

            {activeStep.details && (
              <div className="mt-6 p-4 rounded-xl bg-black/40 border border-white/10">
                <pre className="text-xs text-white/70 font-mono whitespace-pre-line leading-relaxed">
                  {activeStep.details}
                </pre>
              </div>
            )}

            <div className="mt-8 flex gap-3">
              <PremiumButton
                variant="primary"
                onClick={handleNext}
                className="flex-1"
              >
                {currentStep < steps.length - 1 ? 'Next Step' : 'Start Over'}
              </PremiumButton>
              <PremiumButton
                variant="outline"
                onClick={handlePlay}
                disabled={isPlaying}
                className="flex-1"
              >
                {isPlaying ? 'Playing...' : 'Auto Play'}
              </PremiumButton>
            </div>

            {/* Progress Indicator */}
            <div className="mt-6">
              <div className="flex gap-2">
                {steps.map((_, index) => (
                  <div
                    key={index}
                    className={`h-1 flex-1 rounded-full transition-all ${
                      index <= currentStep
                        ? 'bg-blue-500'
                        : 'bg-white/10'
                    }`}
                  />
                ))}
              </div>
              <p className="text-xs text-white/50 mt-2 text-center">
                Step {currentStep + 1} of {steps.length}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


