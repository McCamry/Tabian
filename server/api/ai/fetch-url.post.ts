import { generateWithGeminiFallback, getGeminiApiKeys } from '~/server/utils/gemini'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { url } = body

  if (!url || typeof url !== 'string' || !url.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'กรุณาระบุ URL ที่ต้องการดึงข้อมูล' })
  }

  let formattedUrl = url.trim()
  if (!/^https?:\/\//i.test(formattedUrl)) {
    formattedUrl = `https://${formattedUrl}`
  }

  // 1. Fetch HTML with custom headers
  let html = ''
  let finalUrl = formattedUrl
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(formattedUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 facebookexternalhit/1.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'th-TH,th;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    })
    clearTimeout(timeoutId)

    if (response.status === 403 || response.status === 401 || response.status === 999) {
      return {
        success: false,
        blocked: true,
        message: 'แพลตฟอร์มนี้ (เช่น Facebook / Twitter) มีระบบป้องกันการเข้าถึงจากภายนอก (Login Wall) กรุณาคัดลอกข้อความในโพสต์มาวาง หรือแคปหน้าจอรูปมาสแกนแทนครับ',
      }
    }

    finalUrl = response.url || formattedUrl
    html = await response.text()
  } catch (err: any) {
    console.error('Fetch URL Error:', err)
    return {
      success: false,
      blocked: true,
      message: `ไม่สามารถเข้าถึงลิงก์ได้ (${err.message || 'เน็ตเวิร์กล้มเหลว'}) กรุณาคัดลอกข้อความหรือแคปรูปมาวางแทน`,
    }
  }

  // 2. ตรวจสอบการติด Login Wall / Anti-Bot ผ่านเนื้อหา HTML
  const isFb = /facebook\.com/i.test(formattedUrl)
  const isX = /x\.com|twitter\.com/i.test(formattedUrl)
  const isFbBlocked = /login\.php|facebook\.com\/login|เข้าสู่ระบบ facebook|log in to facebook|something went wrong|getting this fixed/i.test(html)
  const isXBlocked = /x\.com\/i\/flow\/login|twitter\.com\/login/i.test(html)

  if ((isFb && isFbBlocked) || (isX && isXBlocked) || (isFb && html.length < 6000)) {
    return {
      success: false,
      blocked: true,
      message: 'โพสต์โซเชียลนี้ติดระบบป้องกันความปลอดภัย (Login Wall / Anti-Bot) ทำให้ระบบภายนอกไม่สามารถเข้าถึงเนื้อหาได้ กรุณาคัดลอกข้อความในโพสต์มาวาง หรือแคปหน้าจอรูปมาสแกนแทนครับ',
    }
  }

  // 3. Extract Open Graph & Meta Tags via Regex
  const getMeta = (prop: string) => {
    const regex1 = new RegExp(`<meta[^>]*property=["']${prop}["'][^>]*content=["']([^"']*)["']`, 'i')
    const regex2 = new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*property=["']${prop}["']`, 'i')
    const regex3 = new RegExp(`<meta[^>]*name=["']${prop}["'][^>]*content=["']([^"']*)["']`, 'i')
    const match = html.match(regex1) || html.match(regex2) || html.match(regex3)
    return match ? match[1].trim() : ''
  }

  const ogTitle = getMeta('og:title') || getMeta('twitter:title') || ''
  const ogDesc = getMeta('og:description') || getMeta('twitter:description') || getMeta('description') || ''
  let ogImage = getMeta('og:image') || getMeta('twitter:image') || ''

  // Fix relative image URLs
  if (ogImage && !/^https?:\/\//i.test(ogImage)) {
    try {
      ogImage = new URL(ogImage, finalUrl).toString()
    } catch {
      // ignore
    }
  }

  // Extract comment blocks if present in public forums/blogs/news
  const commentMatches = html.match(/<(div|article|li|section)[^>]*(class|id)=["'][^"']*(comment|reply|response|discussion|thread)[^"']*["'][^>]*>([\s\S]*?)<\/\1>/gi)
  let commentsText = ''
  if (commentMatches && commentMatches.length > 0) {
    commentsText = '\n--- คอมเมนต์ใต้โพสต์ ---\n' + commentMatches.slice(0, 10).map((c, i) => {
      const clean = c.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      return `คอมเมนต์ที่ ${i + 1}: ${clean}`
    }).join('\n')
  }

  // Try extracting body text if og:description is empty
  let extractedText = [ogTitle, ogDesc].filter(Boolean).join('\n')
  if (!extractedText || extractedText.length < 15) {
    // Strip script, style, and html tags for general pages
    const cleanBody = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    extractedText = cleanBody.slice(0, 2000)
  }

  if (commentsText) {
    extractedText += commentsText
  }

  if (!extractedText || extractedText.length < 10) {
    return {
      success: false,
      blocked: false,
      message: 'อ่านหน้าเว็บสำเร็จ แต่ไม่พบเนื้อหาข้อความที่เกี่ยวกับป้ายทะเบียน กรุณาคัดลอกข้อความมาวางโดยตรง',
    }
  }

  // 4. Use Gemini Multi-Model Cascade to parse structured plate info
  const keys = getGeminiApiKeys()
  let parsedPlates: any = null

  if (keys.length > 0) {
    try {
      const prompt = `คุณคือระบบ AI อัจฉริยะสำหรับสกัดข้อมูลป้ายทะเบียนรถที่สูญหายหรือพบช่วงน้ำท่วม จากเนื้อหาที่ดึงมาจากหน้าเว็บ โพสต์โซเชียล หรือกระทู้สนทนา ซึ่งอาจมีทั้งเนื้อหาหลักและคอมเมนต์ย่อย

จงวิเคราะห์ข้อความต่อไปนี้อย่างละเอียดรอบคอบ โดยอ่านทั้งโพสต์หลักและทุกคอมเมนต์:
1. ข้อมูลหลักส่วนกลาง (Default Shared Info):
   - reportType: 'FOUND' (ถ้าเนื้อหาเป็นการพบป้าย/เก็บป้ายได้/ส่งมอบ) หรือ 'LOST' (ถ้าเนื้อหาเป็นการตามหาป้าย/แจ้งป้ายหาย/ใครเจอบ้าง)
   - contactName: ชื่อผู้โพสต์หลัก หรือชื่อหน่วยงาน/กู้ภัยหลัก ถ้าไม่ระบุให้ใช้ 'ผู้ประสานงาน'
   - contactPhone: เบอร์โทรศัพท์ติดต่อหลัก (ตัดขีดให้เหลือตัวเลข 9-10 หลัก) ถ้าไม่พบให้เป็น ''
   - pickupLocation: จุดรับป้ายหลัก หรือพิกัดที่หลุดหาย
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
"""${extractedText}"""

ตอบกลับเป็น JSON ในรูปแบบนี้เท่านั้น:
{
  "reportType": "FOUND",
  "contactName": "ชื่อผู้ติดต่อหลัก",
  "contactPhone": "0812345678",
  "pickupLocation": "สถานที่รับป้ายหลัก หรือจุดที่ทำหลุดหาย",
  "plates": [
    {
      "vehicleType": "CAR",
      "platePrefix": "กข",
      "plateNumber": "1234",
      "province": "ระยอง",
      "contactName": "ชื่อผู้ติดต่อของป้ายนี้",
      "contactPhone": "0812345678",
      "pickupLocation": "จุดรับป้ายนี้ หรือจุดที่หลุดหาย"
    }
  ]
}`

      const { text } = await generateWithGeminiFallback({
        contents: prompt,
        generationConfig: { responseMimeType: 'application/json' },
      })
      const cleanJson = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()
      parsedPlates = JSON.parse(cleanJson)
    } catch (err: any) {
      console.error('Gemini parse error in fetch-url:', err)
    }
  }

  return {
    success: true,
    blocked: false,
    extractedTitle: ogTitle,
    extractedText,
    extractedImage: ogImage || null,
    data: parsedPlates || {
      contactName: 'ผู้ประสานงาน',
      contactPhone: '',
      pickupLocation: 'ตามที่ระบุในโพสต์',
      plates: [],
    },
  }
})
