/**
 * Helper script to log in as AdminUser and get session cookie
 * This demonstrates how to authenticate for admin API endpoints
 */

import fetch from 'node-fetch'

const API_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000'
const EMAIL = 'saluja.arnav04@gmail.com'
const PASSWORD = 'temp-password-123'

async function login() {
  try {
    console.log(`Logging in to ${API_URL}/api/admin/auth/login...`)
    
    const response = await fetch(`${API_URL}/api/admin/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: EMAIL,
        password: PASSWORD,
      }),
    })

    const data = await response.json() as any

    if (!response.ok) {
      console.error('❌ Login failed:', data.error)
      return
    }

    // Get cookies from response
    const setCookieHeader = response.headers.get('set-cookie')
    if (setCookieHeader) {
      console.log('\n✅ Login successful!')
      console.log('\n📋 Set this cookie in your browser:')
      console.log(setCookieHeader)
      console.log('\nOr use this in your browser console:')
      console.log(`document.cookie = "${setCookieHeader.split(';')[0]}"`)
    } else {
      console.log('✅ Login successful, but no cookie found in response')
      console.log('Response:', data)
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message)
  }
}

login()

