import { requireAdmin } from '@/lib/auth-helpers'
import { generateEvidencePacket } from '@/lib/evidence-packet'
import EvidencePrintView from '@/components/EvidencePrintView'

export default async function AdminEvidencePage({
  params,
  searchParams,
}: {
  params: Promise<{ riftId: string }>
  searchParams: Promise<{ disputeId?: string }>
}) {
  await requireAdmin()
  const { riftId } = await params
  const { disputeId } = await searchParams

  try {
    const packet = await generateEvidencePacket(riftId, disputeId || undefined)
    return <EvidencePrintView packet={packet} />
  } catch (error: any) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-white flex items-center justify-center">
        <div className="text-[#86868b] font-light">
          Error generating evidence: {error.message}
        </div>
      </div>
    )
  }
}

