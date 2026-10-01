# ARCHITECTURE.md - สถาปัตยกรรมระบบ Tabian (ระบบจัดการทะเบียนรถสูญหายช่วงน้ำท่วม)

## 1. ภาพรวมระบบ (System Overview)
Tabian คือเว็บแอปพลิเคชัน Mobile-First ออกแบบมาเพื่อรับมือสถานการณ์ฉุกเฉินน้ำท่วม สำหรับจับคู่และส่งคืนแผ่นป้ายทะเบียนรถยนต์และรถจักรยานยนต์ที่หลุดหายจากการลุยน้ำท่วม โดยเน้นความง่ายในการใช้งานบนโทรศัพท์มือถือ ความเร็วในการค้นหา และความสามารถในการดึงข้อมูลทะเบียนหลายแผ่นพร้อมกันจากภาพถ่ายหรือโพสต์โซเชียลมีเดียด้วย AI

---

## 2. แผนภาพสถาปัตยกรรมระดับสูง (High-Level Architecture)

```mermaid
graph TD
    subgraph ClientLayer ["📱 Client Layer (Mobile-First Web App)"]
        UI_Home["หน้าแรก (ค้นหาด่วน + สรุปสถานะ)"]
        UI_Found["หน้าแจ้ง 'เจอ' (ป้ายเดียว / AI ถ่ายรูปหลายป้าย)"]
        UI_Lost["หน้าแจ้ง 'หา' (ระบุป้ายที่หาย + จุดที่น้ำท่วม)"]
        UI_Import["หน้า AI Smart Import (วางข้อความ/รูปจากโซเชียล)"]
        UI_Detail["หน้ารายละเอียดป้าย + ปุ่มโทรออก/แชร์ LINE"]
    end

    subgraph AppLayer ["⚡ Application Server (Nuxt 3 & Nitro Engine)"]
        Router["Nuxt File-based Router & SSR/CSR Hydration"]
        Middleware["PIN Auth & Rate-Limiter Middleware"]
        APIRoutes["Nitro API Endpoints (/api/plates, /api/ai, /api/search)"]
    end

    subgraph ServiceLayer ["🧠 Service & Business Logic"]
        MatchService["Smart Plate Matching Engine (Fuzzy + Prefix Matching)"]
        AIService["Gemini Multimodal Vision & Text Extraction Engine"]
        StorageService["Image Processing & Optimization (WebP Resizing)"]
    end

    subgraph DataLayer ["💾 Data & Storage"]
        DB[(SQLite / PostgreSQL via Prisma or Drizzle)]
        FileStore["Local Uploads / Cloud Storage (WebP)"]
    end

    subgraph ExternalServices ["🌐 External Integration"]
        GeminiAPI["Google Gemini API (Vision & Structured Output)"]
        LINEService["LINE Social Share & LIFF Platform"]
    end

    ClientLayer --> AppLayer
    AppLayer --> ServiceLayer
    ServiceLayer --> DataLayer
    ServiceLayer --> ExternalServices
```

---

## 3. องค์ประกอบทางเทคนิค (Technical Stack)

| ส่วนประกอบ | เทคโนโลยี | เหตุผลและหน้าที่ |
|---|---|---|
| **Core Framework** | **Nuxt 3 (Vue 3)** | ประสิทธิภาพสูง โหลดเร็วบนมือถือ รองรับ SSR สำหรับ SEO และ CSR เพื่อความลื่นไหล |
| **Server Engine** | **Nitro (Nuxt Built-in Engine)** | รัน API Serverless หรือ Node.js Server ได้อย่างเบาและรวดเร็ว |
| **Styling & Design** | **Tailwind CSS + Tailwind Aspect Ratio** | ออกแบบ UI Mobile-First ระบบ Responsive UI และรองรับ Touch Targets ขนาดใหญ่ |
| **Icons** | **Lucide Vue Next** | ไอคอน Vector ชัดเจน โหลดเฉพาะที่ใช้งาน |
| **Database ORM** | **Prisma ORM (with LibSQL Adapter)** | Type-safe Database Access รองรับ Dual-Engine: Local SQLite (เครื่อง/Render) และ Turso Cloud SQLite (สำหรับ Vercel Serverless) |
| **AI Vision & NLP** | **Google Gemini 2.5 Flash API** | แม่นยำสูงกับฟอนต์ภาษาไทย ป้ายเปื้อนโคลน และรองรับ Structured JSON Output |
| **Image Processing** | **Sharp (Server) + Canvas (Client-side Resize)** | บีบอัดรูปภาพเป็น WebP ก่อนส่งขึ้นเซิร์ฟเวอร์ ประหยัดเน็ตมือถือ |
| **Social Sharing** | **LINE URL Scheme & Open Graph Protocol** | แผงพรีวิวสวยงามเมื่อแชร์ป้ายที่เจอลง LINE กลุ่มหรือ Facebook |

