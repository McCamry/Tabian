export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const password = (body?.password || '').trim()

  const expectedKey = (process.env.ADMIN_SECRET_KEY || 'admin1234').trim()

  if (!password || password !== expectedKey) {
    throw createError({
      statusCode: 401,
      statusMessage: 'รหัสผ่านผู้ดูแลระบบไม่ถูกต้อง',
    })
  }

  return {
    success: true,
    message: 'ยืนยันตัวตนผู้ดูแลระบบสำเร็จ',
  }
})
