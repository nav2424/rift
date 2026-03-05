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
      message.includes('column') &&
      message.includes('does not exist'))
  )
}

const BASE_SELECT_COLUMNS = [
  'id',
  'userId',
  'companyName',
  'industry',
  'website',
  'logo',
  'bio',
  'monthlyBudget',
  'verified',
  'createdAt',
  'updatedAt',
]

function qid(identifier: string) {
  return `"${identifier.replace(/"/g, '""')}"`
}

function buildSelectClause(columns: Set<string>) {
  return BASE_SELECT_COLUMNS.map((column) =>
    columns.has(column) ? qid(column) : `NULL AS ${qid(column)}`
  ).join(', ')
}

function mapLegacyProfileRow(row: any): LegacyBrandProfile {
  return {
    id: row.id,
    userId: row.userId,
    companyName: row.companyName || 'Brand',
    industry: row.industry ?? null,
    website: row.website ?? null,
    logo: row.logo ?? null,
    bio: row.bio ?? null,
    monthlyBudget: row.monthlyBudget ?? null,
    verified: Boolean(row.verified),
    createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
    updatedAt: row.updatedAt ? new Date(row.updatedAt) : new Date(),
  }
}

async function getBrandProfileColumns(): Promise<Set<string>> {
  const rows = await prisma.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND lower(table_name) = lower('BrandProfile')
  `
  return new Set(rows.map((row) => row.column_name))
}

async function getLegacyBrandProfileIdByUserIdWithColumns(
  userId: string,
  columns: Set<string>
): Promise<string | null> {
  if (!columns.has('id') || !columns.has('userId')) return null

  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT ${qid('id')} FROM ${qid('BrandProfile')} WHERE ${qid('userId')} = $1 LIMIT 1`,
    userId
  )
  return rows[0]?.id ?? null
}

export async function getLegacyBrandProfileIdByUserId(userId: string): Promise<string | null> {
  const columns = await getBrandProfileColumns()
  return getLegacyBrandProfileIdByUserIdWithColumns(userId, columns)
}

export async function getLegacyBrandProfileByUserId(userId: string): Promise<LegacyBrandProfile | null> {
  const columns = await getBrandProfileColumns()
  if (!columns.has('userId')) return null

  const selectClause = buildSelectClause(columns)
  const rows = await prisma.$queryRawUnsafe<Array<any>>(
    `SELECT ${selectClause} FROM ${qid('BrandProfile')} WHERE ${qid('userId')} = $1 LIMIT 1`,
    userId
  )
  if (!rows[0]) return null
  return mapLegacyProfileRow(rows[0])
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
  const columns = await getBrandProfileColumns()
  if (!columns.has('userId')) {
    throw new Error('BrandProfile schema missing required userId column.')
  }

  const existingId = await getLegacyBrandProfileIdByUserIdWithColumns(input.userId, columns)
  const selectClause = buildSelectClause(columns)

  if (existingId) {
    const assignments: string[] = []
    const values: unknown[] = []

    if (columns.has('companyName')) {
      values.push(input.companyName)
      assignments.push(`${qid('companyName')} = $${values.length}`)
    }
    if (columns.has('industry')) {
      values.push(input.industry ?? null)
      assignments.push(`${qid('industry')} = $${values.length}`)
    }
    if (columns.has('website')) {
      values.push(input.website ?? null)
      assignments.push(`${qid('website')} = $${values.length}`)
    }
    if (columns.has('logo')) {
      values.push(input.logo ?? null)
      assignments.push(`${qid('logo')} = $${values.length}`)
    }
    if (columns.has('bio')) {
      values.push(input.bio ?? null)
      assignments.push(`${qid('bio')} = $${values.length}`)
    }
    if (columns.has('monthlyBudget')) {
      values.push(input.monthlyBudget ?? null)
      assignments.push(`${qid('monthlyBudget')} = $${values.length}`)
    }
    if (columns.has('updatedAt')) {
      assignments.push(`${qid('updatedAt')} = NOW()`)
    }

    if (assignments.length > 0) {
      values.push(input.userId)
      const updatedRows = await prisma.$queryRawUnsafe<Array<any>>(
        `UPDATE ${qid('BrandProfile')} SET ${assignments.join(', ')} WHERE ${qid('userId')} = $${values.length} RETURNING ${selectClause}`,
        ...values
      )
      return mapLegacyProfileRow(updatedRows[0])
    }

    const existingRows = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT ${selectClause} FROM ${qid('BrandProfile')} WHERE ${qid('userId')} = $1 LIMIT 1`,
      input.userId
    )
    return mapLegacyProfileRow(existingRows[0])
  }

  const insertColumns: string[] = []
  const insertValues: unknown[] = []

  if (columns.has('id')) {
    insertColumns.push('id')
    insertValues.push(randomUUID())
  }
  if (columns.has('userId')) {
    insertColumns.push('userId')
    insertValues.push(input.userId)
  }
  if (columns.has('companyName')) {
    insertColumns.push('companyName')
    insertValues.push(input.companyName)
  }
  if (columns.has('industry')) {
    insertColumns.push('industry')
    insertValues.push(input.industry ?? null)
  }
  if (columns.has('website')) {
    insertColumns.push('website')
    insertValues.push(input.website ?? null)
  }
  if (columns.has('logo')) {
    insertColumns.push('logo')
    insertValues.push(input.logo ?? null)
  }
  if (columns.has('bio')) {
    insertColumns.push('bio')
    insertValues.push(input.bio ?? null)
  }
  if (columns.has('monthlyBudget')) {
    insertColumns.push('monthlyBudget')
    insertValues.push(input.monthlyBudget ?? null)
  }
  if (columns.has('verified')) {
    insertColumns.push('verified')
    insertValues.push(false)
  }
  if (columns.has('createdAt')) {
    insertColumns.push('createdAt')
    insertValues.push(new Date())
  }
  if (columns.has('updatedAt')) {
    insertColumns.push('updatedAt')
    insertValues.push(new Date())
  }

  if (insertColumns.length === 0) {
    throw new Error('BrandProfile schema has no writable columns.')
  }

  const columnSql = insertColumns.map(qid).join(', ')
  const placeholderSql = insertValues.map((_, index) => `$${index + 1}`).join(', ')

  const insertedRows = await prisma.$queryRawUnsafe<Array<any>>(
    `INSERT INTO ${qid('BrandProfile')} (${columnSql}) VALUES (${placeholderSql}) RETURNING ${selectClause}`,
    ...insertValues
  )
  return mapLegacyProfileRow(insertedRows[0])
}
