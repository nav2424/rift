import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRequestAuth, isBrandUser } from '@/lib/request-access'
import { generateNextRequestNumber } from '@/lib/request-number'
import { randomUUID } from 'crypto'
import { VideoFormat, VideoLength } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const result = await requireRequestAuth(request)
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })

    const { auth } = result
    const isAdmin = auth.userRole === 'ADMIN'

    const requests = await prisma.videoRequest.findMany({
      where: isAdmin ? {} : { brandId: auth.userId },
      include: {
        brand: { select: { id: true, name: true, email: true } },
        deliverables: { select: { id: true } },
        milestones: { select: { id: true, completedAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ requests })
  } catch (e) {
    console.error('List requests error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await requireRequestAuth(request)
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })

    const { auth } = result
    if (auth.userRole !== 'ADMIN' && !(await isBrandUser(auth.userId))) {
      return NextResponse.json({ error: 'Only brands can submit requests' }, { status: 403 })
    }

    const body = await request.json()
    const {
      script,
      styleNotes,
      format,
      length,
      videoCount,
      offeredPricePerVideo,
      deadline,
    } = body

    if (!script || !format || !length || !videoCount || offeredPricePerVideo == null || !deadline) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const parsedDeadline = new Date(deadline)
    if (Number.isNaN(parsedDeadline.getTime())) {
      return NextResponse.json({ error: 'Invalid deadline' }, { status: 400 })
    }

    const id = randomUUID()
    const requestNumber = await generateNextRequestNumber()

    const videoRequest = await prisma.videoRequest.create({
      data: {
        id,
        requestNumber,
        brandId: auth.userId,
        script,
        styleNotes: styleNotes || null,
        format: format as VideoFormat,
        length: length as VideoLength,
        videoCount: Number(videoCount),
        offeredPricePerVideo: Number(offeredPricePerVideo),
        deadline: parsedDeadline,
        status: 'PENDING_REVIEW',
        updatedAt: new Date(),
      },
      include: {
        brand: { select: { id: true, name: true, email: true } },
      },
    })

    return NextResponse.json({ request: videoRequest }, { status: 201 })
  } catch (e) {
    console.error('Create request error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
