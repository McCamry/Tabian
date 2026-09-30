import { PrismaClient } from '@prisma/client'
import path from 'node:path'
import fs from 'node:fs'

// Ensure SQLite database URL is properly configured and directory exists
const rawUrl = process.env.DATABASE_URL || 'file:./tabian.db'
let dbUrl = rawUrl

if (rawUrl.startsWith('file:')) {
  const rawPath = rawUrl.replace(/^file:/, '')

  if (path.isAbsolute(rawPath)) {
    dbUrl = `file:${rawPath.replace(/\\/g, '/')}`
  } else {
    const cleanRelative = rawPath.replace(/^(\.\/|\.\\)/, '')
    const baseName = path.basename(cleanRelative)

    // Candidates where the database file might exist:
    // 1. In prisma directory (where Prisma CLI defaults when given relative path in schema.prisma)
    const inPrisma = path.resolve(process.cwd(), 'prisma', baseName)
    // 2. In root cwd
    const inCwd = path.resolve(process.cwd(), cleanRelative)
    // 3. In prisma directory with full relative path
    const inPrismaRelative = path.resolve(process.cwd(), 'prisma', cleanRelative)

    let finalPath = inPrisma
    if (fs.existsSync(inPrisma)) {
      finalPath = inPrisma
    } else if (fs.existsSync(inCwd)) {
      finalPath = inCwd
    } else if (fs.existsSync(inPrismaRelative)) {
      finalPath = inPrismaRelative
    } else {
      finalPath = inPrisma
    }

    const dir = path.dirname(finalPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    dbUrl = `file:${finalPath.replace(/\\/g, '/')}`
  }

  process.env.DATABASE_URL = dbUrl
}

let prisma: PrismaClient

declare global {
  var __prisma: PrismaClient | undefined
}

const clientConfig = dbUrl.startsWith('file:')
  ? {
      datasources: {
        db: {
          url: dbUrl,
        },
      },
    }
  : undefined

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient(clientConfig)
} else {
  if (!global.__prisma) {
    global.__prisma = new PrismaClient(clientConfig)
  }
  prisma = global.__prisma
}

let schemaInitialized = false

/**
 * Ensures required SQLite tables and indices exist.
 * If tables do not exist, creates them via direct DDL.
 */
export async function ensureDatabaseSchema() {
  if (schemaInitialized) return

  try {
    await prisma.$queryRawUnsafe('SELECT 1 FROM "Plate" LIMIT 1')
    schemaInitialized = true
  } catch {
    console.log('[Database] Plate table missing. Initializing SQLite tables...')
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "BatchImport" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "sourceType" TEXT NOT NULL,
          "sourceReference" TEXT,
          "rawContent" TEXT,
          "totalExtracted" INTEGER NOT NULL DEFAULT 0,
          "totalApproved" INTEGER NOT NULL DEFAULT 0,
          "createdBy" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `)

      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Plate" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "reportType" TEXT NOT NULL,
          "vehicleType" TEXT NOT NULL DEFAULT 'CAR',
          "platePrefix" TEXT NOT NULL,
          "plateNumber" TEXT NOT NULL,
          "province" TEXT NOT NULL,
          "normalizedPlate" TEXT NOT NULL,
          "imageUrl" TEXT,
          "contactName" TEXT NOT NULL,
          "contactPhone" TEXT NOT NULL,
          "pickupLocation" TEXT NOT NULL,
          "latitude" REAL,
          "longitude" REAL,
          "status" TEXT NOT NULL DEFAULT 'ACTIVE',
          "source" TEXT NOT NULL DEFAULT 'DIRECT',
          "sourceUrl" TEXT,
          "sourceImageUrl" TEXT,
          "pinHash" TEXT NOT NULL,
          "batchImportId" TEXT,
          "matchedPlateId" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL,
          CONSTRAINT "Plate_batchImportId_fkey" FOREIGN KEY ("batchImportId") REFERENCES "BatchImport" ("id") ON DELETE SET NULL ON UPDATE CASCADE
        );
      `)

      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "AuditLog" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "plateId" TEXT NOT NULL,
          "action" TEXT NOT NULL,
          "ipAddress" TEXT,
          "userAgent" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "AuditLog_plateId_fkey" FOREIGN KEY ("plateId") REFERENCES "Plate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
        );
      `)

      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Plate_normalizedPlate_idx" ON "Plate"("normalizedPlate");`)
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Plate_plateNumber_province_idx" ON "Plate"("plateNumber", "province");`)
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Plate_reportType_status_createdAt_idx" ON "Plate"("reportType", "status", "createdAt");`)

      schemaInitialized = true
      console.log('[Database] SQLite tables initialized successfully!')
    } catch (createErr) {
      console.error('[Database] Failed to initialize tables:', createErr)
    }
  }
}

export { prisma }
