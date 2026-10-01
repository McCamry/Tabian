# API.md - เอกสารข้อกำหนด API (Application Programming Interface)

ระบบ Tabian พัฒนา API ผ่าน Nitro Server Engine ของ Nuxt 3 โดยทุก Endpoint เป็น RESTful JSON API

---

## 1. ข้อมูลสรุป Endpoints

| Method | Endpoint | คำอธิบาย | สิทธิ์การเข้าถึง |
|---|---|---|---|
| `GET` | `/api/plates` | ค้นหาและดึงรายการป้ายทะเบียน | สาธารณะ |
| `GET` | `/api/plates/:id` | ดูรายละเอียดป้ายเดี่ยวและการจับคู่ | สาธารณะ |
| `POST` | `/api/plates` | บันทึกข้อมูลป้ายเดี่ยว (เจอ หรือ หา) | สาธารณะ (มี Rate Limit) |
| `POST` | `/api/plates/batch` | บันทึกป้ายทะเบียนชุดใหญ่ (Batch Save) | สาธารณะ (มี Rate Limit) |
| `PUT` | `/api/plates/:id` | แก้ไขข้อมูลป้ายทะเบียนและสถานะ | ต้องใช้ Master Admin Key หรือ PIN |
| `POST` | `/api/plates/:id/verify-pin` | ยืนยันรหัส PIN 4 หลักของป้ายทะเบียน | สาธารณะ |
| `DELETE` | `/api/plates/:id` | ลบรายการป้ายทะเบียน | ต้องใช้ Master Admin Key หรือ PIN |
| `POST` | `/api/admin/verify` | ตรวจสอบรหัสผ่าน Master Admin Key | สาธารณะ (Rate Limited) |
| `POST` | `/api/ai/ocr-multi` | ส่งภาพถ่ายเพื่ออ่านทะเบียนหลายแผ่นด้วย AI | สาธารณะ (มี Rate Limit) |
| `POST` | `/api/ai/parse-social`| ส่งข้อความโพสต์โซเชียลเพื่อสกัดทะเบียน | สาธารณะ (มี Rate Limit) |
| `POST` | `/api/ai/fetch-url` | ดึงเนื้อหาและรูปภาพจากลิงก์เว็บ/โซเชียลอัตโนมัติ | สาธารณะ (มี Rate Limit) |
| `GET` | `/api/provinces` | ดึงรายชื่อ 77 จังหวัด | สาธารณะ (Cached) |
| `GET` | `/api/stats` | สถิติภาพรวม (พบแล้ว, กำลังหา, ส่งคืนแล้ว) | สาธารณะ |
| `GET` | `/api/health` | ตรวจสอบสถานะเซิร์ฟเวอร์และการเชื่อมต่อฐานข้อมูล | สาธารณะ |

---

## 2. รายละเอียดแต่ละ Endpoint

### 2.1 ค้นหารายการป้ายทะเบียน `GET /api/plates`
**Query Parameters:**
- `q`: คำค้นหา (ตัวเลข, หมวดอักษร หรือข้อความผสม เช่น "1234", "กข 1234")
- `type`: `FOUND` (เจอ) หรือ `LOST` (หา)
- `vehicle`: `CAR` หรือ `MOTORCYCLE`
- `province`: ชื่อจังหวัด (เช่น "เชียงใหม่")
- `status`: `ACTIVE`, `RETURNED` (ค่าเริ่มต้น: `ACTIVE`)
- `page`: หน้า (Default `1`)
- `limit`: จำนวนต่อหน้า (Default `20`, Max `50`)

