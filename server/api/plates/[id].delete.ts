import { prisma, ensureDatabaseSchema } from '~/server/utils/prisma'
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

  // 1. ตรวจสอบสิทธิ์ (Master Admin Key หรือ PIN ของป้าย)
  const adminKeyHeader = (getHeader(event, 'x-admin-key') || '').trim()
  const expectedAdminKey = (process.env.ADMIN_SECRET_KEY || 'admin1234').trim()
  const isAdmin = Boolean(adminKeyHeader && adminKeyHeader === expectedAdminKey)

  if (!isAdmin) {
    const query = getQuery(event)
    let pin = String(query.pin || '')

    if (!pin) {
      try {
        const body = await readBody(event)
        pin = String(body?.pin || '')
      } catch {
        // ignore body parsing error on DELETE
      }
    }

    if (!pin) {
      throw createError({
        statusCode: 401,
        statusMessage: 'กรุณาระบุรหัส PIN 4 หลัก หรือรหัส Admin เพื่อลบข้อมูล',
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

  try {
    // ลบรายการป้ายทะเบียน (AuditLog มี Cascade Delete)
    await prisma.plate.delete({
      where: { id },
    })

    return {
      success: true,
      message: `ลบรายการป้ายทะเบียน ${plate.platePrefix} ${plate.plateNumber} ${plate.province} เรียบร้อยแล้ว`,
      deletedId: id,
    }
  } catch (err: any) {
    console.error('Error deleting plate:', err)
    throw createError({
      statusCode: 500,
      statusMessage: `ลบไม่สำเร็จ: ${err.message || 'ข้อผิดพลาดฐานข้อมูล'}`,
    })
  }
})
