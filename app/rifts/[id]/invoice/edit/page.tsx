'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import GlassCard from '@/components/ui/GlassCard'
import { useToast } from '@/components/ui/Toast'
import Link from 'next/link'

interface InvoiceItem {
  id?: string
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
  buyer_name: string | null
  buyer_email: string
  notes: string | null
  invoice_items: InvoiceItem[]
}

export default function InvoiceEditPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session, status } = useSession()
  const { showToast } = useToast()
  const riftId = params?.id as string

  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    buyer_name: '',
    buyer_email: '',
    buyer_tax_id: '',
    due_date: '',
    tax_rate: 0, // Tax as percentage
    tax_amount: 0, // Fixed tax amount
    notes: '',
    items: [] as InvoiceItem[],
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }

    if (status === 'authenticated' && riftId) {
      fetchInvoice()
    }
  }, [status, riftId, router])

  const fetchInvoice = async () => {
    try {
      const response = await fetch(`/api/rifts/${riftId}/invoice`, {
        credentials: 'include',
      })

      if (!response.ok) {
        if (response.status === 404) {
          router.push(`/rifts/${riftId}`)
          return
        }
        throw new Error('Failed to fetch invoice')
      }

      const data = await response.json()
      setInvoice(data)

      if (data.status !== 'draft' && data.status !== 'sent') {
        showToast('Only draft or sent invoices can be edited', 'error')
        router.push(`/rifts/${riftId}`)
        return
      }

      // Calculate tax rate if tax exists and subtotal > 0
      const subtotal = data.subtotal || 0
      const taxAmount = data.tax || 0
      const taxRate = subtotal > 0 ? (taxAmount / subtotal) * 100 : 0

      setFormData({
        buyer_name: data.buyer_name || '',
        buyer_email: data.buyer_email || '',
        buyer_tax_id: '', // Not stored in DB yet, but UI field available
        due_date: data.due_date ? data.due_date.split('T')[0] : '',
        tax_rate: taxRate,
        tax_amount: taxAmount,
        notes: data.notes || '',
        items: data.invoice_items || [],
      })
    } catch (error) {
      console.error('Error fetching invoice:', error)
      showToast('Failed to load invoice', 'error')
      router.push(`/rifts/${riftId}`)
    } finally {
      setLoading(false)
    }
  }

  const handleItemChange = (index: number, field: keyof InvoiceItem, value: any) => {
    const newItems = [...formData.items]
    const item = { ...newItems[index] }

    if (field === 'quantity' || field === 'unit_price') {
      const numValue = parseFloat(value) || 0
      if (field === 'quantity') {
        item.quantity = numValue
      } else {
        item.unit_price = numValue
      }
      item.amount = item.quantity * item.unit_price
    } else if (field === 'name') {
      item.name = value as string
    } else if (field === 'description') {
      item.description = value as string | null
    }

    newItems[index] = item
    setFormData({ ...formData, items: newItems })
  }

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        {
          name: '',
          description: '',
          quantity: 1,
          unit_price: 0,
          amount: 0,
        },
      ],
    })
  }

  const handleRemoveItem = (index: number) => {
    const newItems = formData.items.filter((_, i) => i !== index)
    setFormData({ ...formData, items: newItems })
  }

  const calculateTotals = () => {
    const subtotal = formData.items.reduce((sum, item) => sum + item.amount, 0)
    // Calculate tax from rate or use fixed amount
    const taxFromRate = subtotal * (formData.tax_rate / 100)
    const tax = formData.tax_amount > 0 ? formData.tax_amount : taxFromRate
    const total = subtotal + tax
    return { subtotal, tax, total }
  }

  const handleSave = async () => {
    if (!invoice) return

    if (formData.items.length === 0) {
      showToast('Invoice must have at least one item', 'error')
      return
    }

    setSaving(true)
    try {
      const { subtotal, total } = calculateTotals()

      const { tax } = calculateTotals()
      
      const response = await fetch(`/api/invoices/${invoice.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          buyer_name: formData.buyer_name || null,
          buyer_email: formData.buyer_email,
          due_date: formData.due_date || null,
          tax: tax,
          notes: formData.notes || null,
          items: formData.items.map((item) => ({
            name: item.name,
            description: item.description || null,
            quantity: item.quantity,
            unit_price: item.unit_price,
          })),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update invoice')
      }

      showToast('Invoice updated successfully', 'success')
      router.push(`/rifts/${riftId}`)
    } catch (error: any) {
      console.error('Error updating invoice:', error)
      showToast(error.message || 'Failed to update invoice', 'error')
    } finally {
      setSaving(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: invoice?.currency || 'USD',
    }).format(amount)
  }

  const { subtotal, tax, total } = calculateTotals()

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-[#86868b] font-light">Loading invoice...</div>
      </div>
    )
  }

  if (!invoice) {
    return null
  }

  return (
    <div className="min-h-screen bg-white py-12 px-4 sm:px-6 lg:px-8 overflow-x-hidden">
      <div className="max-w-4xl mx-auto w-full">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl sm:text-3xl font-light text-[#1d1d1f] mb-2 truncate">Edit Invoice</h1>
            <p className="text-[#86868b] truncate">#{invoice.invoice_number}</p>
          </div>
          <Link
            href={`/rifts/${riftId}`}
            className="text-[#86868b] hover:text-[#1d1d1f] transition flex-shrink-0"
          >
            Cancel
          </Link>
        </div>

        <GlassCard className="p-4 sm:p-6 lg:p-8 overflow-hidden">
          {/* Buyer Information */}
          <div className="mb-8 overflow-hidden">
            <h2 className="text-sm font-light text-[#86868b] mb-4 tracking-wider uppercase">
              Bill To
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="min-w-0">
                  <label className="block text-gray-700 text-sm mb-2 font-medium">
                    Buyer Name <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.buyer_name}
                    onChange={(e) => setFormData({ ...formData, buyer_name: e.target.value })}
                    className="w-full rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-[#1d1d1f] placeholder-gray-400 focus:outline-none focus:border-gray-300 max-w-full"
                    placeholder="Company or individual name"
                    maxLength={255}
                  />
                </div>
                <div className="min-w-0">
                  <label className="block text-gray-700 text-sm mb-2 font-medium">
                    Buyer Email <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    value={formData.buyer_email}
                    onChange={(e) => setFormData({ ...formData, buyer_email: e.target.value })}
                    className="w-full rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-[#1d1d1f] placeholder-gray-400 focus:outline-none focus:border-gray-300 max-w-full"
                    placeholder="buyer@example.com"
                    required
                    maxLength={255}
                  />
                </div>
              </div>
              <div className="min-w-0">
                <label className="block text-gray-700 text-sm mb-2 font-medium">
                  Tax ID / VAT Number <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.buyer_tax_id}
                  onChange={(e) => setFormData({ ...formData, buyer_tax_id: e.target.value })}
                  className="w-full rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-[#1d1d1f] placeholder-gray-400 focus:outline-none focus:border-gray-300 max-w-full"
                  placeholder="EIN, VAT, GST, etc."
                  maxLength={100}
                />
                <p className="text-gray-400 text-xs mt-1">For tax reporting purposes</p>
              </div>
            </div>
          </div>

          {/* Invoice Details */}
          <div className="mb-8 overflow-hidden">
            <h2 className="text-sm font-light text-[#86868b] mb-4 tracking-wider uppercase">
              Invoice Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="min-w-0">
                <label className="block text-gray-700 text-sm mb-2 font-medium">
                  Due Date <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  className="w-full rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-[#1d1d1f] focus:outline-none focus:border-gray-300 max-w-full"
                />
              </div>
              <div className="min-w-0">
                <label className="block text-gray-700 text-sm mb-2 font-medium">
                  Tax Rate <span className="text-gray-400 font-normal">(%)</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.tax_rate}
                    onChange={(e) => {
                      const rate = parseFloat(e.target.value) || 0
                      setFormData({ 
                        ...formData, 
                        tax_rate: rate,
                        tax_amount: 0 // Clear fixed amount when using rate
                      })
                    }}
                    className="w-full rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 pr-12 text-[#1d1d1f] placeholder-gray-400 focus:outline-none focus:border-gray-300 max-w-full"
                    placeholder="0.00"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                </div>
                <p className="text-gray-400 text-xs mt-1">Tax as percentage of subtotal</p>
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-gray-700 text-sm mb-2 font-medium">
                Or Fixed Tax Amount <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#86868b] text-sm">
                  {invoice.currency === 'USD' ? '$' : invoice.currency === 'EUR' ? '€' : invoice.currency === 'GBP' ? '£' : invoice.currency}
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.tax_amount}
                  onChange={(e) => {
                    const amount = parseFloat(e.target.value) || 0
                    setFormData({ 
                      ...formData, 
                      tax_amount: amount,
                      tax_rate: 0 // Clear rate when using fixed amount
                    })
                  }}
                  className="w-full rounded-lg bg-gray-50 border border-gray-200 pl-8 pr-4 py-3 text-[#1d1d1f] placeholder-gray-400 focus:outline-none focus:border-gray-300 max-w-full"
                  placeholder="0.00"
                />
              </div>
              <p className="text-gray-400 text-xs mt-1">Use fixed amount instead of percentage</p>
            </div>
          </div>

          {/* Invoice Items */}
          <div className="mb-8 overflow-hidden">
            <div className="flex items-center justify-between mb-6 gap-4">
              <h2 className="text-sm font-light text-[#86868b] tracking-wider uppercase flex-shrink-0">
                Items
              </h2>
              <button
                onClick={handleAddItem}
                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-white/20 border border-gray-300 text-[#1d1d1f] text-sm font-medium transition flex-shrink-0 whitespace-nowrap"
              >
                + Add Item
              </button>
            </div>

            {formData.items.length > 0 && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="grid grid-cols-12 gap-2 text-xs text-[#86868b] font-medium uppercase tracking-wider">
                  <div className="col-span-5 sm:col-span-6">Item Name</div>
                  <div className="col-span-2 text-center">Qty</div>
                  <div className="col-span-2 text-right">Unit Price</div>
                  <div className="col-span-2 text-right">Amount</div>
                  <div className="col-span-1"></div>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {formData.items.map((item, index) => (
                <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                  <div className="grid grid-cols-12 gap-3 items-start">
                    {/* Item Name */}
                    <div className="col-span-12 sm:col-span-6 min-w-0">
                      <label className="block text-[#86868b] text-xs mb-1.5 font-medium">
                        Item Name <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                        className="w-full rounded-lg bg-gray-50 border border-gray-200 px-4 py-2.5 text-[#1d1d1f] placeholder-gray-400 focus:outline-none focus:border-gray-300 max-w-full"
                        placeholder="e.g., Video Production, Content Creation"
                        required
                        maxLength={255}
                      />
                    </div>

                    {/* Quantity */}
                    <div className="col-span-4 sm:col-span-2 min-w-0">
                      <label className="block text-[#86868b] text-xs mb-1.5 font-medium">
                        Quantity
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                        className="w-full rounded-lg bg-gray-50 border border-gray-200 px-3 py-2.5 text-[#1d1d1f] placeholder-gray-400 focus:outline-none focus:border-gray-300 text-center"
                        placeholder="1"
                      />
                    </div>

                    {/* Unit Price */}
                    <div className="col-span-4 sm:col-span-2 min-w-0">
                      <label className="block text-[#86868b] text-xs mb-1.5 font-medium">
                        Unit Price
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#86868b] text-xs">
                          {invoice.currency === 'USD' ? '$' : invoice.currency === 'EUR' ? '€' : invoice.currency === 'GBP' ? '£' : invoice.currency}
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.unit_price}
                          onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)}
                          className="w-full rounded-lg bg-gray-50 border border-gray-200 pl-7 pr-3 py-2.5 text-[#1d1d1f] placeholder-gray-400 focus:outline-none focus:border-gray-300 text-right"
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    {/* Amount (calculated) */}
                    <div className="col-span-4 sm:col-span-2 min-w-0">
                      <label className="block text-[#86868b] text-xs mb-1.5 font-medium">
                        Amount
                      </label>
                      <div className="w-full rounded-lg bg-gray-50 border border-gray-200 px-3 py-2.5 text-gray-700 text-right font-medium">
                        {formatCurrency(item.amount)}
                      </div>
                    </div>

                    {/* Remove Button */}
                    <div className="col-span-12 sm:col-span-1 flex items-end">
                      {formData.items.length > 1 && (
                        <button
                          onClick={() => handleRemoveItem(index)}
                          className="w-full sm:w-auto px-3 py-2.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-400/10 transition flex-shrink-0"
                          aria-label="Remove item"
                          title="Remove item"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  <div className="mt-3">
                    <label className="block text-[#86868b] text-xs mb-1.5 font-medium">
                      Description <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <textarea
                      value={item.description || ''}
                      onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                      className="w-full rounded-lg bg-gray-50 border border-gray-200 px-4 py-2.5 text-[#1d1d1f] placeholder-gray-400 focus:outline-none focus:border-gray-300 resize-y max-w-full"
                      placeholder="Additional details about this item..."
                      rows={2}
                      maxLength={1000}
                    />
                  </div>
                </div>
              ))}
            </div>

            {formData.items.length === 0 && (
              <div className="text-center py-8 text-[#86868b]">
                <p className="mb-4">No items added yet</p>
                <button
                  onClick={handleAddItem}
                  className="text-gray-700 hover:text-[#1d1d1f] transition"
                >
                  Add your first item
                </button>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="mb-8 overflow-hidden">
            <label className="block text-[#86868b] text-sm mb-2">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full rounded-lg bg-gray-50 border border-gray-200 px-4 py-2 text-[#1d1d1f] placeholder-gray-400 focus:outline-none focus:border-gray-300 resize-y max-w-full"
              placeholder="Additional notes or terms..."
              rows={4}
              maxLength={2000}
            />
          </div>

          {/* Totals */}
          <div className="mb-8 p-6 bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
            <div className="space-y-3">
              <div className="flex justify-between items-center text-gray-700 gap-4">
                <span className="font-medium">Subtotal</span>
                <span className="text-right font-medium">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between items-center text-gray-700 gap-4">
                <span className="font-medium">
                  Tax
                  {formData.tax_rate > 0 && (
                    <span className="text-gray-400 text-sm font-normal ml-2">
                      ({formData.tax_rate.toFixed(2)}%)
                    </span>
                  )}
                </span>
                <span className="text-right font-medium">{formatCurrency(tax)}</span>
              </div>
              <div className="pt-4 border-t border-gray-300">
                <div className="flex justify-between items-center text-[#1d1d1f] text-2xl font-light gap-4">
                  <span className="font-medium">Total</span>
                  <span className="text-right font-medium">{formatCurrency(total)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4 overflow-hidden">
            <button
              onClick={handleSave}
              disabled={saving || formData.items.length === 0}
              className="flex-1 rounded-xl bg-white px-6 py-3 text-sm font-medium text-black hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] whitespace-nowrap"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <Link
              href={`/rifts/${riftId}`}
              className="flex-1 rounded-xl glass-soft px-6 py-3 text-sm font-medium text-gray-700 hover:text-[#1d1d1f] transition text-center min-h-[44px] flex items-center justify-center whitespace-nowrap"
            >
              Cancel
            </Link>
          </div>
        </GlassCard>
      </div>
    </div>
  )
}
