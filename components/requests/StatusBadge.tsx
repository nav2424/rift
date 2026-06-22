import { VideoRequestStatus } from '@prisma/client'
import { STATUS_LABELS } from '@/lib/video-requests'

const STYLES: Record<VideoRequestStatus, string> = {
  PENDING_REVIEW: 'bg-[#FAFAFA] text-[#71717A] border-[#E4E4E7]',
  COUNTER_OFFERED: 'bg-[#FAFAFA] text-[#18181B] border-[#E4E4E7]',
  NEGOTIATING: 'bg-[#FAFAFA] text-[#18181B] border-[#E4E4E7]',
  AGREED: 'bg-white text-[#18181B] border-[#18181B]',
  IN_PRODUCTION: 'bg-white text-[#18181B] border-[#18181B]',
  DELIVERED: 'bg-white text-[#18181B] border-[#E4E4E7]',
  CLOSED: 'bg-[#FAFAFA] text-[#71717A] border-[#E4E4E7]',
}

export default function StatusBadge({ status }: { status: VideoRequestStatus | string }) {
  const key = status as VideoRequestStatus
  return (
    <span className={`inline-block text-xs px-2 py-0.5 border rounded ${STYLES[key] || STYLES.PENDING_REVIEW}`}>
      {STATUS_LABELS[key] || status}
    </span>
  )
}
