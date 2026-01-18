import { prisma } from './prisma'

/**
 * Generates the next sequential support ticket number
 * This ensures each ticket gets a unique, sequential number for easy tracking
 */
export async function generateNextSupportTicketNumber(): Promise<number> {
  // Find the highest existing ticket number
  const lastTicket = await prisma.supportTicket.findFirst({
    orderBy: {
      ticketNumber: 'desc',
    },
    select: {
      ticketNumber: true,
    },
  })

  // Start from 1000 if no tickets exist, otherwise increment by 1
  const nextNumber = lastTicket ? lastTicket.ticketNumber + 1 : 1000

  return nextNumber
}
