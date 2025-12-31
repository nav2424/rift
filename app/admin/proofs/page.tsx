'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import GlassCard from '@/components/ui/GlassCard'
import PremiumButton from '@/components/ui/PremiumButton'

interface Proof {
  id: string
  proofType: string
  proofPayload: any
  uploadedFiles: string[]
  status: 'PENDING' | 'VALID' | 'REJECTED'
  submittedAt: string
  validatedAt: string | null
  validatedBy: string | null
  rejectionReason: string | null
  rift: {
    id: string
    riftNumber: number | null
    itemTitle: string
    itemType: string
    subtotal: number | null
    currency: string
    status: string
    buyer: {
      id: string
      name: string | null
      email: string
    }
    seller: {
      id: string
      name: string | null
      email: string
    }
  }
}

export default function AdminProofsPage() {
  const router = useRouter()
  const [proofs, setProofs] = useState<Proof[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'PENDING' | 'VALID' | 'REJECTED' | 'ALL'>('PENDING')
  const [selectedProof, setSelectedProof] = useState<Proof | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [adminNotes, setAdminNotes] = useState('')

  useEffect(() => {
    fetchProofs()
  }, [filter])

  const fetchProofs = async () => {
    try {
      setLoading(true)
      const status = filter === 'ALL' ? '' : filter
      const url = status 
        ? `/api/admin/proofs?status=${status}`
        : '/api/admin/proofs'
      
      const response = await fetch(url, {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to fetch proofs')
      }

      const data = await response.json()
      setProofs(data.proofs || [])
    } catch (error) {
      console.error('Error fetching proofs:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (proofId: string) => {
    if (!confirm('Are you sure you want to approve this proof?')) return

    setActionLoading(proofId)
    try {
      const response = await fetch(`/api/admin/proofs/${proofId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          adminNotes: adminNotes || undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        alert(error.error || 'Failed to approve proof')
        return
      }

      // Refresh proofs list
      await fetchProofs()
      setSelectedProof(null)
      setAdminNotes('')
      alert('Proof approved successfully')
    } catch (error) {
      console.error('Error approving proof:', error)
      alert('Failed to approve proof')
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async (proofId: string, reason?: string) => {
    const reasonToUse = reason || rejectionReason.trim()
    if (!reasonToUse) {
      const inputReason = prompt('Enter rejection reason (required):')
      if (!inputReason || !inputReason.trim()) {
        alert('Rejection reason is required')
        return
      }
      setRejectionReason(inputReason.trim())
      await handleReject(proofId, inputReason.trim())
      return
    }

    if (!confirm('Are you sure you want to reject this proof?')) return

    setActionLoading(proofId)
    try {
      const response = await fetch(`/api/admin/proofs/${proofId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          rejectionReason: reasonToUse,
          adminNotes: adminNotes || undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        alert(error.error || 'Failed to reject proof')
        return
      }

      // Refresh proofs list
      await fetchProofs()
      setSelectedProof(null)
      setRejectionReason('')
      setAdminNotes('')
      alert('Proof rejected successfully')
    } catch (error) {
      console.error('Error rejecting proof:', error)
      alert('Failed to reject proof')
    } finally {
      setActionLoading(null)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'VALID':
        return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'REJECTED':
        return 'bg-red-500/20 text-red-400 border-red-500/30'
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    }
  }

  const formatProofPayload = (payload: any, proofType: string) => {
    if (!payload) return 'No data provided'
    
    if (proofType === 'PHYSICAL') {
      return (
        <div className="space-y-2">
          {payload.trackingNumber && (
            <p><span className="text-white/50">Tracking:</span> {payload.trackingNumber}</p>
          )}
          {payload.carrier && (
            <p><span className="text-white/50">Carrier:</span> {payload.carrier}</p>
          )}
          {payload.shippingAddress && (
            <p><span className="text-white/50">Address:</span> {payload.shippingAddress}</p>
          )}
        </div>
      )
    }
    
    if (proofType === 'DIGITAL') {
      return (
        <div className="space-y-2">
          {payload.downloadLink && (
            <p><span className="text-white/50">Download Link:</span> <a href={payload.downloadLink} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{payload.downloadLink}</a></p>
          )}
          {payload.licenseKey && (
            <p><span className="text-white/50">License Key:</span> {payload.licenseKey}</p>
          )}
          {payload.fileHash && (
            <p><span className="text-white/50">File Hash:</span> <code className="text-xs">{payload.fileHash}</code></p>
          )}
        </div>
      )
    }
    
    if (proofType === 'SERVICE') {
      return (
        <div className="space-y-2">
          {payload.completionConfirmation && (
            <p><span className="text-white/50">Completion:</span> {payload.completionConfirmation}</p>
          )}
          {payload.serviceDate && (
            <p><span className="text-white/50">Service Date:</span> {payload.serviceDate}</p>
          )}
        </div>
      )
    }

    return <pre className="text-xs text-white/60">{JSON.stringify(payload, null, 2)}</pre>
  }

  if (loading) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-black flex items-center justify-center">
        <div className="text-white/60 font-light">Loading proofs...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-black">
      {/* Subtle grid background */}
      <div className="fixed inset-0 opacity-[0.02] pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
        backgroundSize: '50px 50px'
      }} />
      
      {/* Minimal floating elements */}
      <div className="fixed top-20 left-10 w-96 h-96 bg-white/[0.02] rounded-full blur-3xl float pointer-events-none" />
      <div className="fixed bottom-20 right-10 w-[500px] h-[500px] bg-white/[0.01] rounded-full blur-3xl float pointer-events-none" style={{ animationDelay: '2s' }} />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-5xl md:text-6xl font-light text-white mb-2 tracking-tight">
                Proof Review
              </h1>
              <p className="text-white/60 font-light">Review and approve/reject proof submissions</p>
            </div>
            <button
              onClick={() => router.push('/admin')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white/70 hover:text-white font-light transition-all duration-200 group flex-shrink-0 mt-1"
            >
              <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Admin
            </button>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2 mb-6">
            {(['PENDING', 'VALID', 'REJECTED', 'ALL'] as const).map((status) => {
              const count = status === 'ALL' 
                ? proofs.length 
                : proofs.filter(p => p.status === status).length
              return (
                <button
                  key={status}
                  onClick={() => setFilter(status)}
                  className={`px-4 py-2 rounded-xl font-light text-sm transition-colors ${
                    filter === status
                      ? 'bg-white/10 text-white border border-white/20'
                      : 'bg-white/5 text-white/60 hover:bg-white/8 border border-white/10'
                  }`}
                >
                  {status} {count > 0 && `(${count})`}
                </button>
              )
            })}
          </div>
        </div>

        {/* Proofs List */}
        {proofs.length === 0 ? (
          <GlassCard>
            <div className="p-8 text-center">
              <p className="text-white/60 font-light">No proofs found with status: {filter}</p>
            </div>
          </GlassCard>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Proof List */}
            <div className="lg:col-span-2 space-y-4">
              {proofs.map((proof) => (
                <GlassCard
                  key={proof.id}
                  className={`cursor-pointer transition-all ${
                    selectedProof?.id === proof.id ? 'border-white/30 bg-white/5' : 'hover:bg-white/5'
                  }`}
                  onClick={() => setSelectedProof(proof)}
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-light text-white mb-2">
                          Rift #{proof.rift.riftNumber || 'N/A'}: {proof.rift.itemTitle}
                        </h3>
                        <p className="text-sm text-white/60 font-light">
                          {proof.rift.itemType} • {proof.rift.currency} {proof.rift.subtotal?.toFixed(2) || '0.00'}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-lg text-xs font-light border ${getStatusColor(proof.status)}`}>
                        {proof.status === 'PENDING' ? 'Under Review' : 
                         proof.status === 'VALID' ? 'Approved' :
                         proof.status === 'REJECTED' ? 'Rejected' :
                         proof.status}
                      </span>
                    </div>

                    <div className="space-y-2 text-sm text-white/70 font-light">
                      <p><span className="text-white/50">Seller:</span> {proof.rift.seller.name || proof.rift.seller.email}</p>
                      <p><span className="text-white/50">Buyer:</span> {proof.rift.buyer.name || proof.rift.buyer.email}</p>
                      <p><span className="text-white/50">Submitted:</span> {new Date(proof.submittedAt).toLocaleString()}</p>
                      {proof.validatedAt && (
                        <p><span className="text-white/50">Validated:</span> {new Date(proof.validatedAt).toLocaleString()}</p>
                      )}
                      {proof.rejectionReason && (
                        <p><span className="text-white/50">Rejection Reason:</span> {proof.rejectionReason}</p>
                      )}
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>

            {/* Proof Detail Panel */}
            <div className="lg:col-span-1">
              {selectedProof ? (
                <GlassCard className="sticky top-4">
                  <div className="p-6">
                    <h2 className="text-xl font-light text-white mb-6">Proof Details</h2>

                    {/* Proof Info */}
                    <div className="space-y-4 mb-6">
                      <div>
                        <p className="text-xs text-white/50 font-light uppercase mb-1">Proof Type</p>
                        <p className="text-white font-light">{selectedProof.proofType}</p>
                      </div>

                      <div>
                        <p className="text-xs text-white/50 font-light uppercase mb-2">Proof Data</p>
                        <div className="bg-white/5 rounded-lg p-4 text-sm text-white/80 font-light">
                          {formatProofPayload(selectedProof.proofPayload, selectedProof.proofType)}
                        </div>
                      </div>

                      {selectedProof.uploadedFiles && selectedProof.uploadedFiles.length > 0 && (
                        <div>
                          <p className="text-xs text-white/50 font-light uppercase mb-2">Uploaded Files</p>
                          <div className="space-y-2">
                            {selectedProof.uploadedFiles.map((file, idx) => (
                              <a
                                key={idx}
                                href={file}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block text-blue-400 hover:text-blue-300 text-sm font-light break-all"
                              >
                                View File {idx + 1} →
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      <div>
                        <p className="text-xs text-white/50 font-light uppercase mb-1">Rift Status</p>
                        <p className="text-white font-light">{selectedProof.rift.status}</p>
                      </div>

                      <div>
                        <p className="text-xs text-white/50 font-light uppercase mb-1">View Rift</p>
                        <a
                          href={`/rifts/${selectedProof.rift.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 text-sm font-light"
                        >
                          Open Rift Details →
                        </a>
                      </div>
                    </div>

                    {/* Actions for PENDING proofs */}
                    {selectedProof.status === 'PENDING' && (
                      <div className="space-y-4 pt-6 border-t border-white/10">
                        <div>
                          <label className="block text-xs text-white/50 font-light uppercase mb-2">
                            Admin Notes (Optional)
                          </label>
                          <textarea
                            value={adminNotes}
                            onChange={(e) => setAdminNotes(e.target.value)}
                            placeholder="Add any notes about this review..."
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/30 font-light text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400/40 transition-all resize-none"
                            rows={3}
                          />
                        </div>

                        <div className="flex gap-3">
                          <PremiumButton
                            onClick={() => handleApprove(selectedProof.id)}
                            disabled={actionLoading === selectedProof.id}
                            className="flex-1"
                            glow
                          >
                            {actionLoading === selectedProof.id ? 'Approving...' : 'Approve'}
                          </PremiumButton>
                          <PremiumButton
                            variant="outline"
                            onClick={() => handleReject(selectedProof.id)}
                            disabled={actionLoading === selectedProof.id}
                            className="flex-1"
                          >
                            {actionLoading === selectedProof.id ? 'Rejecting...' : 'Reject'}
                          </PremiumButton>
                        </div>
                      </div>
                    )}

                    {/* Show rejection reason if rejected */}
                    {selectedProof.status === 'REJECTED' && selectedProof.rejectionReason && (
                      <div className="pt-6 border-t border-white/10">
                        <p className="text-xs text-white/50 font-light uppercase mb-2">Rejection Reason</p>
                        <p className="text-red-400 text-sm font-light">{selectedProof.rejectionReason}</p>
                      </div>
                    )}
                  </div>
                </GlassCard>
              ) : (
                <GlassCard>
                  <div className="p-6 text-center">
                    <p className="text-white/60 font-light">Select a proof to review</p>
                  </div>
                </GlassCard>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
