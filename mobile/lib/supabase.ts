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
// Returns null if configuration is missing (instead of throwing) to prevent client-side crashes
export function createClientClient(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
      'Supabase configuration missing. Realtime messaging will be disabled. Please set:\n' +
      '- EXPO_PUBLIC_SUPABASE_URL (in app.json extra or environment)\n' +
      '- EXPO_PUBLIC_SUPABASE_ANON_KEY (in app.json extra or environment)\n' +
      'See MESSAGING_UPGRADE.md for setup instructions.'
    )
    return null
  }

  return createClient(supabaseUrl, supabaseAnonKey)
}

