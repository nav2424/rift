import { requireAdmin } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { createServerClient } from '@/lib/supabase'
import UserRiskView from '@/components/UserRiskView'
import GlassCard from '@/components/ui/GlassCard'

export default async function AdminUserRiskPage({ params }: { params: Promise<{ userId: string }> }) {
  await requireAdmin()
  const { userId } = await params

  const supabase = createServerClient()

  // Get risk profile
  const { data: riskProfile } = await supabase
    .from('risk_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  // Get user restrictions
  const { data: restrictions } = await supabase
    .from('user_restrictions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  // Get last 50 enforcement actions
  const { data: enforcementActions } = await supabase
    .from('enforcement_actions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)

  // Get user info
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      role: true,
    },
  })

  if (!user) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-white flex items-center justify-center">
        <div className="text-[#86868b] font-light">User not found.</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-white">
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-20">
        <h1 className="text-4xl md:text-5xl font-light text-[#1d1d1f] tracking-tight mb-8">
          Risk Profile: {user.name || user.email}
        </h1>
        <UserRiskView
          user={user}
          riskProfile={riskProfile}
          restrictions={restrictions}
          enforcementActions={enforcementActions || []}
        />
      </div>
    </div>
  )
}

