import { prisma, ensureDatabaseSchema } from '~/server/utils/prisma'
import { maskPhoneNumber, normalizePlateQuery, levenshteinDistance } from '~/server/utils/plate'

export default defineEventHandler(async (event) => {
  await ensureDatabaseSchema()
  const query = getQuery(event)
  const q = (query.q as string || '').trim()
  const fuzzy = query.fuzzy === 'true' || query.fuzzy === '1'
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

  // Search keyword (q) with Thai numeral normalization
  const normalizedQ = normalizePlateQuery(q)
  const isDigitsOnly = /^\d+$/.test(normalizedQ)

  if (q) {
    whereClause.OR = [
      { normalizedPlate: { contains: normalizedQ } },
      { plateNumber: { contains: normalizedQ } },
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

  let finalPlates: any[] = plates.map((p) => ({ ...p, isFuzzyMatch: false }))

  // Fuzzy match (Levenshtein distance = 1) if requested and query length >= 3
  if (fuzzy && normalizedQ.length >= 3) {
    const existingIds = new Set(plates.map((p) => p.id))
    const candidateWhere = { ...whereClause }
    delete candidateWhere.OR

    const candidates = await prisma.plate.findMany({
      where: candidateWhere,
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    const digitsOnly = normalizedQ.replace(/\D/g, '')
    for (const c of candidates) {
      if (existingIds.has(c.id)) continue

      let isNear = false
      if (isDigitsOnly && c.plateNumber) {
        if (levenshteinDistance(c.plateNumber, normalizedQ) === 1) {
          isNear = true
        }
      } else {
        if (levenshteinDistance(c.normalizedPlate, normalizedQ) === 1) {
          isNear = true
        } else if (digitsOnly.length >= 3 && c.plateNumber && levenshteinDistance(c.plateNumber, digitsOnly) === 1) {
          isNear = true
        }
      }

      if (isNear) {
        existingIds.add(c.id)
        finalPlates.push({ ...c, isFuzzyMatch: true })
      }
    }
  }

  // Check matching opposite plates for each item (FOUND <-> LOST)
  const results = await Promise.all(
    finalPlates.map(async (p) => {
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
        isFuzzyMatch: !!p.isFuzzyMatch,
      }
    })
  )

  return {
    success: true,
    total: results.length,
    data: results,
  }
})
