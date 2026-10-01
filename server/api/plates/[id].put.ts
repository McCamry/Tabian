import { prisma, ensureDatabaseSchema } from '~/server/utils/prisma'
import { normalizePlate } from '~/server/utils/plate'
import { extractClientAudit } from '~/server/utils/clientInfo'
import bcrypt from 'bcryptjs'

export default defineEventHandler(async (event) => {
  await ensureDatabaseSchema()

  const id = event.context.params?.id
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ไม่พบ ID ป้ายทะเบียน' })
  }

  const plate = await prisma.plate.findUnique({
    where: { id },
  })

  if (!plate) {
    throw createError({ statusCode: 404, statusMessage: 'ไม่พบข้อมูลป้ายทะเบียนในระบบ' })
  }

  const body = await readBody(event) || {}

  // 1. ตรวจสอบสิทธิ์ (Master Admin Key หรือ PIN ของป้าย)
  const adminKeyHeader = (getHeader(event, 'x-admin-key') || '').trim()
  const expectedAdminKey = (process.env.ADMIN_SECRET_KEY || 'admin1234').trim()
  const isAdmin = Boolean(adminKeyHeader && adminKeyHeader === expectedAdminKey)

  if (!isAdmin) {
    const pin = String(body.pin || '')
    if (!pin) {
      throw createError({
        statusCode: 401,
        statusMessage: 'กรุณาระบุรหัส PIN 4 หลัก หรือรหัส Admin เพื่อแก้ไขข้อมูล',
      })
    }

    const isPinValid = bcrypt.compareSync(pin, plate.pinHash)
    if (!isPinValid) {
      throw createError({
        statusCode: 403,
        statusMessage: 'รหัส PIN ไม่ถูกต้อง',
      })
    }
  }

  // 2. ดึงค่าที่จะอัปเดต
  const reportType = body.reportType || plate.reportType
  const vehicleType = body.vehicleType || plate.vehicleType
  const platePrefix = (body.platePrefix !== undefined ? body.platePrefix : plate.platePrefix).trim()
  const plateNumber = (body.plateNumber !== undefined ? body.plateNumber : plate.plateNumber).trim()
  const province = (body.province !== undefined ? body.province : plate.province).trim()
  const contactName = (body.contactName !== undefined ? body.contactName : plate.contactName).trim()
  const contactPhone = (body.contactPhone !== undefined ? body.contactPhone : plate.contactPhone).trim()
  const pickupLocation = (body.pickupLocation !== undefined ? body.pickupLocation : plate.pickupLocation).trim()
  const status = body.status || plate.status
  const sourceUrl = body.sourceUrl !== undefined ? body.sourceUrl : plate.sourceUrl

  const normalizedPlate = normalizePlate(platePrefix, plateNumber, province)

  try {
    const updatedPlate = await prisma.plate.update({
      where: { id },
      data: {
        reportType,
        vehicleType,
        platePrefix,
        plateNumber,
        province,
        normalizedPlate,
        contactName,
        contactPhone,
        pickupLocation,
        status,
        sourceUrl: sourceUrl || null,
      },
    })

    const clientAudit = extractClientAudit(event, body.clientInfo)

    // บันทึก Audit Log ละเอียด
    await prisma.auditLog.create({
      data: {
        plateId: id,
        action: isAdmin ? 'ADMIN_UPDATED' : (status === 'RETURNED' && plate.status !== 'RETURNED' ? 'STATUS_RETURNED' : 'PIN_UPDATED'),
        ipAddress: clientAudit.ipAddress,
        userAgent: clientAudit.userAgent,
        deviceType: clientAudit.deviceType,
        browser: clientAudit.browser,
        os: clientAudit.os,
        city: clientAudit.city,
        country: clientAudit.country,
        latitude: clientAudit.latitude,
        longitude: clientAudit.longitude,
        metadata: clientAudit.metadata,
      },
    }).catch((logErr) => console.error('Error creating audit log:', logErr))

    return {
      success: true,
      message: 'อัปเดตข้อมูลป้ายทะเบียนสำเร็จ',
      data: updatedPlate,
    }
  } catch (err: any) {
    console.error('Error updating plate:', err)
    throw createError({
      statusCode: 500,
      statusMessage: `แก้ไขไม่สำเร็จ: ${err.message || 'ข้อผิดพลาดฐานข้อมูล'}`,
    })
  }
})
