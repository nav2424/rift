interface TimelineEvent {
  id: string
  riftId: string
  escrowId?: string // Legacy support
  type: string
  message: string
  createdById: string | null
  createdAt: Date
  createdBy?: { name: string | null; email: string } | null
}

interface TimelineProps {
  events: TimelineEvent[]
  isBuyer?: boolean
  isSeller?: boolean
  riftValue?: number // The subtotal/rift value to correct payment messages
  currency?: string // Currency code for formatting
}

/**
 * Filters fee information from timeline messages based on user role
 * - Sellers should only see the rift value (amount they received), not fees or buyer payment amounts
 * - Buyers should see the rift value + processing fee, but not seller payout amounts
 */
function filterMessageForRole(
  message: string, 
  isBuyer?: boolean, 
  isSeller?: boolean,
  riftValue?: number,
  currency?: string
): string {
  // Handle payment messages - replace with clean format
  if (message.includes('Payment')) {
    // If we have rift value and currency, use them to create clean message
    if (riftValue && currency) {
      message = `Payment received: ${currency} ${riftValue.toFixed(2)}`
    } else {
      // Extract currency and amount from existing message
      const paymentMatch = message.match(/Payment (?:received|confirmed):\s*([A-Z]{3})\s+([\d,]+\.?\d*)/i)
      if (paymentMatch) {
        const msgCurrency = paymentMatch[1]
        let amount = paymentMatch[2].replace(/,/g, '')
        
        // Fix double .00 issues (e.g., 100.00.00 -> 100.00)
        amount = amount.replace(/(\d+\.\d{2})\.\d{2}/g, '$1')
        amount = amount.replace(/(\d+)\.00\.00/g, '$1.00')
        
        // Parse and reformat to ensure clean format
        const cleanAmount = parseFloat(amount).toFixed(2)
        message = `Payment received: ${msgCurrency} ${cleanAmount}`
      } else {
        // Fallback: just clean up the message
        message = message.replace(/Payment (?:received|confirmed):[^.]*/gi, 'Payment received')
      }
    }
  }

  // Handle "Buyer released funds" messages - clean up format
  if (message.includes('Buyer released funds')) {
    // If we have rift value and currency, use them to create clean message
    if (riftValue && currency) {
      message = `Funds released: ${currency} ${riftValue.toFixed(2)}`
    } else {
      // Extract currency and amount from existing message
      // Pattern: "Buyer released funds. Seller receives CAD 25.00 (CAD 2.00 platform fee deducted)"
      const buyerReleaseMatch = message.match(/Buyer released funds\.?\s*Seller receives\s+([A-Z]{3})\s+([\d,]+\.?\d*)/i)
      if (buyerReleaseMatch) {
        const msgCurrency = buyerReleaseMatch[1]
        let amount = buyerReleaseMatch[2].replace(/,/g, '')
        
        // Fix double .00 issues
        amount = amount.replace(/(\d+\.\d{2})\.\d{2}/g, '$1')
        amount = amount.replace(/(\d+)\.00\.00/g, '$1.00')
        
        // Parse and reformat to ensure clean format
        const cleanAmount = parseFloat(amount).toFixed(2)
        message = `Funds released: ${msgCurrency} ${cleanAmount}`
      } else {
        // Fallback: just clean up the message
        message = message.replace(/Buyer released funds\.[^.]*/gi, 'Funds released')
        // Remove fee information that might be left
        message = message.replace(/Seller receives[^.]*/gi, '')
        message = message.replace(/\([^)]*platform fee[^)]*\)/gi, '')
        message = message.replace(/\([^)]*deducted[^)]*\)/gi, '')
      }
    }
  }

  // Handle "Funds released" messages - clean up format
  if (message.includes('Funds released') && !message.includes('Buyer released funds')) {
    // If we have rift value and currency, use them to create clean message
    if (riftValue && currency) {
      message = `Funds released: ${currency} ${riftValue.toFixed(2)}`
    } else {
      // Extract currency and amount from existing message
      // Pattern: "Funds released. Amount: CAD 25.00" or "Funds released. Amount: CAD 25.00 (Payout ID: ...)"
      const fundsMatch = message.match(/Funds released\.?\s*Amount:\s*([A-Z]{3})\s+([\d,]+\.?\d*)/i)
      if (fundsMatch) {
        const msgCurrency = fundsMatch[1]
        let amount = fundsMatch[2].replace(/,/g, '')
        
        // Fix double .00 issues
        amount = amount.replace(/(\d+\.\d{2})\.\d{2}/g, '$1')
        amount = amount.replace(/(\d+)\.00\.00/g, '$1.00')
        
        // Parse and reformat to ensure clean format
        const cleanAmount = parseFloat(amount).toFixed(2)
        message = `Funds released: ${currency} ${cleanAmount}`
      } else {
        // Fallback: clean up the message format
        message = message.replace(/Funds released\.?\s*Amount:[^.]*/gi, 'Funds released')
        message = message.replace(/Funds released\.\s*([A-Z]{3})\s+([\d,]+\.?\d*)/i, (match, curr, amt) => {
          let amount = amt.replace(/,/g, '')
          amount = amount.replace(/(\d+\.\d{2})\.\d{2}/g, '$1')
          amount = amount.replace(/(\d+)\.00\.00/g, '$1.00')
          const cleanAmount = parseFloat(amount).toFixed(2)
          return `Funds released: ${curr} ${cleanAmount}`
        })
      }
    }
    
    // Remove payout ID and other metadata
    message = message.replace(/\s*\(Payout ID:[^)]*\)/gi, '')
  }
  
  // Remove ALL fee information from any message
  message = message.replace(/\s*\([^)]*fee included[^)]*\)/gi, '')
  message = message.replace(/\s*\([^)]*Processing fee:[^)]*\)/gi, '')
  message = message.replace(/\s*\([^)]*processing fee[^)]*\)/gi, '')
  message = message.replace(/\s*\([^)]*fee[^)]*\)/gi, '')
  message = message.replace(/\s+\([^)]*fee[^)]*\)/gi, '')
  message = message.replace(/fee included/gi, '')
  message = message.replace(/Processing fee/gi, '')
  message = message.replace(/processing fee/gi, '')
  
  // Remove all fee breakdowns from release messages
  message = message.replace(/Total fee[^.]*/gi, '')
  message = message.replace(/including payment processing[^.]*/gi, '')
  message = message.replace(/platform fee[^.]*/gi, '')
  message = message.replace(/\([^)]*deducted[^)]*\)/gi, '')
  message = message.replace(/Seller receives[^.]*/gi, '')
  
  // Fix double ".00" formatting issues anywhere in the message
  message = message.replace(/(\d+\.\d{2})\.\d{2}/g, '$1') // Remove double .00
  message = message.replace(/(\d+)\.00\.00/g, '$1.00') // Fix .00.00 -> .00
  message = message.replace(/(\d+)\.(\d{2})\.(\d{2})/g, '$1.$2') // Fix any double decimal formatting
  
  // Clean up any double spaces, trailing punctuation, or orphaned parentheses
  message = message.replace(/\s+/g, ' ').trim()
  message = message.replace(/\s*\(\s*\)/g, '') // Remove empty parentheses
  message = message.replace(/\s*\.\s*\./g, '.') // Fix double periods
  message = message.replace(/^\s*\.\s*/g, '') // Remove leading period
  message = message.replace(/\s*,\s*$/g, '') // Remove trailing comma
  message = message.replace(/\s+\./g, '.') // Remove space before period
  
  return message
}

