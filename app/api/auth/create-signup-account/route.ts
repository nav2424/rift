import { NextRequest, NextResponse } from 'next/server'
import { createSignupSession } from '@/lib/signup-session'
import { generateVerificationCode } from '@/lib/verification-codes'
import { sendEmail } from '@/lib/email'

/**
 * Create a signup session (temporary storage before user account is created)
 * User account is NOT created until email, phone, and password are all verified
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { firstName, lastName, birthday, email } = body

    // Validation
    if (!firstName || !lastName || !birthday || !email) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      )
    }

    // Create signup session (checks for existing email/phone in User table)
    let sessionId: string
    try {
      sessionId = await createSignupSession({
        email,
        firstName,
        lastName,
        name: `${firstName.trim()} ${lastName.trim()}`.trim(),
        birthday: new Date(birthday),
      })
    } catch (error: any) {
      if (error.message.includes('already registered')) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        )
      }
      throw error
    }

    // Generate and send email verification code (linked to session, not user)
    const emailCode = await generateVerificationCode(sessionId, 'EMAIL', email, true)
    const emailHtml = `
      <h2>Verify Your Email</h2>
      <p>Your verification code is: <strong>${emailCode}</strong></p>
      <p>This code will expire in 15 minutes.</p>
      <p>If you didn't request this code, please ignore this email.</p>
    `
    const emailSent = await sendEmail(email, 'Verify Your Email - Rift', emailHtml)

    const isDevelopment = process.env.NODE_ENV === 'development' || 
                          process.env.NODE_ENV !== 'production' ||
                          process.env.VERCEL_ENV !== 'production'

    // Log status
    if (emailSent) {
      console.log('✅ Verification email sent successfully to:', email)
    } else {
      console.warn('⚠️ Email not sent. SMTP may not be configured. Check SMTP_USER and SMTP_PASSWORD in .env.local')
      if (isDevelopment) {
        console.warn('   Dev code:', emailCode)
      }
    }

    return NextResponse.json({
      sessionId, // Return sessionId instead of userId
      // Only return code in development if email failed to send (for testing purposes only)
      emailCode: !emailSent && isDevelopment ? emailCode : undefined,
      emailSent,
      message: emailSent 
        ? 'Signup session created. Please check your email for the verification code.'
        : (isDevelopment 
          ? 'Signup session created. Email not sent (SMTP not configured). Check console for verification code.'
          : 'Signup session created. Please verify your email.'),
    }, { status: 201 })
  } catch (error: any) {
    console.error('Create signup session error:', error)
    
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

