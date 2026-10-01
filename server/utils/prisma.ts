import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import path from 'node:path'
import fs from 'node:fs'

// Determine if Turso Cloud SQLite (LibSQL) is configured
const tursoUrl =
  process.env.TURSO_DATABASE_URL ||
  (process.env.DATABASE_URL?.startsWith('libsql:') ? process.env.DATABASE_URL : undefined)
const tursoAuthToken = process.env.TURSO_AUTH_TOKEN

export function isTursoConfigured(): boolean {
  return Boolean(tursoUrl)
}

export function getDatabaseType(): 'TURSO_CLOUD_SQLITE' | 'LOCAL_SQLITE' {
  return isTursoConfigured() ? 'TURSO_CLOUD_SQLITE' : 'LOCAL_SQLITE'
}

let prisma: PrismaClient

declare global {
  var __prisma: PrismaClient | undefined
}

function initPrismaClient(): PrismaClient {
  if (tursoUrl) {
    const masked = tursoUrl.replace(/\/\/[^@]*@/, '//***@')
    console.log(`[Database] Connecting to Turso Cloud SQLite (${masked})...`)
    const adapter = new PrismaLibSql({
      url: tursoUrl,
      authToken: tursoAuthToken,
    })
    return new PrismaClient({ adapter })
  }

  // Local SQLite fallback (Local Development / Persistent Node Server on Render)
  const rawUrl = process.env.DATABASE_URL || 'file:./tabian.db'
  let dbUrl = rawUrl

  if (rawUrl.startsWith('file:')) {
    const rawPath = rawUrl.replace(/^file:/, '')

    if (path.isAbsolute(rawPath)) {
      dbUrl = `file:${rawPath.replace(/\\/g, '/')}`
    } else {
      const cleanRelative = rawPath.replace(/^(\.\/|\.\\)/, '')
      const baseName = path.basename(cleanRelative)

      const inPrisma = path.resolve(process.cwd(), 'prisma', baseName)
      const inCwd = path.resolve(process.cwd(), cleanRelative)
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

  console.log(`[Database] Connecting to Local SQLite (${dbUrl})...`)
  return new PrismaClient({
    datasources: {
      db: {
        url: dbUrl,
      },
    },
  })
}

if (process.env.NODE_ENV === 'production') {
  prisma = initPrismaClient()
} else {
  if (!global.__prisma) {
    global.__prisma = initPrismaClient()
  }
  prisma = global.__prisma
}

let schemaInitialized = false

/**
 * Ensures required SQLite tables and indices exist.
 * Works seamlessly on both Local SQLite and Turso Cloud SQLite.
 * If tables do not exist, creates them via direct DDL.
 */
export async function ensureDatabaseSchema() {
  if (schemaInitialized) return

  try {
    await prisma.$queryRawUnsafe('SELECT 1 FROM "Plate" LIMIT 1')
    schemaInitialized = true
  } catch {
    console.log(`[Database] Plate table missing in ${getDatabaseType()}. Initializing tables...`)
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
      console.log(`[Database] ${getDatabaseType()} tables initialized successfully!`)
    } catch (createErr) {
      console.error('[Database] Failed to initialize tables:', createErr)
    }
  }
}

export { prisma }