**ตัวอย่าง Response 200 OK:**
```json
{
  "success": true,
  "data": [
    {
      "id": "clx123abc456",
      "reportType": "FOUND",
      "vehicleType": "CAR",
      "platePrefix": "กข",
      "plateNumber": "1234",
      "province": "เชียงใหม่",
      "imageUrl": "/uploads/plates/img123.webp",
      "contactName": "จุดประสานงานกู้ภัยแม่สาย",
      "contactPhoneMasked": "081-xxx-5678",
      "pickupLocation": "ป้อมตำรวจแยกดอยเขาควาย",
      "sourceUrl": "https://www.facebook.com/groups/.../posts/123",
      "sourceImageUrl": "data:image/jpeg;base64,...",
      "status": "ACTIVE",
      "createdAt": "2026-09-30T10:00:00.000Z"
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "totalPages": 1
  }
}
```

---

### 2.2 บันทึกข้อมูลป้ายเดี่ยว `POST /api/plates`
**Request Body:**
```json
{
  "reportType": "FOUND",
  "vehicleType": "CAR",
  "platePrefix": "กข",
  "plateNumber": "1234",
  "province": "เชียงใหม่",
  "imageUrl": "data:image/webp;base64,...",
  "sourceUrl": "https://www.facebook.com/... (ไม่บังคับ)",
  "sourceImageUrl": "data:image/jpeg;base64,... (ไม่บังคับ)",
  "contactName": "คุณวิชัย",
  "contactPhone": "0812345678",
  "pickupLocation": "เทศบาลนครเชียงใหม่",
  "pin": "1234"
}
```

**ตัวอย่าง Response 201 Created:**
```json
{
  "success": true,
  "message": "บันทึกข้อมูลเรียบร้อยแล้ว",
  "data": {
    "id": "clx123abc456",
    "matched": true,
    "matchedCount": 1,
    "matchedPlates": [
      {
        "id": "clx999xyz",
        "contactName": "คุณสมศรี (เจ้าของรถที่แจ้งหาย)",
        "contactPhoneMasked": "089-xxx-9999"
      }
    ]
  }
}
```

---

### 2.3 อ่านทะเบียนหลายแผ่นจากภาพถ่าย `POST /api/ai/ocr-multi`
**Request Body:**
```json
{
  "image": "data:image/jpeg;base64,...",
  "mimeType": "image/jpeg"
}
```

**ตัวอย่าง Response 200 OK:**
```json
{
  "success": true,
  "detectedCount": 3,
  "plates": [
    {
      "vehicleType": "CAR",
      "platePrefix": "กข",
      "plateNumber": "1234",
      "province": "เชียงใหม่",
      "confidence": 0.95
    },
    {
      "vehicleType": "CAR",
      "platePrefix": "2ขข",
      "plateNumber": "9876",
      "province": "กรุงเทพมหานคร",
      "confidence": 0.92
    },
    {
      "vehicleType": "MOTORCYCLE",
      "platePrefix": "1กง",
      "plateNumber": "333",
      "province": "ลำพูน",
      "confidence": 0.88
    }
  ]
}
```

---

### 2.4 สกัดข้อมูลจากข้อความโพสต์ Social Media & คอมเมนต์ `POST /api/ai/parse-social`
รองรับทั้งเนื้อหาโพสต์เดี่ยว และเนื้อหาโพสต์รวมกับคอมเมนต์หลายรายการ (Multi-Comment Thread)
**Request Body:**
```json
{
  "rawText": "โพสต์หลัก: รวบรวมป้ายทะเบียนน้ำท่วมพัทยา ติดต่อพี่เด่น 0891112222 รับได้ที่เต็นท์หน้าเมืองจำลอง\nคอมเมนต์ 1: ป้าย กก 9999 ชลบุรี โทรหาลุงเชียร 081-333-4444 ไปรับที่ป้อมตำรวจแยกสายสาม\nคอมเมนต์ 2: มอเตอร์ไซค์ 2กข 8888 ระยอง ติดต่อกู้ภัย 038-123-456"
}
```

