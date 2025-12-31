/**
 * Test Twilio SMS sending
 * Run: npx tsx scripts/test-twilio.ts <phone_number>
 * 
 * Note: This script loads env vars manually from .env.local
 * Next.js automatically loads .env.local, but standalone scripts need manual loading
 */

// Manually load .env.local file
import { readFileSync } from 'fs'
import { resolve } from 'path'

try {
  const envFile = readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8')
  envFile.split('\n').forEach(line => {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...valueParts] = trimmed.split('=')
      const value = valueParts.join('=').replace(/^["']|["']$/g, '') // Remove quotes
      if (!process.env[key]) {
        process.env[key] = value
      }
    }
  })
} catch (error) {
  console.warn('Could not load .env.local file:', error)
}

import { sendSMS } from '../lib/sms'

async function testTwilio() {
  const phoneNumber = process.argv[2]
  
  if (!phoneNumber) {
    console.error('Usage: tsx scripts/test-twilio.ts <phone_number>')
    console.error('Example: tsx scripts/test-twilio.ts +1234567890')
    process.exit(1)
  }

  console.log('Testing Twilio SMS...\n')
  console.log('Environment check:')
  console.log('TWILIO_ACCOUNT_SID:', process.env.TWILIO_ACCOUNT_SID ? `SET (${process.env.TWILIO_ACCOUNT_SID.substring(0, 5)}...)` : '❌ NOT SET')
  console.log('TWILIO_AUTH_TOKEN:', process.env.TWILIO_AUTH_TOKEN ? `SET (${process.env.TWILIO_AUTH_TOKEN.substring(0, 5)}...)` : '❌ NOT SET')
  console.log('TWILIO_PHONE_NUMBER:', process.env.TWILIO_PHONE_NUMBER ? `SET (${process.env.TWILIO_PHONE_NUMBER})` : '❌ NOT SET')
  console.log('')

  const testMessage = `Test SMS from Rift - ${new Date().toISOString()}`
  
  console.log(`Sending test SMS to: ${phoneNumber}`)
  console.log(`Message: ${testMessage}\n`)

  try {
    const result = await sendSMS(phoneNumber, testMessage)
    
    if (result.success) {
      console.log('✅ SMS sent successfully!')
      console.log('Check your phone for the message.')
    } else {
      console.error('❌ SMS send failed:')
      console.error(`Error: ${result.error}`)
      process.exit(1)
    }
  } catch (error: any) {
    console.error('❌ Unexpected error:')
    console.error(error)
    process.exit(1)
  }
}

testTwilio()

