/**
 * UGC contract template: structured JSON for deliverables, deadlines, revisions, usage rights.
 * Stored with deal and renderable as readable contract view.
 */

export type UGCDeliverableFormat = 'video' | 'photo'
export type UGCAspectRatio = '9:16' | '1:1' | '16:9'
export type UGCPaidUsageDuration = 30 | 90 | 180 | 365
export type UGCTerritory = 'country' | 'global'
export type UGCPlatform = 'meta' | 'tiktok' | 'youtube' | 'other'

export interface UGCDeliverables {
  count: number
  format: UGCDeliverableFormat
  aspectRatio: UGCAspectRatio
  duration?: number // seconds, if video
  resolution: string
  rawFilesIncluded: boolean
}

export interface UGCDeadlines {
  draftDueDate: string // ISO date
  finalDueDate: string
}

export interface UGCRevisions {
  revisionCount: number
  revisionDefinition: string
}

export interface UGCPaidUsage {
  enabled: boolean
  durationDays?: UGCPaidUsageDuration
  territory?: UGCTerritory
  platforms?: UGCPlatform[]
}

export interface UGCUsageRights {
  organicUseAllowed: boolean
  paidUsage?: UGCPaidUsage
}

export interface UGCWhitelisting {
  enabled: boolean
  termDescription?: string
}

export interface UGCContractPayload {
  dealType: 'UGC_CREATION'
  deliverables: UGCDeliverables
  deadlines: UGCDeadlines
  revisions: UGCRevisions
  usageRights: UGCUsageRights
  whitelisting: UGCWhitelisting
  disclosure?: string
  killFeePercent: number
  definitionOfDelivered: string
  acceptanceWindowDays: number
  currency: 'CAD' | 'USD'
  platformFeePercent?: number
  processingFee?: number
}

const DEFAULT_REVISION_DEFINITION =
  'A revision is a requested change to the deliverable (creative, copy, or specs) that stays within the original scope. One revision round = one round of feedback and one resubmission.'

const DEFAULT_DEFINITION_DELIVERED =
  'Delivered means files have been uploaded to Rift and the milestone is marked as delivered.'

export const UGC_CONTRACT_TEMPLATE_ID = 'ugc_creation_v1'

export function getDefaultUGCDeliverables(overrides?: Partial<UGCDeliverables>): UGCDeliverables {
  return {
    count: 1,
    format: 'video',
    aspectRatio: '9:16',
    resolution: '1080p',
    rawFilesIncluded: false,
    ...overrides,
  }
}

export function getDefaultUGCDeadlines(overrides?: Partial<UGCDeadlines>): UGCDeadlines {
  const draft = new Date()
  draft.setDate(draft.getDate() + 14)
  const final = new Date()
  final.setDate(final.getDate() + 21)
  return {
    draftDueDate: draft.toISOString().slice(0, 10),
    finalDueDate: final.toISOString().slice(0, 10),
    ...overrides,
  }
}

export function getDefaultUGCRevisions(overrides?: Partial<UGCRevisions>): UGCRevisions {
  return {
    revisionCount: 1,
    revisionDefinition: DEFAULT_REVISION_DEFINITION,
    ...overrides,
  }
}

export function getDefaultUGCUsageRights(overrides?: Partial<UGCUsageRights>): UGCUsageRights {
  return {
    organicUseAllowed: true,
    paidUsage: { enabled: false },
    ...overrides,
  }
}

export function getDefaultUGCWhitelisting(overrides?: Partial<UGCWhitelisting>): UGCWhitelisting {
  return {
    enabled: false,
    ...overrides,
  }
}

export interface UGCTemplateMilestone {
  title: string
  description: string
  amountPercent: number
  dueDateOffsetDays: number // from deal creation
  acceptanceWindowDays: number
  autoApprove: boolean
  maxRevisions: number
}

/** Default UGC template milestones: M1 Draft 40%, M2 Final 40%, M3 Usage Rights 20% */
export const UGC_DEFAULT_MILESTONES: UGCTemplateMilestone[] = [
  {
    title: 'Draft Delivery',
    description: 'Creator uploads draft assets (file upload required). Brand can approve or request revisions within acceptance window.',
    amountPercent: 40,
    dueDateOffsetDays: 14,
    acceptanceWindowDays: 3,
    autoApprove: true,
    maxRevisions: 1,
  },
  {
    title: 'Final Asset Delivery',
    description: 'Creator uploads final assets (file upload required). Brand has acceptance window to approve or request revision if remaining.',
    amountPercent: 40,
    dueDateOffsetDays: 21,
    acceptanceWindowDays: 3,
    autoApprove: true,
    maxRevisions: 1,
  },
  {
    title: 'Usage Rights Activation',
    description: 'Brand confirms activation (checkbox) or auto-approve after acceptance window. Upon approval, invoice/receipt and final payout.',
    amountPercent: 20,
    dueDateOffsetDays: 24,
    acceptanceWindowDays: 3,
    autoApprove: true,
    maxRevisions: 0,
  },
]

export function buildUGCContractFromTemplate(overrides?: {
  deliverables?: Partial<UGCDeliverables>
  deadlines?: Partial<UGCDeadlines>
  revisions?: Partial<UGCRevisions>
  usageRights?: Partial<UGCUsageRights>
  whitelisting?: Partial<UGCWhitelisting>
  currency?: 'CAD' | 'USD'
  killFeePercent?: number
  acceptanceWindowDays?: number
}): UGCContractPayload {
  return {
    dealType: 'UGC_CREATION',
    deliverables: getDefaultUGCDeliverables(overrides?.deliverables),
    deadlines: getDefaultUGCDeadlines(overrides?.deadlines),
    revisions: getDefaultUGCRevisions(overrides?.revisions),
    usageRights: getDefaultUGCUsageRights(overrides?.usageRights),
    whitelisting: getDefaultUGCWhitelisting(overrides?.whitelisting),
    disclosure: '',
    killFeePercent: overrides?.killFeePercent ?? 25,
    definitionOfDelivered: DEFAULT_DEFINITION_DELIVERED,
    acceptanceWindowDays: overrides?.acceptanceWindowDays ?? 3,
    currency: overrides?.currency ?? 'CAD',
  }
}
