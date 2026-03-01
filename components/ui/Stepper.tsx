'use client'

interface StepperStep {
  id: string
  label: string
  description?: string
  status: 'completed' | 'current' | 'upcoming'
}

interface StepperProps {
  steps: StepperStep[]
  className?: string
}

/**
 * Stepper component for displaying Rift lifecycle timeline
 */
export default function Stepper({ steps, className = '' }: StepperProps) {
  return (
    <div className={`space-y-4 ${className}`}>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1
        const isCompleted = step.status === 'completed'
        const isCurrent = step.status === 'current'
        const isUpcoming = step.status === 'upcoming'

        return (
          <div key={step.id} className="flex gap-4">
            {/* Step indicator */}
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                  isCompleted
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-600'
                    : isCurrent
                    ? 'bg-blue-500/20 border-blue-500/50 text-blue-400 ring-2 ring-blue-500/30'
                    : 'bg-gray-50 border-gray-200 text-gray-400'
                }`}
              >
                {isCompleted ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className="text-xs font-medium">{index + 1}</span>
                )}
              </div>
              {!isLast && (
                <div
                  className={`w-0.5 flex-1 mt-2 ${
                    isCompleted ? 'bg-emerald-500/30' : 'bg-gray-100'
                  }`}
                  style={{ minHeight: '2rem' }}
                />
              )}
            </div>

            {/* Step content */}
            <div className="flex-1 pb-6">
              <div
                className={`font-light ${
                  isCurrent ? 'text-[#1d1d1f]' : isCompleted ? 'text-gray-700' : 'text-[#86868b]'
                }`}
              >
                <h4 className="text-sm font-medium mb-1">{step.label}</h4>
                {step.description && (
                  <p className="text-xs text-[#86868b] mt-1">{step.description}</p>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