export default function Timeline({ events, isBuyer, isSeller, riftValue, currency }: TimelineProps) {
  const sortedEvents = [...events].sort((a, b) => 
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-light text-gray-800 mb-6 tracking-wide uppercase text-xs">Timeline</h3>
      <div className="relative">
        <div className="space-y-6">
          {sortedEvents.map((event, index) => {
            const filteredMessage = filterMessageForRole(event.message, isBuyer, isSeller, riftValue, currency)
            return (
              <div key={event.id} className="relative flex items-start group">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-50 border border-gray-300 flex items-center justify-center backdrop-blur-sm group-hover:bg-gray-100 transition-colors">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-400 shadow-lg shadow-blue-500/30"></div>
                </div>
                <div className="ml-5 flex-1 pb-6 border-b border-gray-100 last:border-0 last:pb-0">
                  <div className="flex items-start justify-between gap-4 mb-1">
                    <p className="text-sm font-light text-gray-800 leading-relaxed flex-1">{filteredMessage}</p>
                    <time className="text-xs text-[#86868b] font-light whitespace-nowrap">
                      {new Date(event.createdAt).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric' 
                      })}
                      <span className="text-gray-400 ml-1">
                        {new Date(event.createdAt).toLocaleTimeString('en-US', { 
                          hour: 'numeric', 
                          minute: '2-digit' 
                        })}
                      </span>
                    </time>
                  </div>
                  {event.createdBy && (
                    <p className="text-xs text-[#86868b] font-light mt-2">
                      by {event.createdBy?.name || event.createdBy?.email.split('@')[0]}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

