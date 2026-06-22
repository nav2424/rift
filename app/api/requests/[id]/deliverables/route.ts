import { NextRequest, NextResponse } from 'next/server'
import { requireRequestAuth, loadRequestForUser } from '@/lib/request-access'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomBytes, randomUUID } from 'crypto'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await requireRequestAuth(request)
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
    if (result.auth.userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const existing = await loadRequestForUser(id, result.auth.userId, 'ADMIN')
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 })

    const ext = file.name.split('.').pop() || 'mp4'
    const storedName = `${Date.now()}-${randomBytes(8).toString('hex')}.${ext}`
    const dir = join(process.cwd(), 'public', 'uploads', 'requests', id)
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, storedName), Buffer.from(await file.arrayBuffer()))

    const deliverable = await prisma.requestDeliverable.create({
      data: {
        id: randomUUID(),
        requestId: id,
        fileName: file.name,
        fileUrl: `/uploads/requests/${id}/${storedName}`,
      },
    })

    return NextResponse.json({ deliverable }, { status: 201 })
  } catch (e) {
    console.error('Upload deliverable error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
