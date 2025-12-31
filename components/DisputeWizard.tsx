'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PremiumButton from './ui/PremiumButton'
import GlassCard from './ui/GlassCard'
import { useToast } from './ui/Toast'

interface DisputeWizardProps {
  riftId: string
  itemType: string
  eventDateTz?: Date | null
  onClose: () => void
}

type WizardStep = 'resistance' | 'reason' | 'cooldown' | 'declaration' | 'evidence' | 'review'

const STEP_ORDER: WizardStep[] = ['resistance', 'reason', 'cooldown', 'declaration', 'evidence', 'review']
const STEP_LABELS: Record<WizardStep, string> = {
  resistance: 'Understanding',
  reason: 'Reason',
  cooldown: 'Eligibility',
  declaration: 'Declaration',
  evidence: 'Evidence',
  review: 'Review',
}

export default function DisputeWizard({ riftId, itemType, eventDateTz, onClose }: DisputeWizardProps) {
  const router = useRouter()
  const { showToast } = useToast()
  const [step, setStep] = useState<WizardStep>('resistance')
  const [loading, setLoading] = useState(false)
  const [disputeId, setDisputeId] = useState<string | null>(null)
  const [initializing, setInitializing] = useState(true)
  const [initError, setInitError] = useState<string | null>(null)
  const [hasInitAttempted, setHasInitAttempted] = useState(false)
  
  // Form state
  const [reason, setReason] = useState<string>('')
  const [summary, setSummary] = useState('')
  const [swornDeclaration, setSwornDeclaration] = useState(false)
  const [swornText, setSwornText] = useState('')
  const [evidence, setEvidence] = useState<Array<{ type: string; file?: File; text?: string; url?: string }>>([])
  const [cooldownMessage, setCooldownMessage] = useState<string | null>(null)
  const [canProceed, setCanProceed] = useState(false)

  const currentStepIndex = STEP_ORDER.indexOf(step)
  const progress = ((currentStepIndex + 1) / STEP_ORDER.length) * 100

  // Initialize dispute on mount - only run once
  useEffect(() => {
    // Only initialize if we haven't attempted yet and don't have a disputeId
    if (hasInitAttempted || disputeId) {
      return
    }

    const initDispute = async () => {
      setHasInitAttempted(true)
      setInitializing(true)
      setInitError(null)
      
      try {
        // Log intent
        await fetch(`/api/rifts/${riftId}/dispute/intent`, { method: 'POST' })

        // Create or get dispute
        const response = await fetch(`/api/rifts/${riftId}/dispute`, { method: 'POST' })
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
          const errorMessage = errorData.error || 'Failed to initialize dispute'
          setInitError(errorMessage)
          showToast(errorMessage, 'error')
          setInitializing(false)
          return
        }
        
        const data = await response.json()
        
        if (data.disputeId) {
          setDisputeId(data.disputeId)
          setInitializing(false)
        } else {
          const errorMessage = 'Failed to initialize dispute: No dispute ID returned'
          setInitError(errorMessage)
          showToast(errorMessage, 'error')
          setInitializing(false)
        }
      } catch (error: any) {
        const errorMessage = error.message || 'Failed to initialize dispute'
        setInitError(errorMessage)
        showToast(errorMessage, 'error')
        setInitializing(false)
      }
    }

    initDispute()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [riftId]) // Only depend on riftId - run once per riftId

  // Check cooldown/eligibility
  useEffect(() => {
    if (step === 'cooldown' && reason) {
      checkCooldown()
    }
  }, [step, reason, itemType, eventDateTz])

  const checkCooldown = async () => {
    // Check tickets: block if event passed
    if (itemType === 'TICKETS' && eventDateTz) {
      const eventDate = new Date(eventDateTz)
      const now = new Date()
      if (now >= eventDate) {
        setCooldownMessage('Disputes are not allowed after the event date has passed.')
        setCanProceed(false)
        return
      }
      
      // Check if event is within 6 hours
      const hoursUntilEvent = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60)
      if (hoursUntilEvent <= 6 && hoursUntilEvent > 0) {
        setCooldownMessage(
          `Event is in ${Math.round(hoursUntilEvent)} hours. Please provide urgent evidence if opening a dispute.`
        )
        setCanProceed(true)
        return
      }
    }

    // For digital goods: Check if delivery was just uploaded (1 hour cooldown)
    if (itemType === 'DIGITAL') {
      try {
        const response = await fetch(`/api/rifts/${riftId}/delivery/viewer`, {
          method: 'POST',
        })
        if (response.ok) {
          const data = await response.json()
          if (data.delivery) {
            // Check if uploaded within last hour
            const uploadTime = new Date(data.delivery.uploadedAt || data.delivery.uploaded_at)
            const now = new Date()
            const hoursSinceUpload = (now.getTime() - uploadTime.getTime()) / (1000 * 60 * 60)
            
            if (hoursSinceUpload < 1 && reason === 'not_received') {
              setCooldownMessage(
                'Delivery was uploaded less than 1 hour ago. Please allow time for access before disputing.'
              )
              setCanProceed(true)
              return
            }
          }
        }
      } catch (error) {
        // If no delivery exists, allow dispute
      }
    }

    // For services: Check if seller marked delivered less than 24h ago
    if (itemType === 'SERVICES' && reason === 'not_received') {
      setCanProceed(true)
      return
    }

    setCanProceed(true)
  }

  const handleReasonSelect = (selectedReason: string) => {
    setReason(selectedReason)
    setStep('cooldown')
  }

  const handleDeclarationChange = (text: string) => {
    setSwornText(text)
    setSwornDeclaration(text === 'I CONFIRM')
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file size (10MB max)
      const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
      if (file.size > MAX_FILE_SIZE) {
        showToast(`File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size of 10MB`, 'error')
        return
      }

      // Validate file type
      const validTypes = ['image/', 'application/pdf']
      if (!validTypes.some(t => file.type.startsWith(t))) {
        showToast('Invalid file type. Only images and PDFs are allowed.', 'error')
        return
      }

      setEvidence([...evidence, { type: file.type.startsWith('image/') ? 'image' : 'pdf', file }])
      showToast('File added successfully', 'success')
    }
  }

  const handleAddTextEvidence = () => {
    const text = prompt('Enter text evidence or link:')
    if (text) {
      setEvidence([...evidence, { type: text.startsWith('http') ? 'link' : 'text', text }])
    }
  }

  const handleRemoveEvidence = (index: number) => {
    setEvidence(evidence.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (!disputeId) {
      showToast('Dispute not initialized. Please wait a moment and try again.', 'error')
      return
    }

    setLoading(true)
    try {
      // Update dispute with reason and summary
      await fetch(`/api/disputes/${disputeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason,
          summary,
          swornDeclaration,
          swornDeclarationText: swornText,
        }),
      })

      // Upload evidence files
      for (const ev of evidence) {
        if (ev.file) {
          const formData = new FormData()
          formData.append('file', ev.file)
          formData.append('type', ev.type)

          const uploadResponse = await fetch(`/api/disputes/${disputeId}/evidence/upload`, {
            method: 'POST',
            body: formData,
          })

          if (!uploadResponse.ok) {
            const error = await uploadResponse.json()
            showToast(error.error || 'Failed to upload evidence file', 'error')
            return
          }
        } else if (ev.text) {
          await fetch(`/api/disputes/${disputeId}/evidence`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: ev.type,
              textContent: ev.text,
            }),
          })
        }
      }

      // Submit dispute
      const submitResponse = await fetch(`/api/disputes/${disputeId}/submit`, {
        method: 'POST',
      })

      if (!submitResponse.ok) {
        const error = await submitResponse.json()
        showToast(error.error || 'Failed to submit dispute', 'error')
        return
      }

      const submitData = await submitResponse.json()
      
      if (submitData.autoTriage?.decision === 'auto_reject') {
        showToast('Dispute was automatically reviewed and rejected based on system evidence.', 'warning')
      } else {
        showToast('Dispute submitted successfully', 'success')
      }

      router.refresh()
      onClose()
    } catch (error: any) {
      console.error('Submit dispute error:', error)
      showToast('Failed to submit dispute', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Loading state
  if (initializing) {
    return (
      <div className="p-4 md:p-5 space-y-4">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30">
            <svg className="w-5 h-5 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-light text-white mb-1">Initializing Dispute Process</h2>
            <p className="text-white/60 font-light text-xs">Preparing the dispute form...</p>
        </div>
        </div>
      </div>
    )
  }

  // Error state
  if (initError) {
    return (
      <div className="p-4 md:p-5 space-y-4">
        <GlassCard variant="strong" className="p-4 border-red-500/30">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-red-500/20 border border-red-500/30">
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-light text-white mb-1">Unable to Initialize</h2>
              <p className="text-white/80 font-light text-xs mb-3">{initError}</p>
              <PremiumButton onClick={onClose}>Close</PremiumButton>
        </div>
          </div>
        </GlassCard>
      </div>
    )
  }

      return (
    <div className="p-3 md:p-4 space-y-3">
      {/* Progress Bar */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/80 font-light">Step {currentStepIndex + 1} of {STEP_ORDER.length}</span>
          <span className="text-sm text-white/60 font-light">{Math.round(progress)}% Complete</span>
        </div>
        <div className="relative h-1.5 bg-white/10 rounded-full overflow-hidden backdrop-blur-sm">
          <div 
            className="absolute inset-y-0 left-0 bg-white/60 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between pt-2">
          {STEP_ORDER.map((s, idx) => {
            const isCompleted = idx < currentStepIndex
            const isCurrent = idx === currentStepIndex
            const isUpcoming = idx > currentStepIndex

    return (
              <button
                key={s}
                onClick={() => {
                  if (idx <= currentStepIndex) {
                    setStep(s)
                  }
                }}
                disabled={idx > currentStepIndex}
                className={`flex flex-col items-center gap-2 group transition-all ${
                  idx <= currentStepIndex ? 'cursor-pointer' : 'cursor-not-allowed'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                    isCompleted
                      ? 'bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-green-400/40 shadow-lg shadow-green-500/20'
                      : isCurrent
                      ? 'bg-gradient-to-br from-blue-500/30 to-purple-500/30 border-blue-400/50 shadow-lg shadow-blue-500/30 scale-110'
                      : 'bg-transparent border-white/10'
                  }`}
                >
                  {isCompleted ? (
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className={`text-xs font-medium ${
                      isCurrent ? 'text-white' : 'text-white/30'
                    }`}>{idx + 1}</span>
                  )}
                </div>
                <span className={`text-xs font-light transition-colors ${
                  isCurrent ? 'text-white' : isCompleted ? 'text-white/60' : 'text-white/30'
                } ${idx <= currentStepIndex && 'group-hover:text-white/90'}`}>
                  {STEP_LABELS[s]}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Step Content */}
      <div>
        {/* Step 0: Soft Resistance */}
        {step === 'resistance' && (
          <GlassCard variant="strong" className="p-4 space-y-4">
            <div className="text-center space-y-3">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-400/30 backdrop-blur-sm shadow-lg shadow-amber-500/20">
                <svg className="w-6 h-6 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-light text-white tracking-tight bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">Before You Proceed</h2>
                <p className="text-white/60 font-light text-sm max-w-2xl mx-auto leading-relaxed">
                  Opening a dispute is a serious matter that requires careful consideration and evidence.
                </p>
              </div>
            </div>
            
            <div className="space-y-3 max-w-2xl mx-auto">
              <div className="p-4 rounded-xl bg-gradient-to-br from-white/5 to-white/3 border border-white/10 backdrop-blur-sm shadow-lg shadow-black/20 hover:border-white/20 transition-all duration-300">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center border border-blue-400/30 shadow-lg shadow-blue-500/20">
                    <svg className="w-5 h-5 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="space-y-2 flex-1">
                    <h3 className="text-white font-light text-base">Important Information</h3>
                    <ul className="space-y-3 text-white/70 font-light text-sm leading-relaxed">
                      <li className="flex items-start gap-3">
                        <span className="text-white/40 mt-1 text-lg leading-none">○</span>
                        <span>Disputes require substantial evidence and may take time to resolve</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="text-white/40 mt-1 text-lg leading-none">○</span>
                        <span>Most issues can be resolved through direct communication with the seller</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="text-white/40 mt-1 text-lg leading-none">○</span>
                        <span className="text-white/80">False or fraudulent claims may result in account restrictions</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Fee Disclosure */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-blue-500/15 to-indigo-500/10 border border-blue-400/30 backdrop-blur-sm shadow-lg shadow-blue-500/20 hover:border-blue-400/40 transition-all duration-300">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/30 to-indigo-500/30 flex items-center justify-center border border-blue-400/40 shadow-lg shadow-blue-500/30">
                    <svg className="w-5 h-5 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="space-y-3 flex-1">
                    <h3 className="text-white font-light text-base">Dispute Fee Policy</h3>
                    <div className="space-y-3 text-white/80 font-light text-sm leading-relaxed">
                      <p className="font-medium text-white">✅ Disputes are free when handled through Rift</p>
                      <p className="text-white/70">If you file a bank or card chargeback instead of using Rift's dispute system, a $15 processing fee may apply. This fee will be refunded if you win the chargeback.</p>
                      <div className="pt-2 space-y-2 text-xs text-white/60">
                        <p><strong className="text-white/80">Fee applies when:</strong></p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          <li>You bypass Rift's dispute system and file a chargeback directly</li>
                          <li>You lose the chargeback dispute</li>
                          <li>You act in bad faith (fraud, false claims, etc.)</li>
                        </ul>
                        <p className="pt-2"><strong className="text-white/80">No fee when:</strong></p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          <li>You use Rift's dispute system (recommended)</li>
                          <li>The seller is clearly at fault</li>
                          <li>There's a system failure on Rift's part</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <PremiumButton
                variant="outline"
                onClick={onClose}
                className="flex-1"
                size="md"
              >
                Cancel
              </PremiumButton>
              <PremiumButton
                onClick={() => setStep('reason')}
                className="flex-1"
                size="md"
              >
                I Understand, Continue →
              </PremiumButton>
            </div>
          </GlassCard>
        )}

        {/* Step 1: Reason Selection */}
        {step === 'reason' && (
          <GlassCard variant="strong" className="p-4 space-y-4">
            <div className="text-center space-y-3">
              <h2 className="text-2xl font-light text-white tracking-tight bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">Reason for Dispute</h2>
              <p className="text-white/60 font-light text-sm">Please select the primary reason for opening this dispute</p>
            </div>
            
            <div className="grid gap-3 max-w-3xl mx-auto">
              {[
                { value: 'not_received', label: 'Item Not Received', icon: '📦', description: 'The item or service was never delivered', color: 'from-orange-500/20 to-red-500/20', borderColor: 'border-orange-400/30', iconBg: 'bg-gradient-to-br from-orange-500/30 to-red-500/30' },
                { value: 'not_as_described', label: 'Item Not as Described', icon: '❌', description: 'The item does not match the listing description', color: 'from-red-500/20 to-pink-500/20', borderColor: 'border-red-400/30', iconBg: 'bg-gradient-to-br from-red-500/30 to-pink-500/30' },
                { value: 'unauthorized', label: 'Unauthorized Transaction', icon: '🔒', description: 'This transaction was not authorized by me', color: 'from-yellow-500/20 to-amber-500/20', borderColor: 'border-yellow-400/30', iconBg: 'bg-gradient-to-br from-yellow-500/30 to-amber-500/30' },
                { value: 'seller_nonresponsive', label: 'Seller Not Responding', icon: '💬', description: 'Unable to communicate with the seller', color: 'from-blue-500/20 to-cyan-500/20', borderColor: 'border-blue-400/30', iconBg: 'bg-gradient-to-br from-blue-500/30 to-cyan-500/30' },
                { value: 'other', label: 'Other', icon: '📝', description: 'A different reason not listed above', color: 'from-purple-500/20 to-indigo-500/20', borderColor: 'border-purple-400/30', iconBg: 'bg-gradient-to-br from-purple-500/30 to-indigo-500/30' },
              ].map((r) => (
                <button
                  key={r.value}
                  onClick={() => handleReasonSelect(r.value)}
                  className={`group relative p-4 rounded-xl border transition-all duration-300 text-left overflow-hidden ${
                    reason === r.value
                      ? `bg-gradient-to-br ${r.color} ${r.borderColor} shadow-xl shadow-black/30 scale-[1.02]`
                      : 'bg-gradient-to-br from-white/5 to-white/3 border-white/10 hover:border-white/25 hover:bg-white/8 hover:shadow-lg hover:shadow-black/20 hover:scale-[1.01]'
                  }`}
                >
                  <div className="flex items-start gap-4 relative z-10">
                    <div className={`flex-shrink-0 w-12 h-12 rounded-xl ${r.iconBg} flex items-center justify-center border ${r.borderColor} shadow-lg transition-transform duration-300 group-hover:scale-110 ${reason === r.value ? 'scale-110' : ''}`}>
                      <span className="text-2xl">{r.icon}</span>
                    </div>
                    <div className="flex-1 space-y-1">
                      <h3 className={`text-base font-light transition-colors ${reason === r.value ? 'text-white' : 'text-white/90 group-hover:text-white'}`}>
                        {r.label}
                      </h3>
                      <p className={`text-sm font-light transition-colors leading-relaxed ${reason === r.value ? 'text-white/80' : 'text-white/50 group-hover:text-white/70'}`}>
                        {r.description}
                      </p>
                    </div>
                    {reason === r.value && (
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-green-400/30 to-emerald-400/30 flex items-center justify-center border border-green-400/50 shadow-lg shadow-green-500/30 animate-in fade-in zoom-in duration-200">
                        <svg className="w-4 h-4 text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                </button>
            ))}
          </div>

            {itemType === 'TICKETS' && eventDateTz && (
              <GlassCard variant="light" className="p-3 bg-gradient-to-br from-yellow-500/10 to-amber-500/5 border-yellow-400/30 shadow-lg shadow-yellow-500/10">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-500/30 to-amber-500/30 flex items-center justify-center border border-yellow-400/40 shadow-md">
                    <svg className="w-4 h-4 text-yellow-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-yellow-200/90 text-sm font-light leading-relaxed">
                    Note: Disputes are not allowed after the event date has passed.
                  </p>
                </div>
              </GlassCard>
            )}

            {/* Navigation */}
            <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-white/10">
              <PremiumButton
                variant="outline"
                onClick={() => setStep('resistance')}
                className="flex-1"
                size="md"
              >
                ← Back
              </PremiumButton>
            </div>
          </GlassCard>
        )}

        {/* Step 2: Cooldown Check */}
        {step === 'cooldown' && (
          <GlassCard variant="strong" className="p-4 space-y-4">
            {!canProceed ? (
              <div className="text-center space-y-3">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-white/5 border border-white/10">
                  <svg className="w-6 h-6 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <div className="space-y-3">
                  <h2 className="text-3xl font-light text-white">Cannot Proceed</h2>
                  <p className="text-white/70 font-light text-base max-w-2xl mx-auto leading-relaxed">
                    {cooldownMessage || 'You are not eligible to open a dispute at this time.'}
                  </p>
                </div>
                <PremiumButton onClick={onClose} size="md">Close</PremiumButton>
              </div>
            ) : (
              <>
                <div className="text-center space-y-3">
                  <h2 className="text-3xl font-light text-white tracking-tight">Eligibility Verification</h2>
                  <p className="text-white/60 font-light text-base">Review the information below before proceeding</p>
                </div>

                <div className="space-y-4 max-w-2xl mx-auto">
                  {[
                    ...(itemType === 'TICKETS' && eventDateTz ? [{
                      type: 'info' as const,
                      icon: '🎫',
                      text: `Event date: ${new Date(eventDateTz).toLocaleDateString()}. Disputes are not allowed after the event date.`,
                    }] : []),
                    ...(itemType === 'DIGITAL' && reason === 'not_received' ? [{
                      type: 'info' as const,
                      icon: '💾',
                      text: 'For digital goods, please ensure you have attempted to access the delivery before disputing.',
                    }] : []),
                    ...(cooldownMessage ? [{
                      type: (cooldownMessage.includes('less than') || cooldownMessage.includes('hours')) ? 'warning' as const : 'info' as const,
                      icon: cooldownMessage.includes('less than') || cooldownMessage.includes('hours') ? '⚠️' : 'ℹ️',
                      text: cooldownMessage,
                    }] : [{
                      type: 'success' as const,
                      icon: '✅',
                      text: 'You are eligible to proceed with opening a dispute.',
                    }]),
                  ].map((info, idx) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-xl border backdrop-blur-sm ${
                        info.type === 'warning'
                          ? 'border-white/20 bg-white/5'
                          : info.type === 'success'
                          ? 'border-white/20 bg-white/5'
                          : 'border-white/20 bg-white/5'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className="text-xl flex-shrink-0">{info.icon}</div>
                        <p className={`text-sm font-light flex-1 leading-relaxed ${
                          info.type === 'warning' ? 'text-white/80' : info.type === 'success' ? 'text-white/80' : 'text-white/70'
                        }`}>
                          {info.text}
                        </p>
                      </div>
                    </div>
                  ))}

                  <div className="pt-3 border-t border-white/10">
                    <p className="text-white/50 text-xs font-light text-center">
              By continuing, you acknowledge that you have reviewed this information and understand the dispute process.
            </p>
          </div>
        </div>

                {/* Navigation */}
                <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-white/10">
                  <PremiumButton
                    variant="outline"
                    onClick={() => setStep('reason')}
                    className="flex-1"
                    size="md"
                  >
                    ← Back
                  </PremiumButton>
                  <PremiumButton 
                    onClick={() => setStep('declaration')} 
                    className="flex-1" 
                    size="md"
                  >
                    Continue →
        </PremiumButton>
      </div>
              </>
            )}
          </GlassCard>
        )}

        {/* Step 3: Sworn Declaration */}
        {step === 'declaration' && (
          <GlassCard variant="strong" className="p-6 space-y-5">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-500/30">
                <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div className="space-y-1.5">
                <h2 className="text-2xl font-light text-white tracking-tight">Sworn Declaration</h2>
                <p className="text-white/60 font-light text-sm">Please confirm the truthfulness of your claim</p>
              </div>
            </div>
            
            <GlassCard variant="light" className="p-4 space-y-3 max-w-2xl mx-auto">
              <div className="space-y-3">
                <p className="text-white/80 font-light text-sm">
                  I confirm that the information provided in this dispute is truthful and accurate to the best of my knowledge.
                </p>
                
                <div className="space-y-2">
          <label className="block">
                    <span className="text-white/60 font-light text-xs mb-2 block uppercase tracking-wider">
                      Type "I CONFIRM" to proceed
            </span>
            <input
              type="text"
              value={swornText}
              onChange={(e) => handleDeclarationChange(e.target.value)}
                      placeholder="I CONFIRM"
                      className="w-full p-3 rounded-xl glass border border-white/20 text-white placeholder-white/30 font-light text-center text-base focus:outline-none focus:border-blue-400/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
          </label>

          {swornDeclaration && (
                    <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/30">
                      <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-green-300/90 font-light text-sm">Declaration confirmed</span>
                    </div>
          )}
        </div>
              </div>
            </GlassCard>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <PremiumButton
            variant="outline"
            onClick={() => setStep('cooldown')}
            className="flex-1"
            size="md"
          >
            ← Back
          </PremiumButton>
          <PremiumButton
            onClick={() => setStep('evidence')}
            disabled={!swornDeclaration}
            className="flex-1"
            size="md"
          >
            Continue to Evidence →
          </PremiumButton>
        </div>
          </GlassCard>
        )}

        {/* Step 4: Evidence + Summary */}
        {step === 'evidence' && (
          <GlassCard variant="strong" className="p-4 space-y-4">
            <div className="text-center space-y-2">
              <h2 className="text-xl font-light text-white tracking-tight">Evidence & Summary</h2>
              <p className="text-white/60 font-light text-sm">Provide detailed information and supporting evidence</p>
      </div>
            
            <div className="space-y-3 max-w-3xl mx-auto">
              <GlassCard variant="light" className="p-4 space-y-3">
          <label className="block">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white/90 font-light text-base">Summary</span>
                    <span className={`text-xs font-light ${summary.length >= 200 ? 'text-green-400' : 'text-white/40'}`}>
                      {summary.length} / 200
            </span>
                  </div>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
                    placeholder="Provide a detailed summary of the issue, including relevant dates, communications, and any other important information..."
                    rows={5}
                    className="w-full p-3 rounded-xl glass border border-white/20 text-white placeholder-white/30 font-light text-sm focus:outline-none focus:border-blue-400/50 focus:ring-2 focus:ring-blue-500/20 transition-all resize-none"
                  />
          </label>
              </GlassCard>

              <GlassCard variant="light" className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-white/90 font-light text-base">Evidence</span>
                  {['not_received', 'not_as_described'].includes(reason) && (
                    <span className="px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs text-white/80 font-light">Required</span>
                  )}
                </div>
                
                {['not_received', 'not_as_described'].includes(reason) && (
                  <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                    <p className="text-white/70 text-sm font-light leading-relaxed">
                      At least 1 file upload OR 2 text/link entries required
                    </p>
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-3">
                  <label>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileUpload}
                className="hidden"
                id="evidence-upload"
              />
                    <div className="glass border border-white/20 hover:border-blue-400/50 rounded-xl p-4 cursor-pointer transition-all group text-center space-y-2">
                      <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-500/20 group-hover:bg-blue-500/30 transition-colors">
                        <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-white/90 font-light text-sm">Upload File</p>
                        <p className="text-white/50 text-xs font-light mt-0.5">Images or PDFs</p>
                      </div>
                    </div>
              </label>
              
              <button
                onClick={handleAddTextEvidence}
                    className="glass border border-white/20 hover:border-blue-400/50 rounded-xl p-4 cursor-pointer transition-all group text-center space-y-2"
                  >
                    <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-purple-500/20 group-hover:bg-purple-500/30 transition-colors">
                      <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-white/90 font-light text-sm">Add Text/Link</p>
                      <p className="text-white/50 text-xs font-light mt-0.5">Text evidence or URLs</p>
                    </div>
              </button>
            </div>

            {evidence.length > 0 && (
                  <div className="space-y-2 pt-3 border-t border-white/10">
                    {evidence.map((ev, idx) => {
                      const requiresEvidence = ['not_received', 'not_as_described'].includes(reason)
                      const isValid = !requiresEvidence || evidence.length >= (ev.type === 'image' || ev.type === 'pdf' ? 1 : 2)
                      
                      return (
                        <div
                          key={idx}
                          className={`flex items-center justify-between p-3 rounded-xl glass border transition-all ${
                            isValid ? 'border-green-500/30 bg-green-500/5' : 'border-white/10'
                          }`}
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-lg">
                              {ev.type === 'image' ? '🖼️' : ev.type === 'pdf' ? '📄' : ev.type === 'link' ? '🔗' : '📝'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-white/90 font-light text-xs truncate">
                                {ev.file?.name || ev.text || 'Evidence'}
                              </p>
                              <p className="text-white/50 text-xs font-light capitalize">{ev.type}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveEvidence(idx)}
                            className="flex-shrink-0 ml-2 p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}

                {(() => {
                  const requiresEvidence = ['not_received', 'not_as_described'].includes(reason)
                  const hasFileEvidence = evidence.some(e => ['image', 'pdf'].includes(e.type))
                  const hasTextEvidence = evidence.some(e => ['text', 'link'].includes(e.type))
                  const evidenceValid = !requiresEvidence || hasFileEvidence || (hasTextEvidence && evidence.length >= 2)
                  
                  if (!evidenceValid && requiresEvidence) {
                    return (
                      <div className="p-4 rounded-xl bg-white/5 border border-white/20 backdrop-blur-sm">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-5 h-5 rounded-full bg-white/10 flex items-center justify-center mt-0.5">
                            <svg className="w-3 h-3 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
              </div>
                          <p className="text-white/80 text-sm font-light leading-relaxed">
                            Evidence is required for this dispute type. Please add at least 1 file OR 2 text/link entries.
                          </p>
          </div>
                      </div>
                    )
                  }
                  return null
                })()}
              </GlassCard>
        </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <PremiumButton
            variant="outline"
            onClick={() => setStep('declaration')}
            className="flex-1"
            size="md"
          >
            ← Back
          </PremiumButton>
          <PremiumButton
            onClick={() => setStep('review')}
            disabled={summary.length < 200 || (['not_received', 'not_as_described'].includes(reason) && !evidence.some(e => ['image', 'pdf'].includes(e.type)) && (!evidence.some(e => ['text', 'link'].includes(e.type)) || evidence.filter(e => ['text', 'link'].includes(e.type)).length < 2))}
            className="flex-1"
            size="md"
          >
            Review & Submit →
          </PremiumButton>
            </div>
          </GlassCard>
        )}

        {/* Step 5: Review & Submit */}
        {step === 'review' && (
          <GlassCard variant="strong" className="p-6 space-y-5">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30">
                <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="space-y-1.5">
                <h2 className="text-2xl font-light text-white tracking-tight">Review & Submit</h2>
                <p className="text-white/60 font-light text-sm">Please review your dispute information before submitting</p>
        </div>
      </div>
            
            <div className="space-y-4 max-w-3xl mx-auto">
              <div className="p-6 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm space-y-5 overflow-hidden">
                <div className="space-y-4 min-w-0">
                  <div className="pb-4 border-b border-white/10 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-2 h-2 rounded-full bg-white/40"></div>
                      <span className="text-white/60 font-light text-xs uppercase tracking-wider">Reason</span>
                    </div>
                    <p className="text-white/90 font-light text-base pl-5 leading-relaxed break-words">
                      {reason.replace(/_/g, ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                    </p>
                  </div>

                  <div className="pb-4 border-b border-white/10 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-2 h-2 rounded-full bg-white/40"></div>
                      <span className="text-white/60 font-light text-xs uppercase tracking-wider">Summary</span>
                    </div>
                    <p className="text-white/80 font-light text-sm leading-relaxed pl-5 whitespace-pre-wrap break-words overflow-wrap-anywhere max-w-full">{summary}</p>
                  </div>

          <div>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-2 h-2 rounded-full bg-white/40"></div>
                      <span className="text-white/60 font-light text-xs uppercase tracking-wider">Evidence</span>
                    </div>
                    <div className="pl-5 space-y-2">
                      {evidence.length > 0 ? (
                        evidence.map((ev, idx) => (
                          <div key={idx} className="flex items-center gap-3 text-white/70 font-light text-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-white/30"></span>
                            <span className="capitalize">{ev.type}</span>
                            <span className="text-white/50">•</span>
                            <span className="truncate">{ev.file?.name || ev.text || 'Evidence'}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-white/50 font-light text-sm italic">No evidence provided</p>
                      )}
          </div>
          </div>
          </div>
        </div>

              <GlassCard variant="light" className="p-4 border-blue-500/30 bg-blue-500/5">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center mt-0.5">
                    <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="space-y-1 flex-1">
                    <h3 className="text-white/90 font-light text-sm">What Happens Next?</h3>
                    <p className="text-blue-300/90 text-xs font-light">
                      Our team will review the timeline, delivery logs, and chat transcript. You may be contacted for more information during the review process.
                    </p>
                  </div>
                </div>
              </GlassCard>
        </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <PremiumButton
            variant="outline"
            onClick={() => setStep('evidence')}
            disabled={loading}
            className="flex-1"
            size="md"
          >
            ← Back to Edit
          </PremiumButton>
          <PremiumButton
            onClick={handleSubmit}
            disabled={loading || !disputeId}
            className="flex-1"
            size="md"
            glow
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Submitting...
              </span>
            ) : (
              'Submit Dispute →'
            )}
          </PremiumButton>
            </div>

            {!disputeId && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-center">
                <p className="text-red-300/90 text-xs font-light">
                  Dispute not initialized. Please close and try again.
                </p>
              </div>
            )}
          </GlassCard>
        )}
        </div>
      </div>
    )
  }
