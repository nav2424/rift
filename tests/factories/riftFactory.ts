/**
 * Rift Transaction Factory
 * Creates test Rift transactions with various configurations
 */

import { ItemType, EscrowStatus } from '@prisma/client'
import { randomUUID } from 'crypto'

export interface RiftFactoryOptions {
  itemType?: ItemType
  status?: EscrowStatus
  subtotal?: number
  buyerId?: string
  sellerId?: string
  paidAt?: Date | null
  proofSubmittedAt?: Date | null
  serviceDate?: string | null
  eventDate?: string | null
  eventDateTz?: Date | null
  riskScore?: number
  allowsPartialRelease?: boolean
  milestones?: Array<{
    title: string
    description?: string
    amount: number
    dueDate: string
  }> | null
}

export function createTestRift(options: RiftFactoryOptions = {}) {
  const now = new Date()
  const paidAt = options.paidAt || now
  
  return {
    id: randomUUID(),
    riftNumber: Math.floor(Math.random() * 1000000),
    itemTitle: options.itemType === 'TICKETS' 
      ? 'Concert Tickets' 
      : options.itemType === 'DIGITAL'
      ? 'Digital Product'
      : options.itemType === 'SERVICES'
      ? 'Service Delivery'
      : 'License Key',
    itemDescription: 'Test item description',
    itemType: options.itemType || 'DIGITAL',
    subtotal: options.subtotal || 100,
    buyerFee: (options.subtotal || 100) * 0.03,
    sellerFee: (options.subtotal || 100) * 0.05,
    sellerNet: (options.subtotal || 100) * 0.95,
    currency: 'CAD',
    status: options.status || 'PAID',
    buyerId: options.buyerId || randomUUID(),
    sellerId: options.sellerId || randomUUID(),
    paidAt,
    fundedAt: paidAt, // Route checks fundedAt, so set it too
    proofSubmittedAt: options.proofSubmittedAt || null,
    serviceDate: options.serviceDate || null,
    eventDate: options.eventDate || null,
    eventDateTz: options.eventDateTz || null,
    riskScore: options.riskScore || 0,
    allowsPartialRelease: options.allowsPartialRelease || false,
    milestones: options.milestones || null,
    createdAt: now,
    updatedAt: now,
  }
}

export function createTestRiftWithStatus(
  itemType: ItemType,
  status: EscrowStatus,
  paidAt?: Date
) {
  return createTestRift({
    itemType,
    status,
    paidAt: paidAt || new Date(),
  })
}

export function createTestRiftPastDeadline(itemType: ItemType) {
  const paidAt = new Date()
  paidAt.setHours(paidAt.getHours() - 25) // 25 hours ago (past 24h deadline)
  
  const rift = createTestRift({
    itemType,
    status: 'PAID',
    paidAt,
    proofSubmittedAt: null,
  })
  
  // Route checks fundedAt, so set it too
  ;(rift as any).fundedAt = paidAt
  
  return rift
}

export function createTestRiftBeforeDeadline(itemType: ItemType) {
  const paidAt = new Date()
  paidAt.setHours(paidAt.getHours() - 1) // 1 hour ago (before deadline)
  
  return createTestRift({
    itemType,
    status: 'PAID',
    paidAt,
    proofSubmittedAt: null,
  })
}

