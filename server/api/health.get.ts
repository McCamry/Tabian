import { prisma, ensureDatabaseSchema, getDatabaseType } from '~/server/utils/prisma'

export default defineEventHandler(async () => {
  await ensureDatabaseSchema()

  let dbStatus = 'UNKNOWN'
  let plateCount = 0
  let errorMessage: string | null = null

  try {
    plateCount = await prisma.plate.count()
    dbStatus = 'CONNECTED'
  } catch (err: any) {
    dbStatus = 'ERROR'
    errorMessage = err?.message || String(err)
  }

  return {
    status: 'OK',
    timestamp: new Date().toISOString(),
    database: {
      type: getDatabaseType(),
      status: dbStatus,
      plateCount,
      error: errorMessage,
      url: (process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL) ? '[CONFIGURED]' : '[DEFAULT]',
    },
    service: 'Tabian API',
  }
})
