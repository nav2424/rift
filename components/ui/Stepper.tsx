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
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                    : isCurrent
                    ? 'bg-blue-500/20 border-blue-500/50 text-blue-400 ring-2 ring-blue-500/30'
                    : 'bg-white/5 border-white/10 text-white/30'
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
                    isCompleted ? 'bg-emerald-500/30' : 'bg-white/10'
                  }`}
                  style={{ minHeight: '2rem' }}
                />
              )}
            </div>

            {/* Step content */}
            <div className="flex-1 pb-6">
              <div
                className={`font-light ${
                  isCurrent ? 'text-white' : isCompleted ? 'text-white/80' : 'text-white/50'
                }`}
              >
                <h4 className="text-sm font-medium mb-1">{step.label}</h4>
                {step.description && (
                  <p className="text-xs text-white/60 mt-1">{step.description}</p>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

