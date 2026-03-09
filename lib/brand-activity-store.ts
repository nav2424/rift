import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import type { InfluencerProspectStatus } from '@prisma/client'

export type ProspectStatus = InfluencerProspectStatus
export type InfluencerStatus = 'ACTIVE' | 'ON_HOLD' | 'ARCHIVED'

const PROSPECT_ACTIVITY_TYPE = 'BRAND_PROSPECT'
const INFLUENCER_ACTIVITY_TYPE = 'BRAND_INFLUENCER'

interface ProspectPayload {
  kind: 'prospect'
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

interface InfluencerPayload {
  kind: 'influencer'
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

type ParsedPayload = ProspectPayload | InfluencerPayload

export interface ProspectRecord {
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
  createdAt: string
  updatedAt: string
}

export interface InfluencerRecord {
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
  createdAt: string
  updatedAt: string
}

function parsePayload(metadata: string | null): ParsedPayload | null {
  if (!metadata) return null
  try {
    return JSON.parse(metadata) as ParsedPayload
  } catch {
    return null
  }
}

function toProspectRecord(activity: { id: string; summary: string; metadata: string | null; createdAt: Date }): ProspectRecord {
  const payload = parsePayload(activity.metadata)
  const createdIso = activity.createdAt.toISOString()

  if (!payload || payload.kind !== 'prospect') {
    return {
      id: activity.id,
      name: activity.summary,
      handle: null,
      platform: null,
      contactEmail: null,
      contactPhone: null,
      outreachDate: null,
      quotedRate: null,
      quotedCurrency: 'CAD',
      expectedDeliverables: null,
      status: 'LEAD',
      nextFollowUpDate: null,
      notes: null,
      createdAt: createdIso,
      updatedAt: createdIso,
    }
  }

  return {
    id: activity.id,
    name: payload.name,
    handle: payload.handle,
    platform: payload.platform,
    contactEmail: payload.contactEmail,
    contactPhone: payload.contactPhone,
    outreachDate: payload.outreachDate,
    quotedRate: payload.quotedRate,
    quotedCurrency: payload.quotedCurrency || 'CAD',
    expectedDeliverables: payload.expectedDeliverables,
    status: payload.status || 'LEAD',
    nextFollowUpDate: payload.nextFollowUpDate,
    notes: payload.notes,
    createdAt: createdIso,
    updatedAt: payload.updatedAt || createdIso,
  }
}

function toInfluencerRecord(activity: { id: string; summary: string; metadata: string | null; createdAt: Date }): InfluencerRecord {
  const payload = parsePayload(activity.metadata)
  const createdIso = activity.createdAt.toISOString()

  if (!payload || payload.kind !== 'influencer') {
    return {
      id: activity.id,
      name: activity.summary,
      handle: null,
      platform: null,
      contactEmail: null,
      contactPhone: null,
      rate: null,
      currency: 'CAD',
      status: 'ACTIVE',
      notes: null,
      createdAt: createdIso,
      updatedAt: createdIso,
    }
  }

  return {
    id: activity.id,
    name: payload.name,
    handle: payload.handle,
    platform: payload.platform,
    contactEmail: payload.contactEmail,
    contactPhone: payload.contactPhone,
    rate: payload.rate,
    currency: payload.currency || 'CAD',
    status: payload.status || 'ACTIVE',
    notes: payload.notes,
    createdAt: createdIso,
    updatedAt: payload.updatedAt || createdIso,
  }
}

function normalizeDate(value: unknown): string | null {
  if (value == null || value === '') return null
  const parsed = new Date(String(value))
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

function normalizeNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return parsed
}

export async function listProspectsFromActivity(userId: string, status?: string | null): Promise<ProspectRecord[]> {
  const rows = await prisma.activity.findMany({
    where: {
      userId,
      type: PROSPECT_ACTIVITY_TYPE,
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, summary: true, metadata: true, createdAt: true },
  })

  const prospects = rows.map(toProspectRecord)
  if (!status) return prospects.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
  return prospects
    .filter((row) => row.status === status)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
}

export async function createProspectInActivity(userId: string, body: any): Promise<ProspectRecord> {
  const nowIso = new Date().toISOString()
  const payload: ProspectPayload = {
    kind: 'prospect',
    name: String(body.name || '').trim(),
    handle: typeof body.handle === 'string' ? body.handle.trim() || null : null,
    platform: typeof body.platform === 'string' ? body.platform.trim() || null : null,
    contactEmail: typeof body.contactEmail === 'string' ? body.contactEmail.trim() || null : null,
    contactPhone: typeof body.contactPhone === 'string' ? body.contactPhone.trim() || null : null,
    outreachDate: normalizeDate(body.outreachDate),
    quotedRate: normalizeNumber(body.quotedRate),
    quotedCurrency: typeof body.quotedCurrency === 'string' && body.quotedCurrency.trim() ? body.quotedCurrency.trim().toUpperCase() : 'CAD',
    expectedDeliverables: typeof body.expectedDeliverables === 'string' ? body.expectedDeliverables.trim() || null : null,
    status: (body.status as ProspectStatus) || 'LEAD',
    nextFollowUpDate: normalizeDate(body.nextFollowUpDate),
    notes: typeof body.notes === 'string' ? body.notes.trim() || null : null,
    updatedAt: nowIso,
  }

  const activity = await prisma.activity.create({
    data: {
      id: randomUUID(),
      userId,
      type: PROSPECT_ACTIVITY_TYPE,
      summary: payload.name,
      amount: payload.quotedRate,
      metadata: JSON.stringify(payload),
    },
    select: { id: true, summary: true, metadata: true, createdAt: true },
  })

  return toProspectRecord(activity)
}

export async function updateProspectInActivity(userId: string, prospectId: string, body: any): Promise<ProspectRecord | null> {
  const existing = await prisma.activity.findUnique({
    where: { id: prospectId },
    select: { id: true, summary: true, metadata: true, createdAt: true, type: true, userId: true },
  })
  if (!existing || existing.userId !== userId || existing.type !== PROSPECT_ACTIVITY_TYPE) return null

  const current = toProspectRecord(existing)
  const updated: ProspectPayload = {
    kind: 'prospect',
    name: body.name !== undefined ? String(body.name).trim() : current.name,
    handle: body.handle !== undefined ? (String(body.handle || '').trim() || null) : current.handle,
    platform: body.platform !== undefined ? (String(body.platform || '').trim() || null) : current.platform,
    contactEmail: body.contactEmail !== undefined ? (String(body.contactEmail || '').trim() || null) : current.contactEmail,
    contactPhone: body.contactPhone !== undefined ? (String(body.contactPhone || '').trim() || null) : current.contactPhone,
    outreachDate: body.outreachDate !== undefined ? normalizeDate(body.outreachDate) : current.outreachDate,
    quotedRate: body.quotedRate !== undefined ? normalizeNumber(body.quotedRate) : current.quotedRate,
    quotedCurrency: body.quotedCurrency !== undefined ? (String(body.quotedCurrency || '').trim().toUpperCase() || 'CAD') : current.quotedCurrency,
    expectedDeliverables: body.expectedDeliverables !== undefined ? (String(body.expectedDeliverables || '').trim() || null) : current.expectedDeliverables,
    status: body.status !== undefined ? (body.status as ProspectStatus) : current.status,
    nextFollowUpDate: body.nextFollowUpDate !== undefined ? normalizeDate(body.nextFollowUpDate) : current.nextFollowUpDate,
    notes: body.notes !== undefined ? (String(body.notes || '').trim() || null) : current.notes,
    updatedAt: new Date().toISOString(),
  }

  const activity = await prisma.activity.update({
    where: { id: prospectId },
    data: {
      summary: updated.name,
      amount: updated.quotedRate,
      metadata: JSON.stringify(updated),
    },
    select: { id: true, summary: true, metadata: true, createdAt: true },
  })

  return toProspectRecord(activity)
}

export async function deleteProspectInActivity(userId: string, prospectId: string): Promise<boolean> {
  const result = await prisma.activity.deleteMany({
    where: {
      id: prospectId,
      userId,
      type: PROSPECT_ACTIVITY_TYPE,
    },
  })
  return result.count > 0
}

export async function listInfluencersFromActivity(userId: string): Promise<InfluencerRecord[]> {
  const rows = await prisma.activity.findMany({
    where: {
      userId,
      type: INFLUENCER_ACTIVITY_TYPE,
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, summary: true, metadata: true, createdAt: true },
  })

  return rows
    .map(toInfluencerRecord)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
}

export async function createInfluencerInActivity(userId: string, body: any): Promise<InfluencerRecord> {
  const payload: InfluencerPayload = {
    kind: 'influencer',
    name: String(body.name || '').trim(),
    handle: typeof body.handle === 'string' ? body.handle.trim() || null : null,
    platform: typeof body.platform === 'string' ? body.platform.trim() || null : null,
    contactEmail: typeof body.contactEmail === 'string' ? body.contactEmail.trim() || null : null,
    contactPhone: typeof body.contactPhone === 'string' ? body.contactPhone.trim() || null : null,
    rate: normalizeNumber(body.rate),
    currency: typeof body.currency === 'string' && body.currency.trim() ? body.currency.trim().toUpperCase() : 'CAD',
    status: (body.status as InfluencerStatus) || 'ACTIVE',
    notes: typeof body.notes === 'string' ? body.notes.trim() || null : null,
    updatedAt: new Date().toISOString(),
  }

  const activity = await prisma.activity.create({
    data: {
      id: randomUUID(),
      userId,
      type: INFLUENCER_ACTIVITY_TYPE,
      summary: payload.name,
      amount: payload.rate,
      metadata: JSON.stringify(payload),
    },
    select: { id: true, summary: true, metadata: true, createdAt: true },
  })

  return toInfluencerRecord(activity)
}

export async function updateInfluencerInActivity(userId: string, influencerId: string, body: any): Promise<InfluencerRecord | null> {
  const existing = await prisma.activity.findUnique({
    where: { id: influencerId },
    select: { id: true, summary: true, metadata: true, createdAt: true, type: true, userId: true },
  })
  if (!existing || existing.userId !== userId || existing.type !== INFLUENCER_ACTIVITY_TYPE) return null

  const current = toInfluencerRecord(existing)
  const updated: InfluencerPayload = {
    kind: 'influencer',
    name: body.name !== undefined ? String(body.name).trim() : current.name,
    handle: body.handle !== undefined ? (String(body.handle || '').trim() || null) : current.handle,
    platform: body.platform !== undefined ? (String(body.platform || '').trim() || null) : current.platform,
    contactEmail: body.contactEmail !== undefined ? (String(body.contactEmail || '').trim() || null) : current.contactEmail,
    contactPhone: body.contactPhone !== undefined ? (String(body.contactPhone || '').trim() || null) : current.contactPhone,
    rate: body.rate !== undefined ? normalizeNumber(body.rate) : current.rate,
    currency: body.currency !== undefined ? (String(body.currency || '').trim().toUpperCase() || 'CAD') : current.currency,
    status: body.status !== undefined ? (body.status as InfluencerStatus) : current.status,
    notes: body.notes !== undefined ? (String(body.notes || '').trim() || null) : current.notes,
    updatedAt: new Date().toISOString(),
  }

  const activity = await prisma.activity.update({
    where: { id: influencerId },
    data: {
      summary: updated.name,
      amount: updated.rate,
      metadata: JSON.stringify(updated),
    },
    select: { id: true, summary: true, metadata: true, createdAt: true },
  })

  return toInfluencerRecord(activity)
}

export async function deleteInfluencerInActivity(userId: string, influencerId: string): Promise<boolean> {
  const result = await prisma.activity.deleteMany({
    where: {
      id: influencerId,
      userId,
      type: INFLUENCER_ACTIVITY_TYPE,
    },
  })
  return result.count > 0
}
