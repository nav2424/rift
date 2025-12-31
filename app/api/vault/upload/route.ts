import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/mobile-auth'
import { uploadToVault, generateFileHash, validateFileType, getAllowedFileTypes } from '@/lib/vault'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/vault/upload
 * Upload a file to Rift Vault
 * Used during Rift creation for digital files
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const riftId = formData.get('riftId') as string | null
    const itemType = formData.get('itemType') as string | null
    const viewOnly = formData.get('viewOnly') === 'true'

    if (!file) {
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      )
    }

    // Validate file type if item type is provided
    if (itemType) {
      const allowedTypes = getAllowedFileTypes(itemType)
      if (!validateFileType(file, allowedTypes)) {
        return NextResponse.json(
          { error: `File type not allowed. Allowed types: ${allowedTypes.join(', ')}` },
          { status: 400 }
        )
      }
    }

    // Generate file hash
    const fileHash = await generateFileHash(file)

    // Check for duplicates (optional - can be enabled later)
    // const exists = await checkFileExistsByHash(fileHash)
    // if (exists) {
    //   return NextResponse.json(
    //     { error: 'This file has already been uploaded' },
    //     { status: 400 }
    //   )
    // }

    // Upload to vault
    const vaultPath = riftId ? `rifts/${riftId}` : 'temp'
    const metadata = await uploadToVault(file, riftId || 'temp', auth.userId, {
      viewOnly,
      folder: vaultPath,
    })

    // If riftId is provided, update the rift with file information
    if (riftId) {
      await prisma.riftTransaction.update({
        where: { id: riftId },
        data: {
          // Legacy fields removed (fileUploadPath, fileHash, fileSize, virusScanStatus don't exist in schema)
          fileStorageType: 'VAULT',
        },
      })
    }

    return NextResponse.json({
      success: true,
      metadata: {
        storagePath: metadata.storagePath,
        fileHash: metadata.fileHash,
        fileName: metadata.fileName,
        sizeBytes: metadata.sizeBytes,
        mimeType: metadata.mimeType,
      },
    })
  } catch (error: any) {
    console.error('Vault upload error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to upload file' },
      { status: 500 }
    )
  }
}

