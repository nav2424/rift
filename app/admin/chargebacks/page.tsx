import { requireAdmin } from '@/lib/auth-helpers'
import { createServerClient } from '@/lib/supabase'
import ChargebacksList from '@/components/ChargebacksList'
import GlassCard from '@/components/ui/GlassCard'

export default async function AdminChargebacksPage() {
  await requireAdmin()

  const supabase = createServerClient()

  const { data: disputes } = await supabase
    .from('stripe_disputes')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <div className="min-h-screen relative overflow-hidden bg-black">
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-20">
        <h1 className="text-4xl md:text-5xl font-light text-white tracking-tight mb-8">
          Chargebacks & Disputes
        </h1>
        <GlassCard className="p-6">
          <ChargebacksList initialDisputes={disputes || []} />
        </GlassCard>
      </div>
    </div>
  )
}

