import { prisma } from './prisma'

export async function generateNextRequestNumber(): Promise<number> {
  const last = await prisma.videoRequest.findFirst({
    orderBy: { requestNumber: 'desc' },
    select: { requestNumber: true },
  })
  return last ? last.requestNumber + 1 : 1000
}
