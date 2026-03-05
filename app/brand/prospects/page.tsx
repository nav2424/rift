'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import GlassCard from '@/components/ui/GlassCard'

type ProspectStatus = 'LEAD' | 'CONTACTED' | 'NEGOTIATING' | 'READY_TO_DEAL' | 'PASSED'
type InfluencerStatus = 'ACTIVE' | 'ON_HOLD' | 'ARCHIVED'

interface Prospect {
  id: string
  name: string
  handle: string | null
  platform: string | null
  contactEmail: string | null
  contactPhone: string | null
  outreachDate: string | null
  quotedRate: number | null
  quotedCurrency: string
  expectedDeliverables: string | null
  status: ProspectStatus
  nextFollowUpDate: string | null
  notes: string | null
  updatedAt: string
}

interface Influencer {
  id: string
  name: string
  handle: string | null
  platform: string | null
  contactEmail: string | null
  contactPhone: string | null
  rate: number | null
  currency: string
  status: InfluencerStatus
  notes: string | null
  updatedAt: string
}

interface ProspectFormValues {
  name: string
  handle: string
  platform: string
  contactEmail: string
  contactPhone: string
  outreachDate: string
  quotedRate: string
  quotedCurrency: string
  expectedDeliverables: string
  status: ProspectStatus
  nextFollowUpDate: string
  notes: string
}

interface InfluencerFormValues {
  name: string
  handle: string
  platform: string
  contactEmail: string
  contactPhone: string
  rate: string
  currency: string
  status: InfluencerStatus
  notes: string
}

const STATUS_OPTIONS: Array<{ value: ProspectStatus; label: string }> = [
  { value: 'LEAD', label: 'Lead' },
  { value: 'CONTACTED', label: 'Contacted' },
  { value: 'NEGOTIATING', label: 'Negotiating' },
  { value: 'READY_TO_DEAL', label: 'Ready to Deal' },
  { value: 'PASSED', label: 'Passed' },
]

const INFLUENCER_STATUS_OPTIONS: Array<{ value: InfluencerStatus; label: string }> = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'ARCHIVED', label: 'Archived' },
]

const EMPTY_FORM: ProspectFormValues = {
  name: '',
  handle: '',
  platform: '',
  contactEmail: '',
  contactPhone: '',
  outreachDate: '',
  quotedRate: '',
  quotedCurrency: 'CAD',
  expectedDeliverables: '',
  status: 'LEAD',
  nextFollowUpDate: '',
  notes: '',
}

const EMPTY_INFLUENCER_FORM: InfluencerFormValues = {
  name: '',
  handle: '',
  platform: '',
  contactEmail: '',
  contactPhone: '',
  rate: '',
  currency: 'CAD',
  status: 'ACTIVE',
  notes: '',
}

