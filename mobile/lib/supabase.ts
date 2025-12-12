import { createClient, SupabaseClient } from '@supabase/supabase-js'
import Constants from 'expo-constants'

// Get Supabase config from Expo constants or environment
const getSupabaseConfig = () => {
  // Try Expo config first (for app.json)
  const expoConfig = Constants.expoConfig?.extra
  const supabaseUrl = 
    expoConfig?.supabaseUrl || 
    process.env.EXPO_PUBLIC_SUPABASE_URL || 
    process.env.NEXT_PUBLIC_SUPABASE_URL || 
    ''
  
  const supabaseAnonKey = 
    expoConfig?.supabaseAnonKey || 
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
    ''

  return { supabaseUrl, supabaseAnonKey }
}

const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig()

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase URL or Anon Key not found. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY ' +
    'in your app.json or environment variables.'
  )
}

// Client-side Supabase client (uses anon key)
// Note: This respects RLS policies
export function createClientClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase configuration missing. Please set the following:\n' +
      '- EXPO_PUBLIC_SUPABASE_URL (in app.json extra or environment)\n' +
      '- EXPO_PUBLIC_SUPABASE_ANON_KEY (in app.json extra or environment)\n' +
      'See MESSAGING_UPGRADE.md for setup instructions.'
    )
  }

  return createClient(supabaseUrl, supabaseAnonKey)
}

