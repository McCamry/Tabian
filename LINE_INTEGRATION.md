# LINE_INTEGRATION.md - สถาปัตยกรรมและการเชื่อมต่อระบบ LINE

ในประเทศไทย LINE เป็นช่องทางการสื่อสารที่สำคัญที่สุด โดยเฉพาะการส่งข่าวและประสานงานกู้ภัยน้ำท่วม Tabian จึงถูกออกแบบให้ทำงานร่วมกับ LINE อย่างแนบเนียน

---

## 1. การแชร์ป้ายทะเบียนลงกลุ่ม LINE ในคลิกเดียว (1-Click LINE Share)

ในหน้ารายละเอียดของแต่ละป้ายทะเบียน จะมีปุ่ม **"แชร์เข้า LINE"** สีเขียวเด่นชัดสำหรับผู้ใช้มือถือ
โดยทำงานผ่าน URL Scheme:

```ts
export function shareToLine(plate: PlateItem) {
  const text = encodeURIComponent(
    `📢 พบป้ายทะเบียนรถน้ำท่วม!\n` +
    `🚗 ทะเบียน: ${plate.platePrefix} ${plate.plateNumber} ${plate.province}\n` +
    `📍 จุดรับป้าย: ${plate.pickupLocation}\n` +
    `📞 ติดต่อ: ${plate.contactName}\n` +
    `🔎 ดูรายละเอียด/แผนที่: https://tabian.app/plates/${plate.id}`
  );
  window.open(`https://line.me/R/msg/text/?${text}`, '_blank');
}
```

---

## 2. การตั้งค่า Open Graph Tags เพื่อพรีวิวการ์ดใน LINE (Rich Preview Cards)

เมื่อมีผู้ใช้คัดลอกลิงก์ป้ายทะเบียนไปวางในแชท LINE ระบบ Nuxt 3 (SSR) จะสร้าง Open Graph Meta Tags ให้แสดงเป็นการ์ดรูปภาพป้ายทะเบียนและข้อความชัดเจน:

```html
<meta property="og:type" content="article" />
<meta property="og:title" content="พบป้ายทะเบียน กข 1234 เชียงใหม่ - Tabian" />
<meta property="og:description" content="จุดรับป้าย: ป้อมตำรวจแม่สาย ติดต่อรับคืนได้แล้ววันนี้" />
<meta property="og:image" content="https://tabian.app/api/og/plate-clx123.png" />
<meta property="og:url" content="https://tabian.app/plates/clx123" />
```

---

## 3. การรองรับ LINE LIFF (LINE Front-end Framework)

เพื่อให้เว็บแอปสามารถเปิดใช้งานภายใน LINE App ได้อย่างไร้รอยต่อ โดยไม่ต้องสลับไปเปิดเบราว์เซอร์ภายนอก:
1. ลงทะเบียน LIFF App ใน **LINE Developers Console**
2. กำหนด Endpoint URL ไปยังโดเมนของ Tabian
3. รองรับการทำงานใน LINE In-App Browser (ไม่ติดปัญหา Cookie หรือ Storage)

---

## 4. แผนงานระยะถัดไป: LINE Official Account & Bot (Roadmap)
- ผู้ใช้สามารถส่งรูปป้ายทะเบียนเข้าไปในห้องแชทของ LINE Official Account
- Webhook Server ของ Tabian จะรับภาพ -> ส่งให้ Gemini OCR -> บันทึกลงฐานข้อมูล -> ตอบกลับผลลัพธ์เป็น Flex Message สรุปรายการ
