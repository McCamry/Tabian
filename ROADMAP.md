# ROADMAP.md - แผนงานการพัฒนาระบบ Tabian (Development Roadmap)

แผนงานการพัฒนาระบบ Tabian แบ่งออกเป็นระยะ (Phases) เพื่อให้สามารถเปิดใช้งานฟังก์ชันกู้ภัยจำเป็นได้อย่างรวดเร็วที่สุด แล้วค่อยทยอยเพิ่มฟีเจอร์ระดับสูง

---

```mermaid
gantt
    title Tabian Product Development Roadmap
    dateFormat  YYYY-MM-DD
    section Phase 1: Core Mobile Web
    สถาปัตยกรรม & ฐานข้อมูล SQLite/Prisma       :done, p1_1, 2026-10-01, 2d
    หน้าแรก ค้นหาด่วน & ตัวกรองจังหวัด         :active, p1_2, 2026-10-03, 3d
    ฟอร์มลงข้อมูลฝั่ง "เจอ" และ "หา"              :active, p1_3, 2026-10-05, 3d
    ระบบ PIN 4 หลัก & ซ่อนเบอร์โทรศัพท์         :p1_4, 2026-10-07, 2d
    section Phase 2: AI Multi-Plate OCR
    เชื่อมต่อ Gemini 2.0/1.5 Flash Vision API :p2_1, 2026-10-09, 3d
    หน้าจอถ่ายภาพกองป้าย & Preview ตรวจสอบ      :p2_2, 2026-10-12, 3d
    การบีบอัดรูปภาพฝั่ง Client (Canvas WebP)   :p2_3, 2026-10-14, 2d
    section Phase 3: Social Media Importer
    ตัวสกัดข้อความจากโพสต์ Facebook/LINE ด้วย AI :p3_1, 2026-10-16, 3d
    Batch Verification & Confirm Modal        :p3_2, 2026-10-19, 2d
    section Phase 4: LINE & PWA
    ระบบแชร์เข้ากลุ่ม LINE ในคลิกเดียว           :p4_1, 2026-10-21, 2d
    Open Graph Meta Cards & PWA Manifest      :p4_2, 2026-10-23, 2d
    section Phase 5: Advanced & Expansion
    แผนที่แสดงจุดรับป้าย (Interactive Map)      :p5_1, 2026-10-26, 4d
    LINE Official Account Bot อัตโนมัติ       :p5_2, 2026-10-30, 5d
```

---

## รายละเอียดแต่ละระยะ (Milestones)

### Phase 1: Core Disaster Response (สัปดาห์ที่ 1)
- [x] ออกแบบโครงสร้างระบบและเอกสารมาตรฐานโครงการ
- [x] ติดตั้ง Nuxt 3, Tailwind CSS, Prisma และ SQLite
- [x] พัฒนาหน้า Home สำหรับค้นหาเลขทะเบียนด่วน (Instant Search)
- [x] พัฒนาฟอร์มกรอกรายการเดี่ยวฝั่ง "เจอ" (พบป้าย) และฝั่ง "หา" (ป้ายหาย)
- [x] ระบบสร้างและตรวจสอบ PIN 4 หลัก สำหรับอัปเดตสถานะ "รับคืนแล้ว"

### Phase 2: AI Multi-Plate OCR (สัปดาห์ที่ 2)
- [x] พัฒนา Endpoint `/api/ai/ocr-multi` เชื่อมต่อ Gemini Vision API
- [x] พัฒนาหน้าจอรองรับการถ่ายภาพกองป้ายทะเบียน (5 - 30 ป้ายต่อรูป)
- [x] หน้าจอ Review Table ให้กู้ภัยตรวจสอบ/แก้ไขเลขทะเบียนก่อนบันทึก
- [x] Client-side Image Resizing เพื่อให้ส่งรูปผ่านเน็ตมือถือได้รวดเร็ว

### Phase 3: Social Media Importer (สัปดาห์ที่ 3)
- [x] พัฒนาระบบ AI Smart Paste สำหรับข้อความโพสต์จากกลุ่ม Facebook/LINE
- [x] ระบบสกัดเบอร์โทร, สถานที่รับป้าย และรายการป้ายทะเบียนอัตโนมัติ
- [x] ระบบบันทึกแบบกลุ่ม (Batch Save `/api/plates/batch`)

### Phase 4: LINE Integration & PWA (สัปดาห์ที่ 4)
- [x] ปุ่ม 1-Click Share to LINE Chat / Group พร้อมพรีวิวข้อความ
- [x] Dynamic Open Graph Meta Tags สำหรับพรีวิวในแชท LINE
- [ ] ตั้งค่า PWA (Add to Home Screen) ติดตั้งเป็นไอคอนบนหน้าจอมือถือได้

### Phase 5: แผนที่และการขยายผล (Future Enhancements)
- [ ] แสดงจุดรับป้ายทะเบียนบนแผนที่ (Leaflet / Google Maps)
- [ ] บอท LINE Official Account รับรูปป้ายและบันทึกอัตโนมัติผ่าน Webhook
