/**
 * Carrier API Integration for Tracking Number Validation
 * Supports AfterShip API (1200+ carriers) and direct carrier APIs
 */

interface CarrierAPIResult {
  isValid: boolean
  isDelivered: boolean
  deliveryDate?: Date
  status?: string
  carrier?: string
  error?: string
  trackingEvents?: Array<{
    timestamp: Date
    location?: string
    description: string
    status: string
  }>
}

/**
 * Verify tracking number using AfterShip API (supports 1200+ carriers)
 */
async function verifyWithAfterShip(trackingNumber: string, carrier?: string): Promise<CarrierAPIResult> {
  const apiKey = process.env.AFTERSHIP_API_KEY
  
  if (!apiKey) {
    throw new Error('AFTERSHIP_API_KEY not configured')
  }
  
  try {
    // AfterShip API endpoint
    const url = carrier
      ? `https://api.aftership.com/v4/trackings/${carrier.toLowerCase()}/${trackingNumber}`
      : `https://api.aftership.com/v4/trackings/${trackingNumber}`
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'aftership-api-key': apiKey,
        'Content-Type': 'application/json',
      },
    })
    
    if (!response.ok) {
      if (response.status === 404) {
        return {
          isValid: false,
          isDelivered: false,
          error: 'Tracking number not found in carrier system',
        }
      }
      throw new Error(`AfterShip API error: ${response.statusText}`)
    }
    
    const data = await response.json()
    const tracking = data.data?.tracking
    
    if (!tracking) {
      return {
        isValid: false,
        isDelivered: false,
        error: 'Invalid response from AfterShip API',
      }
    }
    
    // Parse tracking events
    const events = tracking.checkpoints?.map((checkpoint: any) => ({
      timestamp: new Date(checkpoint.checkpoint_time),
      location: checkpoint.location || undefined,
      description: checkpoint.message || '',
      status: checkpoint.tag || '',
    })) || []
    
    // Determine delivery status
    const tag = tracking.tag?.toLowerCase() || ''
    const isDelivered = tag === 'delivered' || tag === 'exception' || tag === 'info_received'
    const deliveryDate = isDelivered && tracking.expected_delivery
      ? new Date(tracking.expected_delivery)
      : events.find(e => e.status.toLowerCase() === 'delivered')?.timestamp
    
    return {
      isValid: true,
      isDelivered,
      deliveryDate,
      status: tracking.tag || 'unknown',
      carrier: tracking.slug || carrier,
      trackingEvents: events,
    }
  } catch (error: any) {
    console.error('AfterShip API error:', error)
    return {
      isValid: false,
      isDelivered: false,
      error: error.message || 'AfterShip API request failed',
    }
  }
}

/**
 * Detect carrier using AfterShip API
 */
export async function detectCarrierWithAPI(trackingNumber: string): Promise<string | null> {
  const apiKey = process.env.AFTERSHIP_API_KEY
  
  if (!apiKey) {
    return null
  }
  
  try {
    // AfterShip can detect carrier from tracking number
    const url = `https://api.aftership.com/v4/couriers/detect`
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'aftership-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tracking: {
          tracking_number: trackingNumber,
        },
      }),
    })
    
    if (!response.ok) {
      return null
    }
    
    const data = await response.json()
    const couriers = data.data?.couriers || []
    
    if (couriers.length > 0) {
      return couriers[0].slug || null
    }
    
    return null
  } catch (error) {
    console.error('Carrier detection error:', error)
    return null
  }
}

/**
 * Verify tracking number with carrier API
 * Tries AfterShip first, then falls back to direct carrier APIs
 */
export async function verifyTrackingWithAPI(
  trackingNumber: string,
  carrier?: string
): Promise<CarrierAPIResult> {
  // Try AfterShip first (supports most carriers)
  if (process.env.AFTERSHIP_API_KEY) {
    try {
      const detectedCarrier = carrier || await detectCarrierWithAPI(trackingNumber)
      const result = await verifyWithAfterShip(trackingNumber, detectedCarrier || undefined)
      
      if (result.isValid) {
        return result
      }
    } catch (error) {
      console.error('AfterShip verification failed, trying direct APIs:', error)
    }
  }
  
  // Fallback to direct carrier APIs (if configured)
  // This would call the existing checkCarrierAPI functions
  // For now, return format validation only
  return {
    isValid: true,
    isDelivered: false,
    status: 'IN_TRANSIT',
    carrier: carrier || 'UNKNOWN',
    error: 'API verification not available, format validated only',
  }
}

/**
 * Enhanced tracking verification with API integration
 */
export async function verifyTrackingEnhanced(
  trackingNumber: string,
  carrier?: string
): Promise<CarrierAPIResult & {
  formatValid: boolean
  apiVerified: boolean
}> {
  // Step 1: Format validation
  const formatValid = validateTrackingFormat(trackingNumber, carrier)
  
  if (!formatValid) {
    return {
      isValid: false,
      isDelivered: false,
      formatValid: false,
      apiVerified: false,
      error: 'Invalid tracking number format',
      carrier: carrier || undefined,
    }
  }
  
  // Step 2: API verification (if configured)
  if (process.env.AFTERSHIP_API_KEY || carrier) {
    try {
      const apiResult = await verifyTrackingWithAPI(trackingNumber, carrier)
      
      return {
        ...apiResult,
        formatValid: true,
        apiVerified: true,
      }
    } catch (error: any) {
      // API failed, but format is valid
      return {
        isValid: true,
        isDelivered: false,
        formatValid: true,
        apiVerified: false,
        status: 'IN_TRANSIT',
        carrier: carrier || undefined,
        error: `Format valid but API verification failed: ${error.message}`,
      }
    }
  }
  
  // Format valid but no API configured
  return {
    isValid: true,
    isDelivered: false,
    formatValid: true,
    apiVerified: false,
    status: 'FORMAT_VALID',
    carrier: carrier || undefined,
  }
}

/**
 * Basic format validation (from tracking-verification.ts)
 */
function validateTrackingFormat(trackingNumber: string, carrier?: string): boolean {
  if (!trackingNumber || trackingNumber.trim().length === 0) {
    return false
  }
  
  const normalized = trackingNumber.trim().toUpperCase()
  
  const patterns: Record<string, RegExp> = {
    UPS: /^1Z[0-9A-Z]{16}$/,
    FEDEX: /^\d{12,14}$/,
    USPS: /^9[0-9]{20,22}$|^[0-9]{20,22}$|^[A-Z]{2}[0-9]{9}[A-Z]{2}$/,
    DHL: /^\d{10,11}$/,
  }
  
  if (carrier) {
    const pattern = patterns[carrier.toUpperCase()]
    if (pattern) {
      return pattern.test(normalized)
    }
  }
  
  return Object.values(patterns).some(pattern => pattern.test(normalized))
}

