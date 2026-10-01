import { prisma, ensureDatabaseSchema } from '~/server/utils/prisma'
import { normalizePlateQuery } from '~/server/utils/plate'

function csvCell(val: any): string {
  if (val === null || val === undefined) return '""'
  const str = String(val)
  return `"${str.replace(/"/g, '""')}"`
}

export default defineEventHandler(async (event) => {
  await ensureDatabaseSchema()
  const query = getQuery(event)
  const q = (query.q as string || '').trim()
  const type = query.type as string
  const vehicle = query.vehicle as string
  const province = query.province as string
  const status = (query.status as string) || 'ACTIVE'

  const whereClause: any = {}

  if (status && status !== 'ALL') {
    whereClause.status = status
  }
  if (type && type !== 'ALL') {
    whereClause.reportType = type
  }
  if (vehicle && vehicle !== 'ALL') {
    whereClause.vehicleType = vehicle
  }
  if (province && province !== 'ALL') {
    whereClause.province = { contains: province }
  }

  if (q) {
    const normalizedQ = normalizePlateQuery(q)
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
  })

  // CSV Headers
  const headers = [
    'วันที่บันทึก (พ.ศ.)',
    'ประเภทรายการ',
    'สถานะ',
    'ประเภทรถ',
    'หมวดอักษร',
    'หมายเลขทะเบียน',
    'จังหวัด',
    'สถานที่รับ / จุดที่หลุดหาย',
    'ลิงก์แผนที่ Google Maps',
    'ชื่อผู้ติดต่อ',
    'เบอร์โทรศัพท์ติดต่อ',
    'แหล่งที่มา',
    'ลิงก์โพสต์ต้นทาง (URL)',
  ]

  const rows = plates.map((p) => {
    const dateStr = p.createdAt ? new Date(p.createdAt).toLocaleString('th-TH') : ''
    const reportTypeStr = p.reportType === 'LOST' ? 'แจ้งตามหา (หลุดหาย)' : 'พบป้ายทะเบียน (เจอ)'
    const statusStr = p.status === 'RETURNED' ? 'ส่งมอบแล้ว (ปิดเคส)' : 'รอติดต่อรับ'
    const vehicleTypeStr = p.vehicleType === 'MOTORCYCLE' ? 'รถจักรยานยนต์' : 'รถยนต์'
    const sourceStr = p.source === 'IMAGE_OCR' ? 'AI สแกนกองป้าย' : p.source === 'SOCIAL_POST_TEXT' ? 'โพสต์โซเชียลมีเดีย' : 'กรอกข้อมูลเดี่ยว'

    const mapsUrl = (p.latitude && p.longitude)
      ? `https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((p.pickupLocation || '') + ' ' + (p.province || ''))}`

    return [
      csvCell(dateStr),
      csvCell(reportTypeStr),
      csvCell(statusStr),
      csvCell(vehicleTypeStr),
      csvCell(p.platePrefix),
      csvCell(p.plateNumber),
      csvCell(p.province),
      csvCell(p.pickupLocation),
      csvCell(mapsUrl),
      csvCell(p.contactName),
      csvCell(p.contactPhone),
      csvCell(sourceStr),
      csvCell(p.sourceUrl || ''),
    ].join(',')
  })

  // Prepend UTF-8 BOM so Microsoft Excel opens Thai text correctly
  const csvContent = '\uFEFF' + headers.map(csvCell).join(',') + '\r\n' + rows.join('\r\n')

  const dateTag = new Date().toISOString().slice(0, 10)
  setResponseHeaders(event, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="tabian_export_${dateTag}.csv"`,
  })

  return csvContent
})
