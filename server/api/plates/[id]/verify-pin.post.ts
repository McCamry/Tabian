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
    select: { id: true, pinHash: true, platePrefix: true, plateNumber: true, province: true },
  })

  if (!plate) {
    throw createError({ statusCode: 404, statusMessage: 'ไม่พบข้อมูลป้ายทะเบียนในระบบ' })
  }

  const body = await readBody(event) || {}
  const pin = String(body.pin || '').trim()

  if (!pin) {
    throw createError({ statusCode: 400, statusMessage: 'กรุณากรอกรหัส PIN 4 หลัก' })
  }

  const isValid = bcrypt.compareSync(pin, plate.pinHash)
  if (!isValid) {
    throw createError({ statusCode: 403, statusMessage: 'รหัส PIN 4 หลักไม่ถูกต้อง' })
  }

  return {
    valid: true,
    message: 'ยืนยันรหัส PIN ถูกต้อง',
  }
})
