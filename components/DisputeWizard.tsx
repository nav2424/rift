'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PremiumButton from './ui/PremiumButton'
import { useToast } from './ui/Toast'

interface DisputeWizardProps {
  riftId: string
  itemType: string
  eventDateTz?: Date | null
  onClose: () => void
}

type WizardStep = 'resistance' | 'reason' | 'cooldown' | 'declaration' | 'evidence' | 'review'

export default function DisputeWizard({ riftId, itemType, eventDateTz, onClose }: DisputeWizardProps) {
  const router = useRouter()
  const { showToast } = useToast()
  const [step, setStep] = useState<WizardStep>('resistance')
  const [loading, setLoading] = useState(false)
  const [disputeId, setDisputeId] = useState<string | null>(null)
  
  // Form state
  const [reason, setReason] = useState<string>('')
  const [summary, setSummary] = useState('')
  const [swornDeclaration, setSwornDeclaration] = useState(false)
  const [swornText, setSwornText] = useState('')
  const [evidence, setEvidence] = useState<Array<{ type: string; file?: File; text?: string; url?: string }>>([])
  const [cooldownMessage, setCooldownMessage] = useState<string | null>(null)
  const [canProceed, setCanProceed] = useState(false)

  // Initialize dispute on mount
  useEffect(() => {
    const initDispute = async () => {
      try {
        // Log intent
        await fetch(`/api/rifts/${riftId}/dispute/intent`, { method: 'POST' })

        // Create or get dispute
        const response = await fetch(`/api/rifts/${riftId}/dispute`, { method: 'POST' })
        const data = await response.json()
        
        if (data.disputeId) {
          setDisputeId(data.disputeId)
        }
      } catch (error) {
        console.error('Init dispute error:', error)
        showToast('Failed to initialize dispute', 'error')
        onClose()
      }
    }

    initDispute()
  }, [riftId, onClose, showToast])

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
              setCanProceed(true) // Allow but warn
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
      // This would need to check events, but for now allow
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
      setEvidence([...evidence, { type: file.type.startsWith('image/') ? 'image' : 'pdf', file }])
    }
  }

  const handleAddTextEvidence = () => {
    const text = prompt('Enter text evidence or link:')
    if (text) {
      setEvidence([...evidence, { type: text.startsWith('http') ? 'link' : 'text', text }])
    }
  }

  const handleSubmit = async () => {
    if (!disputeId) {
      showToast('Dispute not initialized', 'error')
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
          // Upload file to storage
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

  // Step 0: Soft Resistance
  if (step === 'resistance') {
    return (
      <div className="p-6 space-y-6">
        <h2 className="text-2xl font-light text-white">Open a Dispute</h2>
        
        <div className="space-y-4 text-white/80 font-light">
          <p>Disputes take time and require evidence.</p>
          <p>Most issues resolve without a dispute.</p>
          <p className="text-yellow-400/80">False claims may result in account restrictions.</p>
        </div>

        <div className="flex gap-3">
          <PremiumButton
            onClick={() => setStep('reason')}
            className="flex-1"
          >
            Continue
          </PremiumButton>
          <PremiumButton
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            Cancel
          </PremiumButton>
        </div>
      </div>
    )
  }

  // Step 1: Reason Selection
  if (step === 'reason') {
    const reasons = [
      { value: 'not_received', label: 'Item not received' },
      { value: 'not_as_described', label: 'Item not as described' },
      { value: 'unauthorized', label: 'Unauthorized transaction' },
      { value: 'seller_nonresponsive', label: 'Seller not responding' },
      { value: 'other', label: 'Other' },
    ]

    return (
      <div className="p-6 space-y-6">
        <h2 className="text-2xl font-light text-white">Reason for Dispute</h2>
        
        <div className="space-y-2">
          {reasons.map((r) => (
            <button
              key={r.value}
              onClick={() => handleReasonSelect(r.value)}
              className="w-full p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-left text-white/90 font-light transition-colors"
            >
              {r.label}
            </button>
          ))}
        </div>

        {itemType === 'TICKETS' && eventDateTz && (
          <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-400/80 text-sm">
            Note: Disputes are not allowed after the event date.
          </div>
        )}
      </div>
    )
  }

  // Step 2: Cooldown Check
  if (step === 'cooldown') {
    if (!canProceed) {
      return (
        <div className="p-6 space-y-6">
          <h2 className="text-2xl font-light text-white">Cannot Proceed</h2>
          <p className="text-white/80 font-light">{cooldownMessage || 'You are not eligible to open a dispute at this time.'}</p>
          <PremiumButton onClick={onClose}>Close</PremiumButton>
        </div>
      )
    }

    // Build eligibility information to display
    const eligibilityInfo = []
    
    if (itemType === 'TICKETS' && eventDateTz) {
      const eventDate = new Date(eventDateTz)
      const now = new Date()
      const hoursUntilEvent = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60)
      
      if (hoursUntilEvent > 0 && hoursUntilEvent <= 6) {
        eligibilityInfo.push({
          type: 'warning',
          text: `Event is in ${Math.round(hoursUntilEvent)} hours. Please provide urgent evidence if opening a dispute.`,
        })
      } else if (hoursUntilEvent > 0) {
        eligibilityInfo.push({
          type: 'info',
          text: `Event date: ${eventDate.toLocaleDateString()}. Disputes are not allowed after the event date.`,
        })
      }
    }

    if (itemType === 'DIGITAL' && reason === 'not_received') {
      eligibilityInfo.push({
        type: 'info',
        text: 'For digital goods, please ensure you have attempted to access the delivery before disputing.',
      })
    }

    if (cooldownMessage) {
      eligibilityInfo.push({
        type: cooldownMessage.includes('less than') ? 'warning' : 'info',
        text: cooldownMessage,
      })
    }

    // Default eligibility message if no specific info
    if (eligibilityInfo.length === 0) {
      eligibilityInfo.push({
        type: 'info',
        text: 'You are eligible to proceed with opening a dispute.',
      })
    }

    return (
      <div className="p-6 space-y-6">
        <h2 className="text-2xl font-light text-white">Eligibility Check</h2>
        
        <div className="space-y-4">
          <p className="text-white/80 font-light text-sm">
            Please review the information below before proceeding:
          </p>
          
          <div className="space-y-3">
            {eligibilityInfo.map((info, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-xl border ${
                  info.type === 'warning'
                    ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400/80'
                    : 'bg-blue-500/10 border-blue-500/30 text-blue-400/80'
                }`}
              >
                <div className="flex items-start gap-3">
                  {info.type === 'warning' ? (
                    <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  <p className="text-sm font-light">{info.text}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-white/10">
            <p className="text-white/60 text-xs font-light">
              By continuing, you acknowledge that you have reviewed this information and understand the dispute process.
            </p>
          </div>
        </div>

        <PremiumButton onClick={() => setStep('declaration')} className="w-full">
          Continue
        </PremiumButton>
      </div>
    )
  }

  // Step 3: Sworn Declaration
  if (step === 'declaration') {
    return (
      <div className="p-6 space-y-6">
        <h2 className="text-2xl font-light text-white">Sworn Declaration</h2>
        
        <div className="space-y-4">
          <label className="block">
            <span className="text-white/80 font-light mb-2 block">
              I confirm this claim is truthful to the best of my knowledge.
            </span>
            <input
              type="text"
              value={swornText}
              onChange={(e) => handleDeclarationChange(e.target.value)}
              placeholder="Type: I CONFIRM"
              className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 font-light focus:outline-none focus:border-white/30"
            />
          </label>

          {swornDeclaration && (
            <p className="text-green-400/80 text-sm">✓ Declaration confirmed</p>
          )}
        </div>

        <div className="flex gap-3">
          <PremiumButton
            onClick={() => setStep('evidence')}
            disabled={!swornDeclaration}
            className="flex-1"
          >
            Continue
          </PremiumButton>
          <PremiumButton
            variant="outline"
            onClick={() => setStep('reason')}
            className="flex-1"
          >
            Back
          </PremiumButton>
        </div>
      </div>
    )
  }

  // Step 4: Evidence + Summary
  if (step === 'evidence') {
    const requiresEvidence = ['not_received', 'not_as_described'].includes(reason)
    const hasFileEvidence = evidence.some(e => ['image', 'pdf'].includes(e.type))
    const hasTextEvidence = evidence.some(e => ['text', 'link'].includes(e.type))
    const evidenceValid = !requiresEvidence || hasFileEvidence || (hasTextEvidence && evidence.length >= 2)

    return (
      <div className="p-6 space-y-6">
        <h2 className="text-2xl font-light text-white">Evidence & Summary</h2>
        
        <div className="space-y-4">
          <label className="block">
            <span className="text-white/80 font-light mb-2 block">
              Summary (minimum 200 characters)
            </span>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Provide a detailed summary of the issue..."
              rows={6}
              className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 font-light focus:outline-none focus:border-white/30 resize-none"
            />
            <p className="text-white/50 text-xs mt-1">
              {summary.length} / 200 characters
            </p>
          </label>

          <div>
            <span className="text-white/80 font-light mb-2 block">Evidence</span>
            {requiresEvidence && (
              <p className="text-white/60 text-sm mb-3">
                Required: At least 1 file upload OR 2 text/link entries
              </p>
            )}
            
            <div className="space-y-2">
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileUpload}
                className="hidden"
                id="evidence-upload"
              />
              <label
                htmlFor="evidence-upload"
                className="block p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white/80 font-light text-center cursor-pointer transition-colors"
              >
                Upload File (Image/PDF)
              </label>
              
              <button
                onClick={handleAddTextEvidence}
                className="w-full p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white/80 font-light transition-colors"
              >
                Add Text/Link Evidence
              </button>
            </div>

            {evidence.length > 0 && (
              <div className="mt-4 space-y-1">
                {evidence.map((ev, idx) => (
                  <div key={idx} className="p-2 rounded bg-white/5 text-white/70 text-sm">
                    {ev.type}: {ev.file?.name || ev.text || 'Evidence'}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <PremiumButton
            onClick={() => setStep('review')}
            disabled={summary.length < 200 || !evidenceValid}
            className="flex-1"
          >
            Review
          </PremiumButton>
          <PremiumButton
            variant="outline"
            onClick={() => setStep('declaration')}
            className="flex-1"
          >
            Back
          </PremiumButton>
        </div>
      </div>
    )
  }

  // Step 5: Review & Submit
  if (step === 'review') {
    return (
      <div className="p-6 space-y-6">
        <h2 className="text-2xl font-light text-white">Review & Submit</h2>
        
        <div className="space-y-4 text-white/80 font-light text-sm">
          <div>
            <span className="text-white/60">Reason:</span> {reason.replace(/_/g, ' ')}
          </div>
          <div>
            <span className="text-white/60">Summary:</span>
            <p className="mt-1">{summary}</p>
          </div>
          <div>
            <span className="text-white/60">Evidence:</span> {evidence.length} item(s)
          </div>
        </div>

        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400/80 text-sm">
          We'll review the timeline, delivery logs, and chat transcript.
          You may be asked for more information.
        </div>

        <div className="flex gap-3">
          <PremiumButton
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1"
            glow
          >
            {loading ? 'Submitting...' : 'Submit Dispute'}
          </PremiumButton>
          <PremiumButton
            variant="outline"
            onClick={() => setStep('evidence')}
            disabled={loading}
            className="flex-1"
          >
            Back
          </PremiumButton>
        </div>
      </div>
    )
  }

  return null
}

