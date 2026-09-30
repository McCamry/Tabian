import { prisma, ensureDatabaseSchema } from '~/server/utils/prisma'

export default defineEventHandler(async () => {
  await ensureDatabaseSchema()
  const [foundCount, lostCount, returnedCount, totalCount] = await Promise.all([
    prisma.plate.count({ where: { reportType: 'FOUND', status: 'ACTIVE' } }),
    prisma.plate.count({ where: { reportType: 'LOST', status: 'ACTIVE' } }),
    prisma.plate.count({ where: { status: 'RETURNED' } }),
    prisma.plate.count(),
  ])

  return {
    success: true,
    data: {
      foundCount,
      lostCount,
      returnedCount,
      totalCount,
    }
  }
})
