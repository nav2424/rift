/**
 * Invoice number generation utility
 * Generates sequential invoice numbers in format: RIFT-YYYY-000001
 */

import { createServerClient } from './supabase'

/**
 * Generate the next invoice number for the current year
 * Format: RIFT-YYYY-000001
 */
export async function generateInvoiceNumber(): Promise<string> {
  const supabase = createServerClient()
  const currentYear = new Date().getFullYear()
  const prefix = `RIFT-${currentYear}-`

  try {
    // Find the highest invoice number for this year
    const { data: invoices, error } = await supabase
      .from('invoices')
      .select('invoice_number')
      .like('invoice_number', `${prefix}%`)
      .order('invoice_number', { ascending: false })
      .limit(1)

    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      console.error('Error fetching invoices for number generation:', error)
      throw new Error('Failed to generate invoice number')
    }

    // Extract the sequence number from the highest invoice number
    let nextSequence = 1

    if (invoices && invoices.length > 0) {
      const lastInvoiceNumber = invoices[0].invoice_number
      const lastSequenceStr = lastInvoiceNumber.replace(prefix, '')
      const lastSequence = parseInt(lastSequenceStr, 10)
      
      if (!isNaN(lastSequence)) {
        nextSequence = lastSequence + 1
      }
    }

    // Format with leading zeros (6 digits)
    const sequenceStr = nextSequence.toString().padStart(6, '0')
    return `${prefix}${sequenceStr}`
  } catch (error: any) {
    console.error('Error generating invoice number:', error)
    // Fallback: use timestamp-based number if database query fails
    const timestamp = Date.now().toString().slice(-6)
    return `RIFT-${currentYear}-${timestamp}`
  }
}