**ตัวอย่าง Response 200 OK:**
```json
{
  "success": true,
  "data": {
    "reportType": "FOUND",
    "contactName": "พี่เด่น",
    "contactPhone": "0891112222",
    "pickupLocation": "เต็นท์หน้าเมืองจำลอง",
    "plates": [
      {
        "vehicleType": "CAR",
        "platePrefix": "กก",
        "plateNumber": "9999",
        "province": "ชลบุรี",
        "contactName": "ลุงเชียร",
        "contactPhone": "0813334444",
        "pickupLocation": "ป้อมตำรวจแยกสายสาม"
      },
      {
        "vehicleType": "MOTORCYCLE",
        "platePrefix": "2กข",
        "plateNumber": "8888",
        "province": "ระยอง",
        "contactName": "กู้ภัย",
        "contactPhone": "038123456",
        "pickupLocation": "ศาลาริมทางสุขุมวิท"
      }
    ]
  }
}
```

---

### 2.5 ปิดเคส / อัปเดตสถานะ `PATCH /api/plates/:id/status`
**Request Body:**
```json
{
  "status": "RETURNED",
  "pin": "1234"
}
```

**ตัวอย่าง Response 200 OK:**
```json
{
  "success": true,
  "message": "อัปเดตสถานะเป็นส่งมอบเรียบร้อยแล้ว"
}
```

---

### 2.6 บันทึกป้ายทะเบียนชุดใหญ่ (Batch Save) `POST /api/plates/batch`
ใช้สำหรับบันทึกผลลัพธ์จาก AI Multi-Plate OCR หรือ Social Media Importer พร้อมกันหลายแผ่น รองรับข้อมูลผู้ติดต่อแยกรายป้าย (Per-plate Contact Resolution) โดยจะนำค่าเฉพาะป้ายมาใช้ก่อน และหากไม่มีจะดึงค่าสำรองจาก `sharedInfo` ให้อัตโนมัติ

**Request Body:**
```json
{
  "plates": [
    { 
      "vehicleType": "CAR", 
      "platePrefix": "กก", 
      "plateNumber": "9999", 
      "province": "ชลบุรี",
      "reportType": "FOUND",
      "contactName": "ลุงเชียร",
      "contactPhone": "0813334444",
      "pickupLocation": "ป้อมตำรวจแยกสายสาม"
    },
    { 
      "vehicleType": "CAR", 
      "platePrefix": "7กก", 
      "plateNumber": "7777", 
      "province": "กรุงเทพมหานคร"
    }
  ],
  "sharedInfo": {
    "reportType": "FOUND",
    "contactName": "พี่เด่น",
    "contactPhone": "0891112222",
    "pickupLocation": "เต็นท์หน้าเมืองจำลอง",
    "sourceUrl": "https://www.facebook.com/... (ไม่บังคับ)",
    "sourceImageUrl": "data:image/jpeg;base64,... (ไม่บังคับ)",
    "imageUrl": "data:image/jpeg;base64,... (รูปถ่ายกองป้ายที่สแกน)",
    "pin": "1234"
  },
  "sourceType": "SOCIAL_POST_TEXT",
  "rawContent": "..."
}
```

**ตัวอย่าง Response 200 OK:**
```json
{
  "success": true,
  "message": "บันทึกข้อมูลป้ายทะเบียนชุดใหญ่สำเร็จทั้งหมด 2 รายการ",
  "batchImportId": "clx789xyz",
  "savedCount": 2
}
```

---

### 2.7 ดึงเนื้อหาและรูปภาพจากลิงก์เว็บ/โซเชียล `POST /api/ai/fetch-url`
ใช้สำหรับดึง Open Graph metadata (ชื่อเรื่อง, เนื้อหา, รูปภาพ) และสกัดบล็อกคอมเมนต์ใน HTML ส่งให้ Gemini AI ประมวลผลป้ายทะเบียนและผู้ติดต่อแยกรายป้ายอัตโนมัติ

**Request Body:**
```json
{
  "url": "https://www.facebook.com/groups/..."
}
```

