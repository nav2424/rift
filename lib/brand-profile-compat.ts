import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'

export interface LegacyBrandProfile {
  id: string
  userId: string
  companyName: string
  industry: string | null
  website: string | null
  logo: string | null
  bio: string | null
  monthlyBudget: number | null
  verified: boolean
  createdAt: Date
  updatedAt: Date
}

export function isMissingBrandCurrencyColumnError(error: unknown): boolean {
  const maybePrismaError = error as { message?: string; code?: string }
  const message = maybePrismaError?.message || String(error ?? '')
  return (
    maybePrismaError?.code === 'P2022' ||
    (message.includes('BrandProfile') &&
      message.includes('currency') &&
      message.includes('does not exist'))
  )
}

export async function getLegacyBrandProfileIdByUserId(userId: string): Promise<string | null> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM "BrandProfile"
    WHERE "userId" = ${userId}
    LIMIT 1
  `
  return rows[0]?.id ?? null
}

export async function getLegacyBrandProfileByUserId(userId: string): Promise<LegacyBrandProfile | null> {
  const rows = await prisma.$queryRaw<Array<LegacyBrandProfile>>`
    SELECT
      id,
      "userId",
      "companyName",
      industry,
      website,
      logo,
      bio,
      "monthlyBudget",
      verified,
      "createdAt",
      "updatedAt"
    FROM "BrandProfile"
    WHERE "userId" = ${userId}
    LIMIT 1
  `
  return rows[0] ?? null
}

interface UpsertLegacyBrandProfileInput {
  userId: string
  companyName: string
  industry?: string | null
  website?: string | null
  logo?: string | null
  bio?: string | null
  monthlyBudget?: number | null
}

export async function upsertLegacyBrandProfile(
  input: UpsertLegacyBrandProfileInput
): Promise<LegacyBrandProfile> {
  const existingId = await getLegacyBrandProfileIdByUserId(input.userId)

  if (existingId) {
    const updatedRows = await prisma.$queryRaw<Array<LegacyBrandProfile>>`
      UPDATE "BrandProfile"
      SET
        "companyName" = ${input.companyName},
        industry = ${input.industry ?? null},
        website = ${input.website ?? null},
        logo = ${input.logo ?? null},
        bio = ${input.bio ?? null},
        "monthlyBudget" = ${input.monthlyBudget ?? null},
        "updatedAt" = NOW()
      WHERE "userId" = ${input.userId}
      RETURNING
        id,
        "userId",
        "companyName",
        industry,
        website,
        logo,
        bio,
        "monthlyBudget",
        verified,
        "createdAt",
        "updatedAt"
    `
    return updatedRows[0]
  }

  const insertedId = randomUUID()
  const insertedRows = await prisma.$queryRaw<Array<LegacyBrandProfile>>`
    INSERT INTO "BrandProfile" (
      id,
      "userId",
      "companyName",
      industry,
      website,
      logo,
      bio,
      "monthlyBudget",
      verified,
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${insertedId},
      ${input.userId},
      ${input.companyName},
      ${input.industry ?? null},
      ${input.website ?? null},
      ${input.logo ?? null},
      ${input.bio ?? null},
      ${input.monthlyBudget ?? null},
      false,
      NOW(),
      NOW()
    )
    RETURNING
      id,
      "userId",
      "companyName",
      industry,
      website,
      logo,
      bio,
      "monthlyBudget",
      verified,
      "createdAt",
      "updatedAt"
  `
  return insertedRows[0]
}
