import { ensureDatabaseSchema } from '~/server/utils/prisma'

export default defineNitroPlugin(async () => {
  try {
    await ensureDatabaseSchema()
  } catch (err) {
    console.error('[Database Plugin] Error ensuring database schema:', err)
  }
})
