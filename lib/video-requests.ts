import { VideoRequestStatus } from '@prisma/client'

export const STATUS_LABELS: Record<VideoRequestStatus, string> = {
  PENDING_REVIEW: 'Pending Review',
  COUNTER_OFFERED: 'Negotiating',
  NEGOTIATING: 'Negotiating',
  AGREED: 'Agreed',
  IN_PRODUCTION: 'In Production',
  DELIVERED: 'Delivered',
  CLOSED: 'Closed',
}

export const FORMAT_LABELS: Record<string, string> = {
  VERTICAL_9_16: '9:16 vertical',
  HORIZONTAL_16_9: '16:9 horizontal',
  SQUARE_1_1: '1:1 square',
}

export const LENGTH_LABELS: Record<string, string> = {
  SEC_15: '15 seconds',
  SEC_30: '30 seconds',
  SEC_60: '60 seconds',
}

export function formatUsd(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

export function scriptPreview(script: string, max = 80) {
  const t = script.trim().replace(/\s+/g, ' ')
  return t.length <= max ? t : `${t.slice(0, max)}…`
}
