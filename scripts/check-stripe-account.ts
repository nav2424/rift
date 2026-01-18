/**
 * Script to identify which Stripe account your API keys belong to
 * Run with: npx tsx scripts/check-stripe-account.ts
 */

import Stripe from 'stripe'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config()

const apiKey = process.env.STRIPE_SECRET_KEY

if (!apiKey) {
  console.error('❌ STRIPE_SECRET_KEY not found in environment variables')
  console.log('\nPlease set STRIPE_SECRET_KEY in your .env.local file')
  process.exit(1)
}

// Determine mode from API key
const mode = apiKey.startsWith('sk_live_') ? 'live' : apiKey.startsWith('sk_test_') ? 'test' : 'unknown'
console.log(`\n🔑 API Key Mode: ${mode.toUpperCase()}`)
console.log(`   Key starts with: ${apiKey.substring(0, 20)}...\n`)

const stripe = new Stripe(apiKey, {
  apiVersion: '2025-11-17.clover' as any,
})

async function checkAccount() {
  try {
    // Try to retrieve account information
    // We'll use a simple API call that returns account info
    const balance = await stripe.balance.retrieve()
    
    console.log('✅ Successfully connected to Stripe account\n')
    console.log(`📊 Account Information:`)
    console.log(`   Mode: ${mode.toUpperCase()}`)
    
    // Get account ID from balance response (if available)
    // Or we can make another API call
    try {
      // Try to get account details via account retrieval (for Connect platforms)
      // This might not work for regular accounts, so we'll catch errors
      const account = await (stripe as any).accounts?.retrieve?.() || null
      if (account?.id) {
        console.log(`   Account ID: ${account.id}`)
        console.log(`   Dashboard URL: https://dashboard.stripe.com/${mode === 'test' ? 'test/' : ''}acct_${account.id}`)
      }
    } catch (e) {
      // Account retrieval might not work for regular accounts
    }
    
    console.log(`\n🔍 Next Steps:`)
    console.log(`   1. Open your Stripe Dashboard: https://dashboard.stripe.com/${mode === 'test' ? 'test/' : ''}`)
    console.log(`   2. Check the account ID in the URL (looks like: acct_1XXXXX...)`)
    console.log(`   3. Make sure you're viewing the same account where you want to create connected accounts`)
    console.log(`   4. Go to Settings → Connect → Platform profile`)
    console.log(`   5. Complete the platform profile if it's not already done\n`)
    
  } catch (error: any) {
    console.error('❌ Error connecting to Stripe:')
    if (error.message) {
      console.error(`   ${error.message}`)
    }
    if (error.code === 'authentication_error' || error.type === 'StripeAuthenticationError') {
      console.error('\n⚠️  This usually means:')
      console.error('   - Your API key is invalid')
      console.error('   - Your API key belongs to a different account')
      console.error('   - Your API key is from test mode but you\'re using live mode (or vice versa)\n')
    }
    process.exit(1)
  }
}

checkAccount()
