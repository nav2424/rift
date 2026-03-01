/**
 * File content scanner
 * Validates file content by checking magic bytes (file signatures)
 * Prevents malicious files disguised with wrong MIME types/extensions
 */

// Magic byte signatures for common file types
const SIGNATURES: Array<{
  mimeTypes: string[]
  bytes: number[]
  offset?: number
}> = [
  // Images
  { mimeTypes: ['image/jpeg'], bytes: [0xFF, 0xD8, 0xFF] },
  { mimeTypes: ['image/png'], bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] },
  { mimeTypes: ['image/gif'], bytes: [0x47, 0x49, 0x46, 0x38] },
  { mimeTypes: ['image/webp'], bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 }, // RIFF header, WebP at offset 8
  { mimeTypes: ['image/bmp'], bytes: [0x42, 0x4D] },
  { mimeTypes: ['image/tiff'], bytes: [0x49, 0x49, 0x2A, 0x00] }, // Little-endian TIFF
  { mimeTypes: ['image/tiff'], bytes: [0x4D, 0x4D, 0x00, 0x2A] }, // Big-endian TIFF

  // Documents
  { mimeTypes: ['application/pdf'], bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF

  // Archives
  { mimeTypes: ['application/zip', 'application/x-zip-compressed'], bytes: [0x50, 0x4B, 0x03, 0x04] },
  { mimeTypes: ['application/gzip'], bytes: [0x1F, 0x8B] },

  // Office documents (OOXML uses ZIP)
  {
    mimeTypes: [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ],
    bytes: [0x50, 0x4B, 0x03, 0x04], // ZIP signature (OOXML is ZIP-based)
  },

  // Legacy Office (OLE2)
  {
    mimeTypes: [
      'application/msword',
      'application/vnd.ms-excel',
      'application/vnd.ms-powerpoint',
    ],
    bytes: [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1],
  },

  // Video
  { mimeTypes: ['video/mp4'], bytes: [0x00, 0x00, 0x00], offset: 0 }, // ftyp box at offset 4
  { mimeTypes: ['video/webm'], bytes: [0x1A, 0x45, 0xDF, 0xA3] },

  // Audio
  { mimeTypes: ['audio/mpeg'], bytes: [0xFF, 0xFB] }, // MP3
  { mimeTypes: ['audio/mpeg'], bytes: [0x49, 0x44, 0x33] }, // MP3 with ID3 tag
  { mimeTypes: ['audio/wav'], bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF header
]

// Dangerous patterns to reject
const DANGEROUS_PATTERNS = [
  { name: 'EXE/DLL', bytes: [0x4D, 0x5A] }, // MZ header (Windows executables)
  { name: 'ELF', bytes: [0x7F, 0x45, 0x4C, 0x46] }, // ELF header (Linux executables)
  { name: 'Mach-O', bytes: [0xFE, 0xED, 0xFA, 0xCE] }, // Mach-O (macOS executables)
  { name: 'Mach-O', bytes: [0xFE, 0xED, 0xFA, 0xCF] }, // Mach-O 64-bit
  { name: 'Java class', bytes: [0xCA, 0xFE, 0xBA, 0xBE] },
  { name: 'Shell script', bytes: [0x23, 0x21] }, // #! shebang
]

export interface FileScanResult {
  safe: boolean
  detectedType: string | null
  claimedType: string
  reason?: string
}

/**
 * Scan a file buffer for safety
 * Checks magic bytes against claimed MIME type and rejects dangerous files
 */
export function scanFileContent(
  buffer: Buffer,
  claimedMimeType: string
): FileScanResult {
  if (buffer.length < 4) {
    return {
      safe: false,
      detectedType: null,
      claimedType: claimedMimeType,
      reason: 'File too small to verify content type',
    }
  }

  // Check for dangerous file types
  for (const pattern of DANGEROUS_PATTERNS) {
    if (matchesBytes(buffer, pattern.bytes, 0)) {
      return {
        safe: false,
        detectedType: pattern.name,
        claimedType: claimedMimeType,
        reason: `Dangerous file type detected: ${pattern.name}`,
      }
    }
  }

  // Check for embedded scripts in text-like files
  if (claimedMimeType.startsWith('text/') || claimedMimeType === 'application/json') {
    const content = buffer.slice(0, 1024).toString('utf-8').toLowerCase()
    if (content.includes('<script') || content.includes('javascript:') || content.includes('vbscript:')) {
      return {
        safe: false,
        detectedType: 'text with embedded script',
        claimedType: claimedMimeType,
        reason: 'File contains embedded script content',
      }
    }
  }

  // For known file types, verify magic bytes match claimed type
  const detectedTypes = detectFileType(buffer)
  
  if (detectedTypes.length === 0) {
    // Unknown file type — allow if not dangerous (already checked above)
    return {
      safe: true,
      detectedType: 'unknown',
      claimedType: claimedMimeType,
    }
  }

  // Check if claimed type matches detected type
  const claimedBase = claimedMimeType.split(';')[0].trim().toLowerCase()
  const typeMatches = detectedTypes.some(dt => dt.toLowerCase() === claimedBase)
  
  // Allow ZIP-based types to match each other (OOXML docs are ZIPs)
  const zipTypes = ['application/zip', 'application/x-zip-compressed',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation']
  const isZipFamily = detectedTypes.some(dt => zipTypes.includes(dt)) && zipTypes.includes(claimedBase)

  if (!typeMatches && !isZipFamily) {
    return {
      safe: false,
      detectedType: detectedTypes[0],
      claimedType: claimedMimeType,
      reason: `MIME type mismatch: claimed ${claimedMimeType} but detected ${detectedTypes[0]}`,
    }
  }

  return {
    safe: true,
    detectedType: detectedTypes[0],
    claimedType: claimedMimeType,
  }
}

function matchesBytes(buffer: Buffer, signature: number[], offset: number): boolean {
  if (buffer.length < offset + signature.length) return false
  return signature.every((byte, i) => buffer[offset + i] === byte)
}

function detectFileType(buffer: Buffer): string[] {
  const matches: string[] = []
  for (const sig of SIGNATURES) {
    if (matchesBytes(buffer, sig.bytes, sig.offset || 0)) {
      matches.push(...sig.mimeTypes)
    }
  }
  return [...new Set(matches)]
}
