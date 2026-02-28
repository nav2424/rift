import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const checks: Record<string, boolean | string> = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: false,
  }

  try {
    await prisma.$queryRaw`SELECT 1`
    checks.database = true
  } catch {
    checks.database = false
  }

  const healthy = checks.database === true
  
  return NextResponse.json(checks, { status: healthy ? 200 : 503 })
}
