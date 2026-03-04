import { prisma } from '@/lib/prisma'

let schemaReady = false
let schemaInitPromise: Promise<void> | null = null

export function isMissingInfluencerProspectsTableError(error: unknown): boolean {
  const maybePrismaError = error as { code?: string; message?: string }
  if (maybePrismaError?.code === 'P2021') return true

  const message =
    (typeof error === 'string' ? error : maybePrismaError?.message) ||
    String(error ?? '')

  return message.includes('InfluencerProspect') && message.includes('does not exist')
}

async function createInfluencerProspectsSchema() {
  await prisma.$executeRawUnsafe(`
DO $$
BEGIN
  CREATE TYPE "InfluencerProspectStatus" AS ENUM (
    'LEAD',
    'CONTACTED',
    'NEGOTIATING',
    'READY_TO_DEAL',
    'PASSED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
`)

  await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "InfluencerProspect" (
  "id" TEXT NOT NULL,
  "brandProfileId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "handle" TEXT,
  "platform" TEXT,
  "contactEmail" TEXT,
  "contactPhone" TEXT,
  "outreachDate" TIMESTAMP(3),
  "quotedRate" DOUBLE PRECISION,
  "quotedCurrency" TEXT NOT NULL DEFAULT 'CAD',
  "expectedDeliverables" TEXT,
  "status" "InfluencerProspectStatus" NOT NULL DEFAULT 'LEAD',
  "nextFollowUpDate" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InfluencerProspect_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InfluencerProspect_brandProfileId_fkey"
    FOREIGN KEY ("brandProfileId")
    REFERENCES "BrandProfile"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);
`)

  await prisma.$executeRawUnsafe(`
CREATE INDEX IF NOT EXISTS "InfluencerProspect_brandProfileId_status_idx"
ON "InfluencerProspect"("brandProfileId", "status");
`)

  await prisma.$executeRawUnsafe(`
CREATE INDEX IF NOT EXISTS "InfluencerProspect_brandProfileId_updatedAt_idx"
ON "InfluencerProspect"("brandProfileId", "updatedAt");
`)
}

export async function ensureInfluencerProspectsSchema() {
  if (schemaReady) return

  if (!schemaInitPromise) {
    schemaInitPromise = createInfluencerProspectsSchema()
      .then(() => {
        schemaReady = true
      })
      .finally(() => {
        schemaInitPromise = null
      })
  }

  await schemaInitPromise
}