export default function ProspectPipelinePage() {
  const { status } = useSession()
  const router = useRouter()
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [influencers, setInfluencers] = useState<Influencer[]>([])
  const [form, setForm] = useState<ProspectFormValues>(EMPTY_FORM)
  const [influencerForm, setInfluencerForm] = useState<InfluencerFormValues>(EMPTY_INFLUENCER_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [influencerSaving, setInfluencerSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingInfluencerId, setEditingInfluencerId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [schemaMessage, setSchemaMessage] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }

    if (status === 'authenticated') {
      void loadAll()
    }
  }, [status, router])

  const loadAll = async () => {
    await Promise.all([loadProspects(), loadInfluencers()])
  }

  const loadProspects = async () => {
    setError(null)
    try {
      const response = await fetch('/api/brand/prospects', { credentials: 'include' })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Could not load prospects')
      }

      const data = await response.json()
      setProspects(data.prospects || [])
      setSchemaMessage(data.schemaNotReady ? data.message || 'Prospects are using fallback storage until database schema is synced.' : null)
    } catch (err: any) {
      setError(err.message || 'Could not load prospects')
    }
  }

  const loadInfluencers = async () => {
    try {
      const response = await fetch('/api/brand/influencers', { credentials: 'include' })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Could not load influencers')
      }
      const data = await response.json()
      setInfluencers(data.influencers || [])
    } catch (err: any) {
      setError(err.message || 'Could not load influencers')
    } finally {
      setLoading(false)
    }
  }

  const updateForm = (field: keyof ProspectFormValues, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const updateInfluencerForm = (field: keyof InfluencerFormValues, value: string) => {
    setInfluencerForm(prev => ({ ...prev, [field]: value }))
  }

  const resetForm = () => {
    setForm(EMPTY_FORM)
    setEditingId(null)
  }

  const resetInfluencerForm = () => {
    setInfluencerForm(EMPTY_INFLUENCER_FORM)
    setEditingInfluencerId(null)
  }

  const prospectCountByStatus = useMemo(() => {
    return prospects.reduce<Record<ProspectStatus, number>>(
      (acc, prospect) => {
        acc[prospect.status] += 1
        return acc
      },
      { LEAD: 0, CONTACTED: 0, NEGOTIATING: 0, READY_TO_DEAL: 0, PASSED: 0 }
    )
  }, [prospects])

  const influencerCountByStatus = useMemo(() => {
    return influencers.reduce<Record<InfluencerStatus, number>>(
      (acc, influencer) => {
        acc[influencer.status] += 1
        return acc
      },
      { ACTIVE: 0, ON_HOLD: 0, ARCHIVED: 0 }
    )
  }, [influencers])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        quotedRate: form.quotedRate ? Number(form.quotedRate) : null,
      }

      if (!payload.name) {
        throw new Error('Prospect name is required.')
      }

      const endpoint = editingId ? `/api/brand/prospects/${editingId}` : '/api/brand/prospects'
      const method = editingId ? 'PATCH' : 'POST'

      const response = await fetch(endpoint, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Could not save prospect')
      }

      await loadProspects()
      resetForm()
    } catch (err: any) {
      setError(err.message || 'Could not save prospect')
    } finally {
      setSaving(false)
    }
  }

  const handleInfluencerSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setInfluencerSaving(true)
    setError(null)

    try {
      const payload = {
        ...influencerForm,
        name: influencerForm.name.trim(),
        rate: influencerForm.rate ? Number(influencerForm.rate) : null,
      }

      if (!payload.name) {
        throw new Error('Influencer name is required.')
      }

      const endpoint = editingInfluencerId
        ? `/api/brand/influencers/${editingInfluencerId}`
        : '/api/brand/influencers'
      const method = editingInfluencerId ? 'PATCH' : 'POST'

      const response = await fetch(endpoint, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Could not save influencer')
      }

      await loadInfluencers()
      resetInfluencerForm()
    } catch (err: any) {
      setError(err.message || 'Could not save influencer')
    } finally {
      setInfluencerSaving(false)
    }
  }

  const startEditing = (prospect: Prospect) => {
    setEditingId(prospect.id)
    setForm({
      name: prospect.name || '',
      handle: prospect.handle || '',
      platform: prospect.platform || '',
      contactEmail: prospect.contactEmail || '',
      contactPhone: prospect.contactPhone || '',
      outreachDate: prospect.outreachDate ? prospect.outreachDate.slice(0, 10) : '',
      quotedRate: prospect.quotedRate == null ? '' : String(prospect.quotedRate),
      quotedCurrency: prospect.quotedCurrency || 'CAD',
      expectedDeliverables: prospect.expectedDeliverables || '',
      status: prospect.status,
      nextFollowUpDate: prospect.nextFollowUpDate ? prospect.nextFollowUpDate.slice(0, 10) : '',
      notes: prospect.notes || '',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const deleteProspect = async (prospectId: string) => {
    const confirmed = window.confirm('Delete this prospect? This cannot be undone.')
    if (!confirmed) return

    try {
      const response = await fetch(`/api/brand/prospects/${prospectId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Could not delete prospect')
      }

      if (editingId === prospectId) {
        resetForm()
      }
      await loadProspects()
    } catch (err: any) {
      setError(err.message || 'Could not delete prospect')
    }
  }

  const startEditingInfluencer = (influencer: Influencer) => {
    setEditingInfluencerId(influencer.id)
    setInfluencerForm({
      name: influencer.name || '',
      handle: influencer.handle || '',
      platform: influencer.platform || '',
      contactEmail: influencer.contactEmail || '',
      contactPhone: influencer.contactPhone || '',
      rate: influencer.rate == null ? '' : String(influencer.rate),
      currency: influencer.currency || 'CAD',
      status: influencer.status,
      notes: influencer.notes || '',
    })
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
  }

  const deleteInfluencer = async (influencerId: string) => {
    const confirmed = window.confirm('Delete this influencer from your roster?')
    if (!confirmed) return

    try {
      const response = await fetch(`/api/brand/influencers/${influencerId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Could not delete influencer')
      }

      if (editingInfluencerId === influencerId) {
        resetInfluencerForm()
      }
      await loadInfluencers()
    } catch (err: any) {
      setError(err.message || 'Could not delete influencer')
    }
  }

  const formatDate = (value: string | null) => {
    if (!value) return '—'
    return new Date(value).toLocaleDateString()
  }

  const formatQuote = (amount: number | null, currency: string) => {
    if (amount == null) return '—'
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
  }

  const inputClass =
    'w-full p-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm text-[#1d1d1f] placeholder-gray-400 focus:outline-none focus:border-gray-300 transition-colors'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-[#1d1d1f] tracking-tight">Influencer Prospects</h1>
        <p className="mt-1 text-[#86868b] text-sm">
          Track influencer outreach, save prospects, and manage active influencers.
        </p>
      </div>

      {schemaMessage && (
        <GlassCard className="p-3 border border-amber-200 bg-amber-50">
          <p className="text-xs text-amber-700">
            {schemaMessage}
          </p>
        </GlassCard>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {STATUS_OPTIONS.map(option => (
          <GlassCard key={option.value} className="p-4 border border-gray-200 bg-white text-center">
            <p className="text-xl font-semibold text-[#1d1d1f]">{prospectCountByStatus[option.value]}</p>
            <p className="text-xs text-[#86868b] mt-1">{option.label}</p>
          </GlassCard>
        ))}
      </div>

      <GlassCard className="p-5 border border-gray-200 bg-white">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[#1d1d1f]">
            {editingId ? 'Edit Prospect' : 'Add Prospect'}
          </h2>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="text-sm text-[#86868b] hover:text-[#1d1d1f] transition-colors"
            >
              Cancel edit
            </button>
          )}
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input value={form.name} onChange={e => updateForm('name', e.target.value)} placeholder="Influencer name *" className={inputClass} />
            <input value={form.handle} onChange={e => updateForm('handle', e.target.value)} placeholder="@handle" className={inputClass} />
            <input value={form.platform} onChange={e => updateForm('platform', e.target.value)} placeholder="Platform (Instagram, TikTok...)" className={inputClass} />
            <select value={form.status} onChange={e => updateForm('status', e.target.value)} className={inputClass}>
              {STATUS_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <input value={form.contactEmail} onChange={e => updateForm('contactEmail', e.target.value)} placeholder="Contact email" className={inputClass} />
            <input value={form.contactPhone} onChange={e => updateForm('contactPhone', e.target.value)} placeholder="Contact phone" className={inputClass} />
            <label className="block text-xs text-[#86868b]">
              Outreach date
              <input
                type="text"
                value={form.outreachDate}
                onChange={e => updateForm('outreachDate', e.target.value)}
                placeholder="YYYY-MM-DD"
                className={`${inputClass} mt-1`}
              />
            </label>
            <label className="block text-xs text-[#86868b]">
              Next follow-up
              <input
                type="text"
                value={form.nextFollowUpDate}
                onChange={e => updateForm('nextFollowUpDate', e.target.value)}
                placeholder="YYYY-MM-DD"
                className={`${inputClass} mt-1`}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.quotedRate}
              onChange={e => updateForm('quotedRate', e.target.value)}
              placeholder="Quoted rate"
              className={inputClass}
            />
            <input value={form.quotedCurrency} onChange={e => updateForm('quotedCurrency', e.target.value.toUpperCase())} placeholder="Currency (CAD)" className={inputClass} />
            <input value={form.expectedDeliverables} onChange={e => updateForm('expectedDeliverables', e.target.value)} placeholder="Deliverables (2 reels + 3 stories)" className={inputClass} />
          </div>

          <textarea
            value={form.notes}
            onChange={e => updateForm('notes', e.target.value)}
            placeholder="Notes from DMs, requirements, contract readiness, etc."
            rows={3}
            className={inputClass}
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2.5 rounded-xl text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 transition-all"
          >
            {saving ? 'Saving...' : editingId ? 'Update Prospect' : 'Add Prospect'}
          </button>
        </form>
      </GlassCard>

      <GlassCard className="border border-gray-200 bg-white">
        <div className="p-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-[#1d1d1f]">Prospect Pipeline</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {loading ? (
            <div className="p-8 text-center text-sm text-[#86868b]">Loading prospects...</div>
          ) : prospects.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#86868b]">No prospects yet. Add your first influencer lead above.</div>
          ) : (
            prospects.map(prospect => (
              <div key={prospect.id} className="p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-[#1d1d1f]">{prospect.name}</p>
                      <span className="text-xs px-2 py-1 rounded-full bg-gray-50 border border-gray-200 text-[#86868b]">
                        {STATUS_OPTIONS.find(option => option.value === prospect.status)?.label}
                      </span>
                    </div>
                    <p className="text-xs text-[#86868b] mt-1">
                      {[prospect.handle, prospect.platform].filter(Boolean).join(' · ') || 'No handle/platform added'}
                    </p>
                    <p className="text-xs text-[#86868b] mt-1">
                      Outreach: {formatDate(prospect.outreachDate)} · Quote: {formatQuote(prospect.quotedRate, prospect.quotedCurrency)}
                    </p>
                    <p className="text-xs text-[#86868b] mt-1">
                      Follow-up: {formatDate(prospect.nextFollowUpDate)} · Updated: {formatDate(prospect.updatedAt)}
                    </p>
                    {(prospect.contactEmail || prospect.contactPhone) && (
                      <p className="text-xs text-[#86868b] mt-1">
                        {[prospect.contactEmail, prospect.contactPhone].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    {(prospect.expectedDeliverables || prospect.notes) && (
                      <p className="text-sm text-[#1d1d1f] mt-2 leading-relaxed">
                        {[prospect.expectedDeliverables, prospect.notes].filter(Boolean).join(' — ')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 sm:pl-4">
                    <button
                      type="button"
                      onClick={() => startEditing(prospect)}
                      className="px-3 py-2 rounded-lg text-xs font-medium border border-gray-200 text-[#1d1d1f] hover:bg-gray-50 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteProspect(prospect.id)}
                      className="px-3 py-2 rounded-lg text-xs font-medium border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </GlassCard>

      <GlassCard className="border border-gray-200 bg-white">
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#1d1d1f]">Influencer Roster</h2>
            <div className="flex items-center gap-2 text-xs text-[#86868b]">
              <span>Active: {influencerCountByStatus.ACTIVE}</span>
              <span>On Hold: {influencerCountByStatus.ON_HOLD}</span>
              <span>Archived: {influencerCountByStatus.ARCHIVED}</span>
            </div>
          </div>
          <p className="mt-1 text-xs text-[#86868b]">
            Keep a dedicated list of influencers you actively work with.
          </p>
        </div>

        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[#1d1d1f]">
              {editingInfluencerId ? 'Edit Influencer' : 'Add Influencer'}
            </h3>
            {editingInfluencerId && (
              <button
                type="button"
                onClick={resetInfluencerForm}
                className="text-xs text-[#86868b] hover:text-[#1d1d1f]"
              >
                Cancel edit
              </button>
            )}
          </div>
          <form className="space-y-3" onSubmit={handleInfluencerSubmit}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input value={influencerForm.name} onChange={e => updateInfluencerForm('name', e.target.value)} placeholder="Influencer name *" className={inputClass} />
              <input value={influencerForm.handle} onChange={e => updateInfluencerForm('handle', e.target.value)} placeholder="@handle" className={inputClass} />
              <input value={influencerForm.platform} onChange={e => updateInfluencerForm('platform', e.target.value)} placeholder="Platform" className={inputClass} />
              <select value={influencerForm.status} onChange={e => updateInfluencerForm('status', e.target.value)} className={inputClass}>
                {INFLUENCER_STATUS_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <input value={influencerForm.contactEmail} onChange={e => updateInfluencerForm('contactEmail', e.target.value)} placeholder="Contact email" className={inputClass} />
              <input value={influencerForm.contactPhone} onChange={e => updateInfluencerForm('contactPhone', e.target.value)} placeholder="Contact phone" className={inputClass} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="number"
                min="0"
                step="0.01"
                value={influencerForm.rate}
                onChange={e => updateInfluencerForm('rate', e.target.value)}
                placeholder="Typical rate"
                className={inputClass}
              />
              <input value={influencerForm.currency} onChange={e => updateInfluencerForm('currency', e.target.value.toUpperCase())} placeholder="Currency (CAD)" className={inputClass} />
              <div />
            </div>
            <textarea
              value={influencerForm.notes}
              onChange={e => updateInfluencerForm('notes', e.target.value)}
              placeholder="Partnership notes, preferred workflow, payment terms, etc."
              rows={2}
              className={inputClass}
            />
            <button
              type="submit"
              disabled={influencerSaving}
              className="px-4 py-2.5 rounded-xl text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 transition-all"
            >
              {influencerSaving ? 'Saving...' : editingInfluencerId ? 'Update Influencer' : 'Add Influencer'}
            </button>
          </form>
        </div>

        <div className="divide-y divide-gray-100">
          {loading ? (
            <div className="p-8 text-center text-sm text-[#86868b]">Loading influencers...</div>
          ) : influencers.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#86868b]">No influencers yet. Add your first influencer above.</div>
          ) : (
            influencers.map(influencer => (
              <div key={influencer.id} className="p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-[#1d1d1f]">{influencer.name}</p>
                      <span className="text-xs px-2 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">
                        {INFLUENCER_STATUS_OPTIONS.find(option => option.value === influencer.status)?.label}
                      </span>
                    </div>
                    <p className="text-xs text-[#86868b] mt-1">
                      {[influencer.handle, influencer.platform].filter(Boolean).join(' · ') || 'No handle/platform added'}
                    </p>
                    <p className="text-xs text-[#86868b] mt-1">
                      Rate: {formatQuote(influencer.rate, influencer.currency)} · Updated: {formatDate(influencer.updatedAt)}
                    </p>
                    {(influencer.contactEmail || influencer.contactPhone) && (
                      <p className="text-xs text-[#86868b] mt-1">
                        {[influencer.contactEmail, influencer.contactPhone].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    {influencer.notes && (
                      <p className="text-sm text-[#1d1d1f] mt-2 leading-relaxed">{influencer.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 sm:pl-4">
                    <button
                      type="button"
                      onClick={() => startEditingInfluencer(influencer)}
                      className="px-3 py-2 rounded-lg text-xs font-medium border border-gray-200 text-[#1d1d1f] hover:bg-gray-50 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteInfluencer(influencer.id)}
                      className="px-3 py-2 rounded-lg text-xs font-medium border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </GlassCard>
    </div>
  )
}
