import { requireAdmin } from '@/lib/auth-helpers'
import DisputeCaseView from '@/components/DisputeCaseView'

export default async function AdminDisputeCasePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdmin()
  const { id } = await params

  return (
    <div className="min-h-screen relative overflow-hidden bg-black">
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-20">
        <DisputeCaseView disputeId={id} />
      </div>
    </div>
  )
}

