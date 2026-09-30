import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

function normalizePlate(prefix: string, number: string, province: string): string {
  return `${prefix.replace(/\s+/g, '')}${number.replace(/\s+/g, '')}${province.replace(/\s+/g, '')}`.toLowerCase()
}

async function main() {
  console.log('🌱 เริ่มต้นการ Seed ข้อมูลป้ายทะเบียนน้ำท่วมจำลอง...')

  // ล้างข้อมูลเก่าก่อน
  await prisma.auditLog.deleteMany({})
  await prisma.plate.deleteMany({})
  await prisma.batchImport.deleteMany({})

  const pinHash = bcrypt.hashSync('1234', 10)

  const samplePlates = [
    // 1. เคสคู่จับคู่ได้: FOUND & LOST (กข 1234 เชียงใหม่)
    {
      reportType: 'FOUND',
      vehicleType: 'CAR',
      platePrefix: 'กข',
      plateNumber: '1234',
      province: 'เชียงใหม่',
      normalizedPlate: normalizePlate('กข', '1234', 'เชียงใหม่'),
      imageUrl: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=600&auto=format&fit=crop&q=80',
      contactName: 'จุดประสานงานกู้ภัยแม่สาย (คุณวิชัย)',
      contactPhone: '0812345678',
      pickupLocation: 'เต็นท์กู้ภัย หน้าที่ว่าการอำเภอแม่สาย เชียงราย',
      status: 'ACTIVE',
      source: 'DIRECT',
      pinHash,
    },
    {
      reportType: 'LOST',
      vehicleType: 'CAR',
      platePrefix: 'กข',
      plateNumber: '1234',
      province: 'เชียงใหม่',
      normalizedPlate: normalizePlate('กข', '1234', 'เชียงใหม่'),
      imageUrl: null,
      contactName: 'คุณสมศักดิ์ (เจ้าของรถ Honda City สีขาว)',
      contactPhone: '0899887766',
      pickupLocation: 'ทำหล่นช่วงขับลุยน้ำข้ามสะพานสายลมจอย แม่สาย',
      status: 'ACTIVE',
      source: 'DIRECT',
      pinHash,
    },

    // 2. พบป้ายรถยนต์ เชียงใหม่ (สะพานนวรัฐ)
    {
      reportType: 'FOUND',
      vehicleType: 'CAR',
      platePrefix: '3กก',
      plateNumber: '9081',
      province: 'เชียงใหม่',
      normalizedPlate: normalizePlate('3กก', '9081', 'เชียงใหม่'),
      imageUrl: 'https://images.unsplash.com/photo-1502877338535-766e1452684a?w=600&auto=format&fit=crop&q=80',
      contactName: 'ป้อมยามตำรวจจราจร สะพานนวรัฐ',
      contactPhone: '053112233',
      pickupLocation: 'ป้อมตำรวจเชิงสะพานนวรัฐ ถ.เจริญเมือง จ.เชียงใหม่',
      status: 'ACTIVE',
      source: 'AI_OCR_BATCH',
      pinHash,
    },

    // 3. พบป้ายมอเตอร์ไซค์ ลำพูน
    {
      reportType: 'FOUND',
      vehicleType: 'MOTORCYCLE',
      platePrefix: '1กง',
      plateNumber: '333',
      province: 'ลำพูน',
      normalizedPlate: normalizePlate('1กง', '333', 'ลำพูน'),
      imageUrl: null,
      contactName: 'ร้านปะยางช่างเอก ป่าแดด',
      contactPhone: '0865554321',
      pickupLocation: 'หน้าร้านช่างเอก ปากซอยป่าแดด 12 อ.เมือง เชียงใหม่',
      status: 'ACTIVE',
      source: 'SOCIAL_IMPORT',
      pinHash,
    },

    // 4. แจ้งหา: มอเตอร์ไซค์ เชียงราย
    {
      reportType: 'LOST',
      vehicleType: 'MOTORCYCLE',
      platePrefix: '1กข',
      plateNumber: '777',
      province: 'เชียงราย',
      normalizedPlate: normalizePlate('1กข', '777', 'เชียงราย'),
      imageUrl: null,
      contactName: 'น้องแนน (Wave 110i สีแดง)',
      contactPhone: '0951239876',
      pickupLocation: 'หลุดหายตอนน้ำทะลักเข้าห้าแยกพ่อขุนเม็งราย',
      status: 'ACTIVE',
      source: 'DIRECT',
      pinHash,
    },

    // 5. ส่งมอบแล้ว (RETURNED) เคสตัวอย่างปิดเคส
    {
      reportType: 'FOUND',
      vehicleType: 'CAR',
      platePrefix: 'ขข',
      plateNumber: '8888',
      province: 'พระนครศรีอยุธยา',
      normalizedPlate: normalizePlate('ขข', '8888', 'พระนครศรีอยุธยา'),
      imageUrl: null,
      contactName: 'สภ.บางปะอิน',
      contactPhone: '035221144',
      pickupLocation: 'ห้องร้อยเวร สภ.บางปะอิน',
      status: 'RETURNED',
      source: 'DIRECT',
      pinHash,
    },

    // 6. พบป้ายรถยนต์ กทม. (แถวบางพลัด)
    {
      reportType: 'FOUND',
      vehicleType: 'CAR',
      platePrefix: '5ขข',
      plateNumber: '4567',
      province: 'กรุงเทพมหานคร',
      normalizedPlate: normalizePlate('5ขข', '4567', 'กรุงเทพมหานคร'),
      imageUrl: null,
      contactName: 'อาสาสมัครป่อเต็กตึ๊ง จุดบางพลัด',
      contactPhone: '0823456789',
      pickupLocation: 'ใต้สะพานกรุงธน (ซังฮี้) ฝั่งธนบุรี',
      status: 'ACTIVE',
      source: 'DIRECT',
      pinHash,
    }
  ]

  for (const item of samplePlates) {
    const created = await prisma.plate.create({
      data: item,
    })
    console.log(`✅ เพิ่มป้าย: [${created.reportType}] ${created.platePrefix} ${created.plateNumber} ${created.province} (${created.status})`)
  }

  console.log('🎉 Seed ข้อมูลจำลองเรียบร้อยแล้วทั้งหมด 6 รายการ!')
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