**ตัวอย่าง Response 200 OK (กรณีดึงสำเร็จ):**
```json
{
  "success": true,
  "blocked": false,
  "extractedTitle": "พบป้ายทะเบียนตกหล่นน้ำท่วม แยกเกาะกลอย",
  "extractedText": "พบป้าย กข 1234 ระยอง และ มอไซค์ 1กง 555 ชลบุรี...",
  "extractedImage": "https://.../cover.jpg",
  "data": {
    "contactName": "ผู้ประสานงาน",
    "contactPhone": "0812345678",
    "pickupLocation": "แยกเกาะกลอย",
    "plates": [
      { 
        "vehicleType": "CAR", 
        "platePrefix": "กข", 
        "plateNumber": "1234", 
        "province": "ระยอง",
        "contactName": "ผู้ประสานงาน",
        "contactPhone": "0812345678",
        "pickupLocation": "แยกเกาะกลอย"
      }
    ]
  }
}
```

**ตัวอย่าง Response 200 OK (กรณีติด Login Wall / Anti-Bot):**
```json
{
  "success": false,
  "blocked": true,
  "message": "โพสต์โซเชียลนี้ติดระบบป้องกันความปลอดภัย (Login Wall / Anti-Bot) ทำให้ระบบภายนอกไม่สามารถเข้าถึงเนื้อหาได้ กรุณาคัดลอกข้อความในโพสต์มาวาง หรือแคปหน้าจอรูปมาสแกนแทนครับ"
}
```

---

### 2.10 ยืนยันรหัสผ่านผู้ดูแลระบบ `POST /api/admin/verify`
ใช้สำหรับตรวจสอบ Master Admin Key เพื่อเข้าสู่โหมดผู้ดูแลระบบ

**Request Body:**
```json
{
  "password": "admin1234"
}
```

**ตัวอย่าง Response 200 OK:**
```json
{
  "success": true,
  "message": "ยืนยันตัวตนผู้ดูแลระบบสำเร็จ"
}
```

**ตัวอย่าง Response 401 Unauthorized:**
```json
{
  "statusCode": 401,
  "statusMessage": "รหัสผ่านผู้ดูแลระบบไม่ถูกต้อง"
}
```

---

### 2.11 แก้ไขข้อมูลป้ายทะเบียน `PUT /api/plates/:id`
แก้ไขข้อมูลป้ายทะเบียนและสถานะ โดยผู้ดูแลระบบ (ใช้ Header `x-admin-key`) หรือเจ้าของข้อมูลเดิม (ใช้ PIN)

**Request Headers (สำหรับ Admin):**
- `x-admin-key`: `<Master Admin Key>`

**Request Body:**
```json
{
  "reportType": "FOUND",
  "vehicleType": "CAR",
  "platePrefix": "กข",
  "plateNumber": "1234",
  "province": "ระยอง",
  "contactName": "จุดรวมป้าย",
  "contactPhone": "0812345678",
  "pickupLocation": "วัดเนินพระ",
  "status": "RETURNED",
  "sourceUrl": "https://...",
  "pin": "1234"
}
```

**ตัวอย่าง Response 200 OK:**
```json
{
  "success": true,
  "message": "อัปเดตข้อมูลป้ายทะเบียนสำเร็จ",
  "data": { ... }
}
```

---

### 2.12 ลบรายการป้ายทะเบียน `DELETE /api/plates/:id`
ลบรายการป้ายทะเบียนออกจากระบบอย่างถาวร

**Request Headers (สำหรับ Admin):**
- `x-admin-key`: `<Master Admin Key>`

**Query Parameters / Body (สำหรับเจ้าของข้อมูลเดิม):**
- `pin`: `<PIN 4 หลัก>`

**ตัวอย่าง Response 200 OK:**
```json
{
  "success": true,
  "message": "ลบรายการป้ายทะเบียน กข 1234 ระยอง เรียบร้อยแล้ว",
  "deletedId": "clx123abc456"
}
```

