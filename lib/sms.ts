/**
 * SMS notification system using Twilio
 */

import twilio from 'twilio'

// Create Twilio client dynamically (creates new client each time to pick up env changes)
function getTwilioClient(): twilio.Twilio | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN

  if (!accountSid || !authToken) {
    return null
  }

  // Create client each time to ensure we use latest env vars (like email transporter)
  return twilio(accountSid, authToken)
}

/**
 * Format phone number to E.164 format (required by Twilio)
 * Handles various input formats:
 * - With/without country code
 * - With/without formatting (spaces, dashes, parentheses)
 * - US numbers (adds +1 if missing)
 * - International numbers (ensures + prefix)
 */
export function formatPhoneNumber(phoneNumber: string): { formatted: string; error?: string } {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return { formatted: '', error: 'Phone number is required' }
  }

  // Remove all non-digit characters except +
  let cleaned = phoneNumber.trim().replace(/[^\d+]/g, '')

  // Remove leading zeros
  cleaned = cleaned.replace(/^0+/, '')

  // If it already starts with +, use as is (international format)
  if (cleaned.startsWith('+')) {
    // Validate E.164 format: + followed by 1-15 digits
    if (!/^\+\d{1,15}$/.test(cleaned)) {
      return { formatted: '', error: 'Invalid international phone number format' }
    }
    return { formatted: cleaned }
  }

  // If it starts with 1 and has 11 digits, treat as US number with country code
  if (cleaned.startsWith('1') && cleaned.length === 11) {
    return { formatted: `+${cleaned}` }
  }

  // If it's 10 digits, assume US number and add +1
  if (cleaned.length === 10 && /^\d{10}$/.test(cleaned)) {
    return { formatted: `+1${cleaned}` }
  }

  // If it's 11 digits starting with 1, add +
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return { formatted: `+${cleaned}` }
  }

  // For other lengths, try to add + if it looks like it might be international
  // (but this is a fallback - proper validation would use a library)
  if (cleaned.length >= 10 && cleaned.length <= 15) {
    return { formatted: `+${cleaned}` }
  }

  return { formatted: '', error: 'Invalid phone number format. Please include country code (e.g., +1 for US/Canada)' }
}

/**
 * Validate phone number format
 */
export function validatePhoneNumber(phoneNumber: string): { valid: boolean; error?: string } {
  const { formatted, error } = formatPhoneNumber(phoneNumber)
  
  if (error) {
    return { valid: false, error }
  }

  // E.164 format: + followed by 1-15 digits
  if (!/^\+\d{1,15}$/.test(formatted)) {
    return { valid: false, error: 'Invalid phone number format' }
  }

  return { valid: true }
}

/**
 * Send SMS via Twilio
 */
export async function sendSMS(
  to: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  const client = getTwilioClient()
  const fromNumber = process.env.TWILIO_PHONE_NUMBER

  // In development/localhost without Twilio configured, allow simulation (safe - no credentials)
  const isDevelopment = process.env.NODE_ENV === 'development' || 
                        process.env.NODE_ENV !== 'production' ||
                        process.env.VERCEL_ENV !== 'production'
  
  if (!client || !fromNumber) {
    if (isDevelopment) {
      console.log('📱 SMS would be sent:', { to, message: message.substring(0, 50) + '...' }) // Truncate message for privacy
      return { success: true }
    }
    return {
      success: false,
      error: 'SMS service not configured. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER environment variables.',
    }
  }

  try {
    // Format phone number to E.164 format
    const { formatted: formattedTo, error: formatError } = formatPhoneNumber(to)
    
    if (formatError) {
      return {
        success: false,
        error: formatError,
      }
    }

    const result = await client.messages.create({
      body: message,
      from: fromNumber!,
      to: formattedTo,
    })

    // Log success (safe to log - no credentials)
    console.log('✅ SMS sent successfully via Twilio:', { to: formattedTo, sid: result.sid })
    return { success: true }
  } catch (error: any) {
    // Log error safely (don't expose credentials or full error details)
    const errorCode = error.code
    const errorStatus = error.status
    console.error('❌ SMS send error:', { 
      code: errorCode, 
      status: errorStatus,
      message: error.message ? error.message.substring(0, 200) : 'Unknown error', // Increased limit for debugging
      moreInfo: error.moreInfo ? error.moreInfo.substring(0, 200) : undefined,
    })
    
    // Provide user-friendly error messages
    let errorMessage = 'Failed to send SMS'
    
    // Handle common Twilio errors
    if (error.code === 21211) {
      errorMessage = 'Invalid phone number format. Please check the number and try again.'
    } else if (error.code === 21608) {
      errorMessage = 'Phone number is not reachable. Please check the number and try again.'
    } else if (error.code === 21614) {
      errorMessage = 'Phone number cannot receive SMS messages.'
    } else if (error.code === 20003 || error.code === 20008) {
      errorMessage = 'SMS service authentication error. Please verify your TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are correct.'
    } else if (error.code === 21408) {
      errorMessage = 'Invalid Twilio phone number. Please verify TWILIO_PHONE_NUMBER is correct.'
    }
    
    // In development, include more details in error message
    if (process.env.NODE_ENV === 'development') {
      errorMessage += ` (Twilio Error ${errorCode}: ${error.message?.substring(0, 100) || 'Unknown error'})`
    }
    
    return {
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Send phone verification code via SMS
 */
export async function sendVerificationCodeSMS(
  phoneNumber: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  const message = `Your Rift verification code is: ${code}. This code expires in 15 minutes.`
  return sendSMS(phoneNumber, message)
}
