/**
 * Upload files for UGC milestone delivery (creates vault_assets records).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { uploadVaultAsset } from '@/lib/vault-enhanced'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: riftId } = await params
    const formData = await request.formData()
    const milestoneId = (formData.get('milestoneId') as string | null) || undefined
    const files = formData.getAll('files') as File[]

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'files are required' }, { status: 400 })
    }

    const assetIds: string[] = []
    for (const file of files) {
      if (!file || file.size === 0) continue
      const assetId = await uploadVaultAsset(riftId, auth.userId, {
        assetType: 'FILE',
        file,
        fileName: file.name,
      })
      assetIds.push(assetId)

      if (milestoneId) {
        await prisma.vault_assets.update({
          where: { id: assetId },
          data: { milestoneId },
        })
      }
    }

    return NextResponse.json({ assetIds }, { status: 201 })
  } catch (error: any) {
    console.error('UGC file upload error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 400 }
    )
  }
}

