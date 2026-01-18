'use client'

import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import GlassCard from '@/components/ui/GlassCard'

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

export default function PublicInvoicePage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const invoiceId = params?.invoiceId as string
  const token = searchParams?.get('token')

  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!invoiceId || !token) {
      setError('Invalid invoice link')
      setLoading(false)
      return
    }

    const loadInvoice = async () => {
      try {
        const response = await fetch(`/api/invoices/${invoiceId}/public?token=${token}`)
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to load invoice')
        }

        const data = await response.json()
        setInvoice(data)
      } catch (err: any) {
        console.error('Error loading invoice:', err)
        setError(err.message || 'Failed to load invoice')
      } finally {
        setLoading(false)
      }
    }

    loadInvoice()
  }, [invoiceId, token])

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white/60 font-light">Loading invoice...</div>
      </div>
    )
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <GlassCard className="p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-light text-white mb-4">Invoice Not Found</h1>
          <p className="text-white/60 mb-6">{error || 'The invoice could not be loaded.'}</p>
          <Link
            href="/"
            className="inline-block rounded-xl bg-white px-6 py-3 text-sm font-medium text-black hover:opacity-90 transition"
          >
            Go to Home
          </Link>
        </GlassCard>
      </div>
    )
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: invoice.currency || 'USD',
    }).format(amount)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
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

  const isPaid = invoice.status === 'paid'
  const isOverdue = invoice.status === 'overdue'

  return (
    <div className="min-h-screen bg-black py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block mb-4">
            <h1 className="text-2xl font-light text-white">Rift</h1>
          </Link>
        </div>

        <GlassCard className="p-8 md:p-12">
          {/* Invoice Header */}
          <div className="flex flex-col md:flex-row md:items-start md:justify-between mb-8 pb-8 border-b border-white/10">
            <div>
              <h1 className="text-3xl font-light text-white mb-2">Invoice</h1>
              <p className="text-white/60 text-sm">#{invoice.invoice_number}</p>
            </div>
            <div className="mt-4 md:mt-0 text-right">
              <div
                className={`inline-block px-4 py-2 rounded-full text-sm font-medium ${statusColors[invoice.status] || statusColors.draft}`}
              >
                {invoice.status.toUpperCase()}
              </div>
              {invoice.issued_at && (
                <p className="text-white/60 text-sm mt-2">
                  Issued: {formatDate(invoice.issued_at)}
                </p>
              )}
              {invoice.due_date && (
                <p className={`text-sm mt-1 ${isOverdue ? 'text-red-400' : 'text-white/60'}`}>
                  Due: {formatDate(invoice.due_date)}
                </p>
              )}
            </div>
          </div>

          {/* Buyer Info */}
          <div className="mb-8">
            <h2 className="text-sm font-light text-white/60 mb-2 uppercase tracking-wider">
              Bill To
            </h2>
            <p className="text-white font-light">
              {invoice.buyer_name || invoice.buyer_email}
            </p>
            {invoice.buyer_name && (
              <p className="text-white/60 text-sm">{invoice.buyer_email}</p>
            )}
          </div>

          {/* Invoice Items */}
          <div className="mb-8">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 text-sm font-light text-white/60 uppercase tracking-wider">
                    Item
                  </th>
                  <th className="text-right py-3 text-sm font-light text-white/60 uppercase tracking-wider">
                    Quantity
                  </th>
                  <th className="text-right py-3 text-sm font-light text-white/60 uppercase tracking-wider">
                    Unit Price
                  </th>
                  <th className="text-right py-3 text-sm font-light text-white/60 uppercase tracking-wider">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {invoice.invoice_items.map((item) => (
                  <tr key={item.id} className="border-b border-white/5">
                    <td className="py-4">
                      <div className="text-white font-light">{item.name}</div>
                      {item.description && (
                        <div className="text-white/60 text-sm mt-1">{item.description}</div>
                      )}
                    </td>
                    <td className="text-right py-4 text-white/80">{item.quantity}</td>
                    <td className="text-right py-4 text-white/80">
                      {formatCurrency(item.unit_price)}
                    </td>
                    <td className="text-right py-4 text-white font-light">
                      {formatCurrency(item.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end mb-8">
            <div className="w-full md:w-64 space-y-3">
              <div className="flex justify-between text-white/60">
                <span>Subtotal</span>
                <span>{formatCurrency(invoice.subtotal)}</span>
              </div>
              {invoice.tax > 0 && (
                <div className="flex justify-between text-white/60">
                  <span>Tax</span>
                  <span>{formatCurrency(invoice.tax)}</span>
                </div>
              )}
              <div className="flex justify-between text-white text-xl font-light pt-3 border-t border-white/10">
                <span>Total</span>
                <span>{formatCurrency(invoice.total)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="mb-8 p-4 bg-white/5 rounded-lg">
              <h3 className="text-sm font-light text-white/60 mb-2 uppercase tracking-wider">
                Notes
              </h3>
              <p className="text-white/80 whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4 pt-8 border-t border-white/10">
            {invoice.payment_url && !isPaid && (
              <a
                href={invoice.payment_url}
                className="flex-1 rounded-xl bg-white px-6 py-3 text-center text-sm font-medium text-black hover:opacity-90 transition"
              >
                Pay Now
              </a>
            )}
            {invoice.pdf_url && (
              <a
                href={invoice.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 rounded-xl glass-soft px-6 py-3 text-center text-sm font-medium text-white/85 hover:text-white transition"
              >
                Download PDF
              </a>
            )}
          </div>

          {isPaid && invoice.paid_at && (
            <div className="mt-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
              <p className="text-emerald-400 text-sm text-center">
                ✓ Payment received on {formatDate(invoice.paid_at)}
              </p>
            </div>
          )}
        </GlassCard>

        {/* Footer */}
        <div className="mt-8 text-center text-white/40 text-sm">
          <p>Powered by Rift</p>
        </div>
      </div>
    </div>
  )
}
