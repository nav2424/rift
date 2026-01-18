'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import GlassCard from './ui/GlassCard'
import PremiumButton from './ui/PremiumButton'
import { useToast } from './ui/Toast'
import { useRouter } from 'next/navigation'

interface InvoiceItem {
  id: string
  name: string
  description?: string | null
  quantity: number
  unit_price: number
  amount: number
}

interface Invoice {
  id: string
  invoice_number: string
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'void'
  currency: string
  subtotal: number
  tax: number
  total: number
  due_date: string | null
  issued_at: string | null
  sent_at: string | null
  paid_at: string | null
  buyer_name: string | null
  buyer_email: string
  notes: string | null
  payment_url: string | null
  pdf_url: string | null
  invoice_items: InvoiceItem[]
}

interface InvoiceCardProps {
  riftId: string
  isSeller: boolean
  currency: string
}

export default function InvoiceCard({ riftId, isSeller, currency }: InvoiceCardProps) {
  const { data: session } = useSession()
  const { showToast } = useToast()
  const router = useRouter()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [sending, setSending] = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState(false)

  useEffect(() => {
    if (isSeller) {
      fetchInvoice()
    }
  }, [riftId, isSeller])

  const fetchInvoice = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/rifts/${riftId}/invoice`, {
        credentials: 'include',
      })
      if (response.status === 404) {
        // No invoice exists yet
        setInvoice(null)
      } else if (!response.ok) {
        // If we get a 400 error saying invoice already exists, try to fetch it by ID
        if (response.status === 400) {
          const error = await response.json().catch(() => ({}))
          if (error.error && error.error.includes('already exists')) {
            // Invoice exists but we couldn't fetch it via rift ID
            // This shouldn't happen, but let's handle it gracefully
            console.warn('Invoice exists but could not be fetched')
            setInvoice(null) // Show create button, but it will handle the "already exists" case
          } else {
            throw new Error('Failed to fetch invoice')
          }
        } else {
          throw new Error('Failed to fetch invoice')
        }
      } else {
        const data = await response.json()
        setInvoice(data)
      }
    } catch (error) {
      console.error('Error fetching invoice:', error)
      // Don't show error toast on initial load - just set invoice to null
      // This allows the user to try creating an invoice
      setInvoice(null)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateInvoice = async () => {
    setCreating(true)
    try {
      const response = await fetch(`/api/rifts/${riftId}/invoice`, {
        method: 'POST',
        credentials: 'include',
      })

      if (!response.ok) {
        const error = await response.json()
        
        // If invoice already exists, fetch it instead of showing error
        if (error.error && error.error.includes('already exists')) {
          showToast('Invoice already exists. Loading...', 'info')
          await fetchInvoice() // Fetch the existing invoice
          return
        }
        
        throw new Error(error.error || 'Failed to create invoice')
      }

      const data = await response.json()
      setInvoice(data)
      showToast('Invoice created successfully', 'success')
    } catch (error: any) {
      console.error('Error creating invoice:', error)
      showToast(error.message || 'Failed to create invoice', 'error')
    } finally {
      setCreating(false)
    }
  }

  const handleGeneratePdf = async () => {
    if (!invoice) return

    setGeneratingPdf(true)
    try {
      const response = await fetch(`/api/invoices/${invoice.id}/pdf`, {
        method: 'POST',
        credentials: 'include',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate PDF')
      }

      await fetchInvoice() // Refresh invoice to get PDF URL
      showToast('PDF generated successfully', 'success')
    } catch (error: any) {
      console.error('Error generating PDF:', error)
      showToast(error.message || 'Failed to generate PDF', 'error')
    } finally {
      setGeneratingPdf(false)
    }
  }

  const handleSendInvoice = async () => {
    if (!invoice) return

    if (!confirm('Send this invoice to the buyer? An email will be sent with a secure link to view the invoice.')) {
      return
    }

    setSending(true)
    try {
      const response = await fetch(`/api/invoices/${invoice.id}/send`, {
        method: 'POST',
        credentials: 'include',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to send invoice')
      }

      await fetchInvoice() // Refresh invoice to get updated status
      showToast('Invoice sent successfully', 'success')
    } catch (error: any) {
      console.error('Error sending invoice:', error)
      showToast(error.message || 'Failed to send invoice', 'error')
    } finally {
      setSending(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const statusColors: Record<string, string> = {
    draft: 'bg-white/20 text-white/80',
    sent: 'bg-blue-500/20 text-blue-400',
    paid: 'bg-emerald-500/20 text-emerald-400',
    overdue: 'bg-red-500/20 text-red-400',
    void: 'bg-white/10 text-white/40',
  }

  if (!isSeller) {
    // Buyers can't see invoice management, but could potentially see invoice if they have the link
    return null
  }

  if (loading) {
    return (
      <GlassCard className="p-8">
        <div className="text-white/60 font-light">Loading invoice...</div>
      </GlassCard>
    )
  }

  if (!invoice) {
    return (
      <GlassCard className="p-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-sm font-light text-white/60 mb-2 tracking-wider uppercase">Invoice</h2>
            <p className="text-white/80 font-light">Create a professional invoice for this service transaction</p>
          </div>
        </div>

        <button
          onClick={handleCreateInvoice}
          disabled={creating}
          className="w-full rounded-xl bg-white px-6 py-3 text-sm font-medium text-black hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
        >
          {creating ? 'Creating Invoice...' : 'Create Invoice'}
        </button>
      </GlassCard>
    )
  }

  const canEdit = invoice.status === 'draft' || invoice.status === 'sent'
  const canSend = invoice.status === 'draft'
  const isPaid = invoice.status === 'paid'

  return (
    <GlassCard className="p-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-sm font-light text-white/60 tracking-wider uppercase">Invoice</h2>
            <span
              className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${statusColors[invoice.status] || statusColors.draft}`}
            >
              {invoice.status.toUpperCase()}
            </span>
          </div>
          <p className="text-white font-light text-lg">#{invoice.invoice_number}</p>
        </div>
      </div>

      {/* Invoice Summary */}
      <div className="space-y-4 mb-6">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-white/60 mb-1">Total</p>
            <p className="text-white font-light text-xl">{formatCurrency(invoice.total)}</p>
          </div>
          {invoice.due_date && (
            <div>
              <p className="text-white/60 mb-1">Due Date</p>
              <p className="text-white/80">{formatDate(invoice.due_date)}</p>
            </div>
          )}
        </div>

        {invoice.sent_at && (
          <div className="text-sm">
            <p className="text-white/60 mb-1">Sent</p>
            <p className="text-white/80">{formatDate(invoice.sent_at)}</p>
          </div>
        )}

        {isPaid && invoice.paid_at && (
          <div className="text-sm">
            <p className="text-emerald-400 mb-1">Paid</p>
            <p className="text-white/80">{formatDate(invoice.paid_at)}</p>
          </div>
        )}
      </div>

      {/* Invoice Items Preview */}
      {invoice.invoice_items && invoice.invoice_items.length > 0 && (
        <div className="mb-6 p-4 bg-white/5 rounded-lg">
          <p className="text-white/60 text-xs mb-2 uppercase tracking-wider">Items</p>
          <div className="space-y-2">
            {invoice.invoice_items.slice(0, 3).map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-white/80">{item.name}</span>
                <span className="text-white/60">{formatCurrency(item.amount)}</span>
              </div>
            ))}
            {invoice.invoice_items.length > 3 && (
              <p className="text-white/60 text-xs pt-2">
                +{invoice.invoice_items.length - 3} more items
              </p>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        {canSend && (
          <button
            onClick={handleSendInvoice}
            disabled={sending}
            className="flex-1 rounded-xl bg-white px-6 py-3 text-sm font-medium text-black hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
          >
            {sending ? 'Sending...' : 'Send Invoice'}
          </button>
        )}

        {!invoice.pdf_url && (
          <button
            onClick={handleGeneratePdf}
            disabled={generatingPdf}
            className="flex-1 rounded-xl glass-soft px-6 py-3 text-sm font-medium text-white/85 hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
          >
            {generatingPdf ? 'Generating...' : 'Generate PDF'}
          </button>
        )}

        {invoice.pdf_url && (
          <a
            href={invoice.pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-xl glass-soft px-6 py-3 text-sm font-medium text-white/85 hover:text-white transition text-center min-h-[44px] flex items-center justify-center"
          >
            Download PDF
          </a>
        )}

        {canEdit && (
          <button
            onClick={() => router.push(`/rifts/${riftId}/invoice/edit`)}
            className="flex-1 rounded-xl glass-soft px-6 py-3 text-sm font-medium text-white/85 hover:text-white transition min-h-[44px]"
          >
            Edit Invoice
          </button>
        )}
      </div>

      {/* Info */}
      {invoice.status === 'sent' && (
        <p className="text-white/40 text-xs mt-4">
          Invoice has been sent to {invoice.buyer_email}
        </p>
      )}
    </GlassCard>
  )
}
