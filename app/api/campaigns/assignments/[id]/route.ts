import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import { completeCampaignMilestone } from '@/lib/campaigns'
import { sendCampaignRevisionEmail } from '@/lib/campaign-email'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomBytes } from 'crypto'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const assignment = await prisma.creatorAssignment.findUnique({
      where: { id },
      include: { campaign: true },
    })

    if (!assignment) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })

    const isAdmin = auth.userRole === 'ADMIN'
    const isCreator = assignment.creatorId === auth.userId

    if (!isAdmin && !isCreator) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const contentType = request.headers.get('content-type') || ''
    const data: Record<string, unknown> = { updatedAt: new Date() }
    let requestRevision = false
    let revisionNotes = ''

    if (contentType.includes('multipart/form-data') && isCreator) {
      const formData = await request.formData()
      const file = formData.get('file') as File | null
      if (!file) return NextResponse.json({ error: 'File is required' }, { status: 400 })

      const maxSize = 500 * 1024 * 1024
      if (file.size > maxSize) {
        return NextResponse.json({ error: 'File exceeds 500MB limit' }, { status: 400 })
      }

      const ext = file.name.split('.').pop() || 'mp4'
      const fileName = `${Date.now()}-${randomBytes(8).toString('hex')}.${ext}`
      const dir = join(process.cwd(), 'public', 'uploads', 'campaigns', id)
      await mkdir(dir, { recursive: true })
      const buffer = Buffer.from(await file.arrayBuffer())
      await writeFile(join(dir, fileName), buffer)

      data.videoFilePath = `/uploads/campaigns/${id}/${fileName}`
      data.videoFileName = file.name
      data.uploadedAt = new Date()
      data.status = 'UPLOADED'
      data.revisionNotes = null
    } else {
      const body = await request.json()

      if (isAdmin) {
        if (body.status === 'REVISION_REQUESTED') {
          data.status = 'REVISION_REQUESTED'
          data.revisionNotes = body.revisionNotes || 'Please revise your video.'
          requestRevision = true
          revisionNotes = String(data.revisionNotes)
        }
        if (body.status === 'APPROVED') {
          data.status = 'APPROVED'
          data.reviewedAt = new Date()
          data.reviewedById = auth.userId
        }
        if (body.payoutStatus === 'APPROVED') {
          data.payoutStatus = 'APPROVED'
        }
        if (body.payoutStatus === 'PAID') {
          data.payoutStatus = 'PAID'
          data.paidAt = new Date()
        }
      }

      if (isCreator && body.status === 'IN_PROGRESS') {
        data.status = 'IN_PROGRESS'
      }
    }

    const updated = await prisma.creatorAssignment.update({
      where: { id },
      data,
      include: {
        campaign: true,
        creator: { select: { id: true, name: true, email: true } },
      },
    })

    const allAssignments = await prisma.creatorAssignment.findMany({
      where: { campaignId: assignment.campaignId },
    })
    const allUploaded = allAssignments.length > 0 && allAssignments.every((a) =>
      ['UPLOADED', 'REVISION_REQUESTED', 'APPROVED'].includes(a.status)
    )
    const allApproved = allAssignments.length > 0 && allAssignments.every((a) => a.status === 'APPROVED')

    if (allUploaded) {
      await prisma.campaign.update({
        where: { id: assignment.campaignId },
        data: { status: 'CONTENT_UPLOADED', updatedAt: new Date() },
      })
      await completeCampaignMilestone(assignment.campaignId, 'content_uploaded', prisma)
    }

    if (allApproved) {
      await prisma.campaign.update({
        where: { id: assignment.campaignId },
        data: { status: 'CONTENT_REVIEWED', updatedAt: new Date() },
      })
      await completeCampaignMilestone(assignment.campaignId, 'content_reviewed', prisma)
    }

    if (requestRevision && updated.creator.email) {
      sendCampaignRevisionEmail(
        updated.creator.email,
        updated.campaign.campaignNumber,
        revisionNotes
      ).catch((err) => console.error('Revision email failed:', err))
    }

    return NextResponse.json({ assignment: updated })
  } catch (error: unknown) {
    console.error('Update assignment error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
