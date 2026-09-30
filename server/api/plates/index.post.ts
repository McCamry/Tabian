import { prisma } from '~/server/utils/prisma'
import { normalizePlate, maskPhoneNumber } from '~/server/utils/plate'
import bcrypt from 'bcryptjs'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const {
    reportType,
    vehicleType = 'CAR',
    platePrefix,
    plateNumber,
    province,
    imageUrl,
    sourceUrl,
    sourceImageUrl,
    contactName,
    contactPhone,
    pickupLocation,
    pin,
  } = body

  // Validation
  if (!reportType || !['FOUND', 'LOST'].includes(reportType)) {
    throw createError({ statusCode: 400, statusMessage: 'กรุณาระบุประเภทรายการ (เจอ หรือ หา)' })
  }
  if (!platePrefix || !plateNumber || !province) {
    throw createError({ statusCode: 400, statusMessage: 'กรุณากรอกหมวดอักษร หมายเลขทะเบียน และจังหวัดให้ครบถ้วน' })
  }
  if (!contactName || !contactPhone || !pickupLocation) {
    throw createError({ statusCode: 400, statusMessage: 'กรุณาระบุชื่อผู้ติดต่อ เบอร์โทรศัพท์ และสถานที่' })
  }
  if (!pin || String(pin).length !== 4) {
    throw createError({ statusCode: 400, statusMessage: 'กรุณากำหนดรหัส PIN 4 หลักสำหรับจัดการข้อมูลในอนาคต' })
  }

  // Format source URL if provided
  let formattedSourceUrl: string | null = null
  if (sourceUrl && typeof sourceUrl === 'string' && sourceUrl.trim()) {
    const trimmed = sourceUrl.trim()
    formattedSourceUrl = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  }

  const pinHash = bcrypt.hashSync(String(pin), 10)
  const normalized = normalizePlate(platePrefix, plateNumber, province)

  // บันทึกลงฐานข้อมูล
  const createdPlate = await prisma.plate.create({
    data: {
      reportType,
      vehicleType,
      platePrefix: platePrefix.trim(),
      plateNumber: plateNumber.trim(),
      province: province.trim(),
      normalizedPlate: normalized,
      imageUrl: imageUrl || null,
      sourceUrl: formattedSourceUrl,
      sourceImageUrl: sourceImageUrl || null,
      contactName: contactName.trim(),
      contactPhone: contactPhone.trim(),
      pickupLocation: pickupLocation.trim(),
      status: 'ACTIVE',
      source: 'DIRECT',
      pinHash,
    },
  })

  // ตรวจสอบการจับคู่กับฝั่งตรงข้ามทันที (Smart Matching)
  const oppositeType = reportType === 'FOUND' ? 'LOST' : 'FOUND'
  const matchedPlates = await prisma.plate.findMany({
    where: {
      reportType: oppositeType,
      plateNumber: createdPlate.plateNumber,
      platePrefix: createdPlate.platePrefix,
      province: createdPlate.province,
      status: 'ACTIVE',
    },
    select: {
      id: true,
      reportType: true,
      contactName: true,
      contactPhone: true,
      pickupLocation: true,
    },
  })

  // สร้าง Audit Log
  await prisma.auditLog.create({
    data: {
      plateId: createdPlate.id,
      action: 'CREATED',
    },
  })

  return {
    success: true,
    message: reportType === 'FOUND' ? 'บันทึกข้อมูลพบป้ายทะเบียนเรียบร้อยแล้ว' : 'บันทึกข้อมูลตามหาป้ายทะเบียนเรียบร้อยแล้ว',
    data: {
      ...createdPlate,
      contactPhoneMasked: maskPhoneNumber(createdPlate.contactPhone),
    },
    matched: matchedPlates.length > 0,
    matchedCount: matchedPlates.length,
    matchedPlates: matchedPlates.map(m => ({
      ...m,
      contactPhoneMasked: maskPhoneNumber(m.contactPhone),
    })),
  }
})
