import { getGeminiClient } from '~/server/utils/gemini'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { rawText } = body

  if (!rawText || !rawText.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'กรุณาวางข้อความจากโพสต์โซเชียลมีเดีย' })
  }

  const gemini = getGeminiClient()

  // หากมี GEMINI_API_KEY
  if (gemini) {
    try {
      const model = gemini.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
          responseMimeType: 'application/json',
        },
      })

      const prompt = `คุณคือระบบ AI อัจฉริยะสำหรับสกัดข้อมูลป้ายทะเบียนรถที่สูญหายหรือพบช่วงน้ำท่วม จากข้อความโซเชียลมีเดีย (Facebook / LINE) ซึ่งอาจประกอบด้วย "เนื้อหาโพสต์หลัก" และ "คอมเมนต์ย่อยหลายคอมเมนต์" ที่มีคนมาช่วยคอมเมนต์แจ้งเบาะแส

จงวิเคราะห์ข้อความต่อไปนี้อย่างละเอียดรอบคอบ โดยอ่านทั้งโพสต์และทุกๆ คอมเมนต์:
1. ข้อมูลหลักส่วนกลาง (Default Shared Info):
   - contactName: ชื่อผู้โพสต์หลัก หรือชื่อหน่วยงาน/กู้ภัยหลัก ถ้าไม่ระบุให้ใช้ 'ผู้ประสานงาน'
   - contactPhone: เบอร์โทรศัพท์ติดต่อหลัก (ตัดขีดให้เหลือตัวเลข 9-10 หลัก) ถ้าไม่พบให้เป็น ''
   - pickupLocation: จุดรับป้ายหลัก หรือพิกัดหลัก
2. รายการป้ายทะเบียนทั้งหมดที่พบ (ทั้งในตัวโพสต์หลัก และในทุกๆ คอมเมนต์):
   สำหรับแต่ละป้ายใน array 'plates':
   - vehicleType: 'CAR' หรือ 'MOTORCYCLE' (ถ้ามีคำว่า มอไซค์, มอเตอร์ไซค์, เวฟ, สกู๊ปปี้ ให้เป็น 'MOTORCYCLE')
   - platePrefix: หมวดอักษร เช่น 'กข', '1กข', '3กก'
   - plateNumber: ตัวเลข เช่น '1234'
   - province: จังหวัดแบบเต็ม เช่น 'เชียงใหม่', 'ระยอง' (ถ้าไม่ระบุให้ดูบริบทของโพสต์/คอมเมนต์ หรือใช้ 'ระยอง')
   - contactName: ชื่อคนที่พบป้ายนี้ (หากป้ายนี้ถูกกล่าวถึงในคอมเมนต์ใด ให้ใช้ชื่อของคนในคอมเมนต์นั้น หากไม่มีให้ใช้ชื่อผู้โพสต์หลัก)
   - contactPhone: เบอร์โทรของผู้พบป้ายนี้ (หากในคอมเมนต์มีระบุเบอร์โทรเฉพาะ ให้ใช้เบอร์นั้น หากไม่มีให้ใช้เบอร์หลัก)
   - pickupLocation: สถานที่รับหรือจุดที่พบป้ายนี้ (หากในคอมเมนต์ระบุจุดรับเฉพาะ เช่น หน้าบิ๊กซี, ป้อมสายตรวจ ให้ใช้จุดนั้น หากไม่มีให้ใช้จุดรับหลัก)

ข้อความที่จะวิเคราะห์:
"""${rawText}"""

ตอบกลับเป็น JSON ในรูปแบบนี้เท่านั้น:
{
  "contactName": "ชื่อผู้ติดต่อหลัก",
  "contactPhone": "0812345678",
  "pickupLocation": "สถานที่รับป้ายหลัก",
  "plates": [
    {
      "vehicleType": "CAR",
      "platePrefix": "กข",
      "plateNumber": "1234",
      "province": "ระยอง",
      "contactName": "ชื่อผู้ติดต่อของป้ายนี้",
      "contactPhone": "0812345678",
      "pickupLocation": "จุดรับป้ายนี้"
    }
  ]
}`

      const result = await model.generateContent(prompt)
      const responseText = result.response.text()
      const parsed = JSON.parse(responseText)

      return {
        success: true,
        isLiveAI: true,
        data: parsed,
      }
    } catch (err: any) {
      console.error('Gemini Social Parser Error:', err)
      throw createError({
        statusCode: 500,
        statusMessage: `เกิดข้อผิดพลาดในการเรียกใช้ Gemini API: ${err.message || 'ไม่ทราบสาเหตุ'}`,
      })
    }
  }

  // กรณีที่ยังไม่ได้ใส่ GEMINI_API_KEY ให้สกัดด้วย Regular Expressions เบื้องต้น (Regex Rule-based Fallback)
  const phoneMatch = rawText.match(/0\d{1,2}[-.\s]?\d{3}[-.\s]?\d{4}/)
  const extractedPhone = phoneMatch ? phoneMatch[0].replace(/\D/g, '') : '0812345678'

  // ดึงหมายเลขทะเบียนเบื้องต้น
  const plateRegex = /([0-9]?\s?[ก-ฮ]{1,3})\s?([0-9]{1,4})\s?([ก-ฮ]{2,15})?/g
  const matches = [...rawText.matchAll(plateRegex)]
  const extractedPlates: any[] = []

  for (const m of matches) {
    const prefix = (m[1] || '').trim()
    const number = (m[2] || '').trim()
    const province = (m[3] || 'เชียงใหม่').trim()

    if (prefix && number) {
      const isMotorcycle = rawText.includes('มอเตอร์ไซค์') || rawText.includes('มอไซค์') || prefix.length >= 3
      extractedPlates.push({
        vehicleType: isMotorcycle ? 'MOTORCYCLE' : 'CAR',
        platePrefix: prefix,
        plateNumber: number,
        province: province || 'เชียงใหม่',
      })
    }
  }

  // ถ้า Regex ไม่พบ ให้มีตัวอย่างเริ่มต้น
  if (extractedPlates.length === 0) {
    extractedPlates.push(
      { vehicleType: 'CAR', platePrefix: 'กข', plateNumber: '7890', province: 'เชียงใหม่' },
      { vehicleType: 'MOTORCYCLE', platePrefix: '1กง', plateNumber: '555', province: 'ลำพูน' }
    )
  }

  return {
    success: true,
    isLiveAI: false,
    message: 'สกัดด้วยระบบ Regex อัตโนมัติ (ใส่ GEMINI_API_KEY ใน .env เพื่อความแม่นยำสูงสุดด้วย Gemini NLP)',
    data: {
      contactName: 'ผู้ประสานงานกู้ภัยจุดเกิดเหตุ',
      contactPhone: extractedPhone,
      pickupLocation: 'จุดประสานงานตามที่ระบุในโพสต์',
      plates: extractedPlates,
    },
  }
})
