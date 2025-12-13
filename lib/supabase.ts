import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Helper to get Supabase URL (read fresh each time for server-side)
function getSupabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
}

// Helper to get Supabase Anon Key (read fresh each time for client-side)
function getSupabaseAnonKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
}

// Server-side Supabase client (uses service role key for admin operations)
// This bypasses RLS policies, so use with caution - we validate access at the API level
export function createServerClient(): SupabaseClient {
  const supabaseUrl = getSupabaseUrl()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  
  if (!supabaseUrl || !serviceRoleKey) {
    const missing: string[] = []
    if (!supabaseUrl) missing.push('SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL')
    if (!serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY')
    
    const isDevelopment = process.env.NODE_ENV === 'development'
    const envFileHint = isDevelopment 
      ? '\n\nFor local development: Ensure these variables are in .env.local and restart your dev server with `npm run dev`'
      : '\n\nFor production: Ensure these environment variables are configured in your hosting platform (Vercel, etc.)'
    
    throw new Error(
      'Supabase configuration missing. Please set the following environment variables:\n' +
      `- ${missing.join('\n- ')}\n` +
      'See MESSAGING_SETUP.md for setup instructions.' +
      envFileHint
    )
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

// Client-side Supabase client (uses anon key)
// Note: This respects RLS policies
// Returns null if configuration is missing (instead of throwing) to prevent client-side crashes
export function createClientClient(): SupabaseClient | null {
  const supabaseUrl = getSupabaseUrl()
  const supabaseAnonKey = getSupabaseAnonKey()
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
      'Supabase configuration missing. Realtime messaging will be disabled. Please set:\n' +
      '- NEXT_PUBLIC_SUPABASE_URL\n' +
      '- NEXT_PUBLIC_SUPABASE_ANON_KEY\n' +
      'See MESSAGING_SETUP.md for setup instructions.'
    )
    return null
  }

  return createClient(supabaseUrl, supabaseAnonKey)
}