---

## 4. แผนผังการไหลของข้อมูล (Data Flow Diagrams)

### 4.1 ขั้นตอนการลงข้อมูลฝั่ง "เจอ" ผ่าน AI Multi-Plate OCR
```mermaid
sequenceDiagram
    autonumber
    actor Finder as ผู้พบป้าย (กู้ภัย/พลเมืองดี)
    participant Client as Mobile Web (Nuxt 3)
    participant Server as Nitro API (/api/ai/ocr-multi)
    participant Gemini as Google Gemini Vision API
    participant DB as Database

    Finder->>Client: ถ่ายภาพรวมป้ายทะเบียน 5-20 แผ่น
    Client->>Client: ย่อขนาดรูปภาพ (Max 1600px, WebP)
    Client->>Server: ส่งภาพ Base64/Multipart
    Server->>Gemini: ส่งภาพพร้อม Prompt สกัดหมวด-เลข-จังหวัด แบบ JSON
    Gemini-->>Server: ส่งผลลัพธ์ Array ของทะเบียนที่อ่านได้
    Server-->>Client: แสดงตารางข้อมูลให้ผู้ใช้ตรวจสอบ
    Finder->>Client: ตรวจสอบ/แก้ไข + กรอกสถานที่รับป้าย + เบอร์โทร + PIN
    Client->>Server: สั่งบันทึกข้อมูลแบบ Batch (/api/plates/batch)
    Server->>DB: บันทึกข้อมูลลงฐานข้อมูล (Status: FOUND)
    Server->>DB: เรียก Match Engine ตรวจว่าตรงกับฝั่ง "หา" หรือไม่
    Server-->>Client: สำเร็จ! แสดง QR Code / รหัสสำหรับติดตาม
```

### 4.2 ขั้นตอนการลงข้อมูลฝั่ง "หา" และการจับคู่ (Smart Matching)
```mermaid
sequenceDiagram
    autonumber
    actor Owner as เจ้าของรถ
    participant Client as Mobile Web (Nuxt 3)
    participant Server as Nitro API (/api/plates/lost)
    participant Match as Matching Engine
    participant DB as Database

    Owner->>Client: กรอกหมวดอักษร, เลขทะเบียน, จังหวัด, เบอร์ติดต่อ
    Client->>Server: ส่งข้อมูลป้ายที่สูญหาย
    Server->>DB: บันทึกสถานะ LOST
    Server->>Match: ตรวจสอบทะเบียนในหมวด FOUND ที่ตรงกัน
    alt มีป้ายทะเบียนตรงกันในระบบ
        Match-->>Server: พบป้ายที่ตรงกัน!
        Server-->>Client: แจ้งผลทันที "พบป้ายของคุณแล้ว พร้อมเบอร์ติดต่อและสถานที่รับ!"
    else ยังไม่มีในระบบ
        Match-->>Server: ไม่พบ
        Server-->>Client: บันทึกเรียบร้อย หากมีผู้พบในอนาคตจะแสดงผลในระบบ
    end
```

---

## 5. การรักษาความปลอดภัยและความเป็นส่วนตัว (Security & Privacy)
1. **Masked Phone Numbers**: หน้าเว็บสาธารณะจะแสดงเบอร์โทรในรูปแบบ `081-xxx-1234` มีปุ่ม "กดเพื่อโทรออก" เพื่อป้องกัน Web Scraping บอทดูดเบอร์โทรศัพท์
2. **PIN-Protected Operations**: เมื่อสร้างรายการ จะให้ผู้ใช้กำหนด PIN 4 หลัก โดยระบบจะ Hash ด้วย bcrypt/Argon2 เพื่อใช้ยืนยันเวลาต้องการแก้ไขหรือกดปิดสถานะ "รับคืนเรียบร้อยแล้ว"
3. **Rate Limiting**: จำกัดจำนวนครั้งในการเรียก API (เช่น การใช้ AI OCR และการบันทึก) ผ่าน IP-based Rate Limiter ป้องกันการยิงสแปม
4. **Input Sanitization**: ตรวจสอบและ Escape ข้อมูลตัวอักษรเพื่อป้องกัน XSS และ SQL Injection
