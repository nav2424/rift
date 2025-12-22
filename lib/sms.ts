/**
 * SMS notification system using Twilio
 */

import twilio from 'twilio'

// Initialize Twilio client
let twilioClient: twilio.Twilio | null = null

function getTwilioClient(): twilio.Twilio | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN

  if (!accountSid || !authToken) {
    return null
  }

  if (!twilioClient) {
    twilioClient = twilio(accountSid, authToken)
  }

  return twilioClient
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

  // In development without Twilio configured, just log
  if (!client || !fromNumber) {
    if (process.env.NODE_ENV === 'development') {
      console.log('📱 SMS would be sent:', { to, message })
      return { success: true }
    }
    return {
      success: false,
      error: 'SMS service not configured. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER environment variables.',
    }
  }

  try {
    // Format phone number (ensure it starts with +)
    const formattedTo = to.startsWith('+') ? to : `+${to}`

    const result = await client.messages.create({
      body: message,
      from: fromNumber,
      to: formattedTo,
    })

    console.log('SMS sent successfully:', result.sid)
    return { success: true }
  } catch (error: any) {
    console.error('SMS send error:', error)
    return {
      success: false,
      error: error.message || 'Failed to send SMS',
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
