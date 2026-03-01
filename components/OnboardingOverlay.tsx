'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import GlassCard from './ui/GlassCard'
import PremiumButton from './ui/PremiumButton'

interface OnboardingStep {
  id: string
  title: string
  description: string
  targetSelector?: string
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center'
  action?: {
    label: string
    onClick: () => void
  }
}

interface OnboardingOverlayProps {
  onComplete: () => void
}

export default function OnboardingOverlay({ onComplete }: OnboardingOverlayProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null)
  const [overlayPosition, setOverlayPosition] = useState({ top: 0, left: 0, width: 0, height: 0 })
  const overlayRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const steps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'Welcome to Rift! 👋',
      description: 'Rift is your secure payment protection platform for brand deals and creator partnerships. Let\'s take a quick tour to get you started.',
      position: 'center',
    },
    {
      id: 'dashboard',
      title: 'Your Dashboard',
      description: 'This is your dashboard where you can see all your active and completed transactions (Rifts). Track payments, shipments, and releases all in one place.',
      targetSelector: '[data-onboarding="dashboard"]',
      position: 'bottom',
    },
    {
      id: 'create-rift',
      title: 'Create a Rift',
      description: 'Click here to create a new Rift transaction. You can set up secure payment protection for any brand deal or creator partnership.',
      targetSelector: '[data-onboarding="create-rift"]',
      position: 'bottom',
      action: {
        label: 'Try it now',
        onClick: () => {
          router.push('/rifts/create')
          onComplete()
        },
      },
    },
    {
      id: 'navigation',
      title: 'Navigation',
      description: 'Use the navigation menu to access your Rifts, Activity feed, Messages, and Account settings.',
      targetSelector: '[data-onboarding="navigation"]',
      position: 'bottom',
    },
    {
      id: 'messages',
      title: 'Messages',
      description: 'Communicate securely with buyers and sellers directly through Rift. All messages are tied to your transactions.',
      targetSelector: '[data-onboarding="messages"]',
      position: 'bottom',
    },
    {
      id: 'account',
      title: 'Your Account',
      description: 'Manage your profile, view your Rift ID, check your balance, and update settings from your account page.',
      targetSelector: '[data-onboarding="account"]',
      position: 'bottom',
    },
    {
      id: 'complete',
      title: "You're all set! 🎉",
      description: 'You now know the basics of Rift. Start by creating your first Rift transaction or explore the platform. Need help? Check out our FAQ or contact support.',
      position: 'center',
    },
  ]

  const currentStepData = steps[currentStep]

  useEffect(() => {
    if (currentStepData?.targetSelector) {
      const element = document.querySelector(currentStepData.targetSelector) as HTMLElement
      if (element) {
        setTargetElement(element)
        const rect = element.getBoundingClientRect()
        setOverlayPosition({
          top: rect.top + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
          height: rect.height,
        })
      } else {
        // If element not found, skip to next step after a delay
        setTimeout(() => {
          if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1)
          }
        }, 500)
      }
    } else {
      setTargetElement(null)
    }
  }, [currentStep, currentStepData?.targetSelector])

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      handleComplete()
    }
  }

  const handleSkip = () => {
    handleComplete()
  }

  const handleComplete = async () => {
    try {
      await fetch('/api/me/onboarding/complete', {
        method: 'POST',
        credentials: 'include',
      })
      onComplete()
    } catch (error) {
      console.error('Error marking onboarding as complete:', error)
      onComplete() // Complete anyway
    }
  }

  const getTooltipPosition = () => {
    if (!targetElement || currentStepData.position === 'center') {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      }
    }

    const rect = targetElement.getBoundingClientRect()
    const scrollY = window.scrollY
    const scrollX = window.scrollX

    switch (currentStepData.position) {
      case 'top':
        return {
          top: `${rect.top + scrollY - 20}px`,
          left: `${rect.left + scrollX + rect.width / 2}px`,
          transform: 'translate(-50%, -100%)',
        }
      case 'bottom':
        return {
          top: `${rect.bottom + scrollY + 20}px`,
          left: `${rect.left + scrollX + rect.width / 2}px`,
          transform: 'translate(-50%, 0)',
        }
      case 'left':
        return {
          top: `${rect.top + scrollY + rect.height / 2}px`,
          left: `${rect.left + scrollX - 20}px`,
          transform: 'translate(-100%, -50%)',
        }
      case 'right':
        return {
          top: `${rect.top + scrollY + rect.height / 2}px`,
          left: `${rect.right + scrollX + 20}px`,
          transform: 'translate(0, -50%)',
        }
      default:
        return {
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }
    }
  }

  const tooltipStyle = getTooltipPosition()

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-white z-[9998] transition-opacity"
        onClick={currentStepData.position === 'center' ? undefined : handleNext}
      />

      {/* Highlight overlay for target element */}
      {targetElement && currentStepData.position !== 'center' && (
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{
            top: `${overlayPosition.top}px`,
            left: `${overlayPosition.left}px`,
            width: `${overlayPosition.width}px`,
            height: `${overlayPosition.height}px`,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5), 0 0 0 4px rgba(255, 255, 255, 0.3)',
            borderRadius: '8px',
          }}
        />
      )}

      {/* Tooltip */}
      <div
        ref={overlayRef}
        className="fixed z-[10000] max-w-sm w-full mx-4"
        style={tooltipStyle}
      >
        <GlassCard variant="liquid" className="p-6">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xl font-light text-[#1d1d1f]">
                {currentStepData.title}
              </h3>
              <span className="text-sm text-[#86868b]">
                {currentStep + 1} / {steps.length}
              </span>
            </div>
            <p className="text-gray-600 font-light text-sm leading-relaxed">
              {currentStepData.description}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {currentStepData.action ? (
              <>
                <PremiumButton
                  onClick={currentStepData.action.onClick}
                  className="flex-1"
                >
                  {currentStepData.action.label}
                </PremiumButton>
                <button
                  onClick={handleNext}
                  className="px-4 py-2 text-[#86868b] hover:text-[#1d1d1f] transition-colors text-sm font-light"
                >
                  Skip
                </button>
              </>
            ) : (
              <>
                <PremiumButton
                  onClick={handleNext}
                  className="flex-1"
                >
                  {currentStep === steps.length - 1 ? 'Get Started' : 'Next'}
                </PremiumButton>
                {currentStep < steps.length - 1 && (
                  <button
                    onClick={handleSkip}
                    className="px-4 py-2 text-[#86868b] hover:text-[#1d1d1f] transition-colors text-sm font-light"
                  >
                    Skip
                  </button>
                )}
              </>
            )}
          </div>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-2 mt-4">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`h-1.5 rounded-full transition-all ${
                  index === currentStep
                    ? 'bg-white w-6'
                    : index < currentStep
                    ? 'bg-white/40 w-1.5'
                    : 'bg-white/20 w-1.5'
                }`}
              />
            ))}
          </div>
        </GlassCard>
      </div>
    </>
  )
}

