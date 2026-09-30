import { prisma, ensureDatabaseSchema } from '~/server/utils/prisma'
import { normalizePlate } from '~/server/utils/plate'
import bcrypt from 'bcryptjs'

export default defineEventHandler(async (event) => {
  await ensureDatabaseSchema()

  const body = await readBody(event)

  const {
    plates = [],
    sharedInfo,
    sourceType = 'IMAGE_OCR',
    sourceReference = '',
    rawContent = '',
  } = body

  if (!plates || !Array.isArray(plates) || plates.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'กรุณาระบุรายการป้ายทะเบียนอย่างน้อย 1 รายการ' })
  }

  if (!sharedInfo || !sharedInfo.contactName || !sharedInfo.contactPhone || !sharedInfo.pickupLocation) {
    throw createError({ statusCode: 400, statusMessage: 'กรุณากรอกข้อมูลผู้ติดต่อ เบอร์โทรศัพท์ และสถานที่รับป้าย' })
  }

  const pin = sharedInfo.pin || '1234'
  const pinHash = bcrypt.hashSync(String(pin), 10)
  const reportType = sharedInfo.reportType || 'FOUND'

  const rawUrl = sharedInfo.sourceUrl || sourceReference
  let formattedSourceUrl: string | null = null
  if (rawUrl && typeof rawUrl === 'string' && rawUrl.trim()) {
    const trimmed = rawUrl.trim()
    formattedSourceUrl = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  }

  try {
    // 1. สร้างตาราง BatchImport
    const batchImport = await prisma.batchImport.create({
      data: {
        sourceType,
        sourceReference: formattedSourceUrl || sourceReference || null,
        rawContent,
        totalExtracted: plates.length,
        totalApproved: plates.length,
        createdBy: sharedInfo.contactName,
      },
    })

    // 2. บันทึกรายการป้ายทั้งหมดลงฐานข้อมูล
    const createdPlates = await Promise.all(
      plates.map(async (p: any) => {
        const prefix = (p.platePrefix || '').trim()
        const num = (p.plateNumber || '').trim()
        const prov = (p.province || 'ระยอง').trim()
        const normalized = normalizePlate(prefix, num, prov)

        return prisma.plate.create({
          data: {
            reportType,
            vehicleType: p.vehicleType || 'CAR',
            platePrefix: prefix,
            plateNumber: num,
            province: prov,
            normalizedPlate: normalized,
            imageUrl: p.imageUrl || sharedInfo.imageUrl || null,
            sourceUrl: formattedSourceUrl,
            sourceImageUrl: sharedInfo.sourceImageUrl || null,
            contactName: (p.contactName && p.contactName.trim()) || sharedInfo.contactName.trim(),
            contactPhone: (p.contactPhone && p.contactPhone.trim()) || sharedInfo.contactPhone.trim(),
            pickupLocation: (p.pickupLocation && p.pickupLocation.trim()) || sharedInfo.pickupLocation.trim(),
            status: 'ACTIVE',
            source: sourceType === 'IMAGE_OCR' ? 'AI_OCR_BATCH' : 'SOCIAL_IMPORT',
            pinHash,
            batchImportId: batchImport.id,
          },
        })
      })
    )

    return {
      success: true,
      message: `บันทึกข้อมูลป้ายทะเบียนชุดใหญ่สำเร็จทั้งหมด ${createdPlates.length} รายการ`,
      batchImportId: batchImport.id,
      savedCount: createdPlates.length,
    }
  } catch (err: any) {
    console.error('Error saving batch plates:', err)
    throw createError({
      statusCode: 500,
      statusMessage: `บันทึกไม่สำเร็จ: ${err.message || 'ข้อผิดพลาดฐานข้อมูล'}`,
    })
  }
})
