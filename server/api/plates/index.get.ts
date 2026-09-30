import { prisma, ensureDatabaseSchema } from '~/server/utils/prisma'
import { maskPhoneNumber } from '~/server/utils/plate'

export default defineEventHandler(async (event) => {
  await ensureDatabaseSchema()
  const query = getQuery(event)
  const q = (query.q as string || '').trim()
  const type = query.type as string
  const vehicle = query.vehicle as string
  const province = query.province as string
  const status = (query.status as string) || 'ACTIVE'

  const whereClause: any = {}

  // Filter status
  if (status && status !== 'ALL') {
    whereClause.status = status
  }

  // Filter report type (FOUND / LOST)
  if (type && type !== 'ALL') {
    whereClause.reportType = type
  }

  // Filter vehicle type (CAR / MOTORCYCLE)
  if (vehicle && vehicle !== 'ALL') {
    whereClause.vehicleType = vehicle
  }

  // Filter province
  if (province && province !== 'ALL') {
    whereClause.province = { contains: province }
  }

  // Search keyword (q)
  if (q) {
    const cleanQ = q.replace(/\s+/g, '').toLowerCase()
    whereClause.OR = [
      { normalizedPlate: { contains: cleanQ } },
      { plateNumber: { contains: q } },
      { platePrefix: { contains: q } },
      { province: { contains: q } },
      { pickupLocation: { contains: q } },
    ]
  }

  const plates = await prisma.plate.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  // Check matching opposite plates for each item (FOUND <-> LOST)
  const results = await Promise.all(
    plates.map(async (p) => {
      const oppositeType = p.reportType === 'FOUND' ? 'LOST' : 'FOUND'
      const match = await prisma.plate.findFirst({
        where: {
          reportType: oppositeType,
          plateNumber: p.plateNumber,
          platePrefix: p.platePrefix,
          province: p.province,
          status: 'ACTIVE',
        },
        select: {
          id: true,
          reportType: true,
          contactName: true,
          pickupLocation: true,
        },
      })

      return {
        id: p.id,
        reportType: p.reportType,
        vehicleType: p.vehicleType,
        platePrefix: p.platePrefix,
        plateNumber: p.plateNumber,
        province: p.province,
        imageUrl: p.imageUrl,
        sourceUrl: p.sourceUrl,
        sourceImageUrl: p.sourceImageUrl,
        contactName: p.contactName,
        contactPhone: p.contactPhone,
        contactPhoneMasked: maskPhoneNumber(p.contactPhone),
        pickupLocation: p.pickupLocation,
        status: p.status,
        source: p.source,
        createdAt: p.createdAt,
        matchedOpposite: match,
      }
    })
  )

  return {
    success: true,
    total: results.length,
    data: results,
  }
})
