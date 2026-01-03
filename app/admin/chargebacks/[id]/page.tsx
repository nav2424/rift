import { requireAdmin } from '@/lib/auth-helpers'
import { createServerClient } from '@/lib/supabase'
import { prisma } from '@/lib/prisma'
import ChargebackDetail from '@/components/ChargebackDetail'

export default async function AdminChargebackDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdmin()
  const { id: disputeId } = await params

  const supabase = createServerClient()

  // Get dispute
  const { data: dispute } = await supabase
    .from('stripe_disputes')
    .select('*')
    .eq('stripe_dispute_id', disputeId)
    .maybeSingle()

  if (!dispute) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-black flex items-center justify-center">
        <div className="text-white/60 font-light">Dispute not found.</div>
      </div>
    )
  }

  // Get rift if available
  let rift = null
  if (dispute.rift_id) {
    rift = await prisma.escrowTransaction.findUnique({
      where: { id: dispute.rift_id },
      select: {
        id: true,
        riftNumber: true,
        itemTitle: true,
        itemType: true,
        subtotal: true,
        currency: true,
        status: true,
        buyerId: true,
        sellerId: true,
        createdAt: true,
      },
    })
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-black">
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-20">
        <h1 className="text-4xl md:text-5xl font-light text-white tracking-tight mb-8">
          Stripe Dispute: {disputeId.slice(-8)}
        </h1>
        <ChargebackDetail dispute={dispute} rift={rift} />
      </div>
    </div>
  )
}

