import { getGeminiClient } from '~/server/utils/gemini'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { image, mimeType = 'image/jpeg' } = body

  if (!image) {
    throw createError({ statusCode: 400, statusMessage: 'กรุณาอัปโหลดภาพถ่ายป้ายทะเบียน' })
  }

  // ลบ data:image/...;base64, header ถ้ามี
  const base64Data = image.replace(/^data:image\/\w+;base64,/, '')

  const gemini = getGeminiClient()

  // หากมี GEMINI_API_KEY ให้เรียกโมเดลจริง
  if (gemini) {
    try {
      const model = gemini.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
          responseMimeType: 'application/json',
        },
      })

      const prompt = `คุณคือระบบ AI ผู้เชี่ยวชาญด้านการตรวจจับและอ่านแผ่นป้ายทะเบียนรถในประเทศไทย (ทั้งรถยนต์และรถจักรยานยนต์) ที่หลุดหายช่วงน้ำท่วม
ในภาพอาจมีแผ่นป้ายทะเบียน 1 แผ่น หรือหลายแผ่นวางเรียงกัน จงวิเคราะห์และสกัดข้อมูลป้ายทะเบียนทุกแผ่นที่มองเห็นออกมาในรูปแบบ JSON:
- vehicleType: 'CAR' (รถยนต์ ทรงสี่เหลี่ยมผืนผ้า) หรือ 'MOTORCYCLE' (มอเตอร์ไซค์ ทรงสี่เหลี่ยมจัตุรัส 3 บรรทัด)
- platePrefix: หมวดอักษร เช่น 'กข', '1กข', '3กก'
- plateNumber: หมายเลข 1-4 หลัก เช่น '1234', '9081', '77'
- province: ชื่อจังหวัดภาษาไทยแบบเต็ม เช่น 'เชียงใหม่', 'กรุงเทพมหานคร', 'เชียงราย', 'ลำพูน'
- confidence: ค่าความมั่นใจ 0.0 - 1.0

ตอบกลับเป็น JSON ในรูปแบบนี้เท่านั้น:
{
  "detectedCount": 2,
  "plates": [
    {
      "vehicleType": "CAR",
      "platePrefix": "กข",
      "plateNumber": "1234",
      "province": "เชียงใหม่",
      "confidence": 0.95
    }
  ]
}`

      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: base64Data,
            mimeType,
          },
        },
      ])

      const responseText = result.response.text()
      const parsed = JSON.parse(responseText)

      return {
        success: true,
        isLiveAI: true,
        detectedCount: parsed.plates ? parsed.plates.length : 0,
        plates: parsed.plates || [],
      }
    } catch (err: any) {
      console.error('Gemini Vision API Error:', err)
      // กรณี API ขัดข้อง ให้ fallback คืน error หรือรายการจำลอง
      throw createError({
        statusCode: 500,
        statusMessage: `เกิดข้อผิดพลาดในการเรียกใช้ Gemini API: ${err.message || 'ไม่ทราบสาเหตุ'}`,
      })
    }
  }

  // กรณีที่ยังไม่ได้ใส่ GEMINI_API_KEY ใน .env ให้คืนข้อมูลตัวอย่างจำลองเพื่อให้ระบบยังคงทดสอบ UI ได้อย่างสมบูรณ์
  return {
    success: true,
    isLiveAI: false,
    message: 'จำลองผลลัพธ์ (กรุณาใส่ GEMINI_API_KEY ใน .env เพื่อใช้งานการสแกนด้วย Gemini Vision จริง)',
    detectedCount: 3,
    plates: [
      {
        vehicleType: 'CAR',
        platePrefix: 'กง',
        plateNumber: '4455',
        province: 'เชียงใหม่',
        confidence: 0.96,
      },
      {
        vehicleType: 'CAR',
        platePrefix: '2ขข',
        plateNumber: '8998',
        province: 'กรุงเทพมหานคร',
        confidence: 0.92,
      },
      {
        vehicleType: 'MOTORCYCLE',
        platePrefix: '1กข',
        plateNumber: '999',
        province: 'เชียงราย',
        confidence: 0.89,
      },
    ],
  }
})
