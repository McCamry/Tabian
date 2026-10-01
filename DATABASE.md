# DATABASE.md - โครงสร้างฐานข้อมูลระบบ Tabian

## 1. ภาพรวมการออกแบบฐานข้อมูล (Database Overview)
ระบบฐานข้อมูลของ Tabian ได้รับการออกแบบให้รองรับทั้ง **SQLite** (สำหรับใช้งานในสภาพแวดล้อมฉุกเฉิน ติดตั้งได้ง่าย ไม่มี Overhead) และสามารถขยายสู่ **PostgreSQL** ได้ทันทีโดยใช้ **Prisma ORM**

จุดสำคัญที่สุดของฐานข้อมูลนี้คือ **ความเร็วในการค้นหาหมายเลขทะเบียน** โดยมีการทำ `normalized_plate` และ Multi-Column Index เพื่อให้ค้นหาได้ไวแม้มีข้อมูลหลายหมื่นรายการ

---

## 2. แผนผังความสัมพันธ์ (Entity-Relationship Diagram)

```mermaid
erDiagram
    PLATE {
        string id PK "UUID / CUID"
        string report_type "FOUND (เจอ) | LOST (หา)"
        string vehicle_type "CAR (รถยนต์) | MOTORCYCLE (มอเตอร์ไซค์) | OTHER"
        string plate_prefix "หมวดอักษร เช่น กข, 1กข, 3กก"
        string plate_number "เลขทะเบียน เช่น 1234, 99"
        string province "จังหวัด เช่น เชียงใหม่, กทม"
        string normalized_plate "ข้อความสกัดสำหรับค้นหา เช่น กข1234เชียงใหม่"
        string image_url "URL รูปถ่ายป้ายทะเบียน"
        string contact_name "ชื่อผู้ติดต่อ/ผู้ประสานงาน"
        string contact_phone "เบอร์โทรศัพท์"
        string pickup_location "จุดรับของ หรือ พิกัดที่ทำหล่นหาย"
        float latitude "พิกัดละติจูด (ถ้ามี)"
        float longitude "พิกัดลองจิจูด (ถ้ามี)"
        string status "ACTIVE (รอดำเนินการ) | RETURNED (ส่งมอบแล้ว) | CANCELLED"
        string source "DIRECT (กรอกเอง) | AI_OCR_BATCH | SOCIAL_IMPORT"
        string source_url "URL โพสต์ต้นทาง เช่น Facebook, Twitter/X, ข่าว (Nullable)"
        string source_image_url "URL หรือ Base64 รูปแคปหน้าจอต้นทาง (Nullable)"
        string pin_hash "bcrypt hash ของรหัส PIN 4 หลัก"
        string batch_import_id FK "อ้างอิงชุดการนำเข้า (Nullable)"
        string matched_plate_id FK "อ้างอิงป้ายที่จับคู่ได้ (Nullable)"
        datetime created_at "เวลาที่ลงข้อมูล"
        datetime updated_at "เวลาแก้ไขล่าสุด"
    }

    BATCH_IMPORT {
        string id PK "UUID"
        string source_type "IMAGE_OCR | SOCIAL_POST_TEXT | SOCIAL_POST_IMAGE"
        string source_reference "ลิงก์โพสต์ หรือ คำอธิบายที่มา"
        string raw_content "ข้อความดิบหรือรูปภาพต้นฉบับ"
        int total_extracted "จำนวนป้ายที่สกัดได้"
        int total_approved "จำนวนป้ายที่กดยืนยันบันทึก"
        string created_by "ชื่อผู้นำเข้าข้อมูล"
        datetime created_at "เวลาที่นำเข้า"
    }

    AUDIT_LOG {
        string id PK "UUID"
        string plate_id FK "รหัสป้ายทะเบียน"
        string action "CREATED | STATUS_RETURNED | UPDATED | DELETED"
        string ip_address "IP ผู้ทำรายการ"
        string user_agent "เบราว์เซอร์"
        datetime created_at "เวลาบันทึก"
    }

    BATCH_IMPORT ||--o{ PLATE : "นำเข้าป้ายได้หลายรายการ"
    PLATE ||--o{ AUDIT_LOG : "มีประวัติการเปลี่ยนแปลง"
    PLATE ||--o| PLATE : "จับคู่ระหว่าง FOUND และ LOST"
```

---

## 3. รายละเอียดโครงสร้างตาราง (Table Specifications)

### 3.1 ตาราง `Plate` (ข้อมูลแผ่นป้ายทะเบียน)
| ฟิลด์ | ชนิดข้อมูล | เงื่อนไข | คำอธิบาย |
|---|---|---|---|
| `id` | `String` | PK, Cuid/UUID | รหัสประจำรายการ |
| `reportType` | `Enum/String` | NOT NULL | `FOUND` (เจอ) หรือ `LOST` (ตามหา) |
| `vehicleType` | `Enum/String` | NOT NULL, Default `CAR` | `CAR` (รถยนต์), `MOTORCYCLE` (มอเตอร์ไซค์) |
| `platePrefix` | `String` | NOT NULL | หมวดอักษร เช่น "กข", "1กข" |
| `plateNumber` | `String` | NOT NULL | หมายเลข เช่น "1234", "9" |
| `province` | `String` | NOT NULL | จังหวัด เช่น "เชียงใหม่" |
| `normalizedPlate`| `String` | NOT NULL, INDEX | ข้อความรวมตัดเว้นวรรค เช่น "กข1234เชียงใหม่" |
| `imageUrl` | `String` | NULLABLE | ลิงก์รูปถ่ายป้าย |
| `contactName` | `String` | NOT NULL | ชื่อผู้ประสานงาน / จุดรับ |
| `contactPhone` | `String` | NOT NULL | เบอร์โทรศัพท์ |
| `pickupLocation`| `String` | NOT NULL | สถานที่รับป้าย หรือ สถานที่น้ำท่วมที่ทำหล่น |
| `latitude` | `Float` | NULLABLE | ละติจูดของสถานที่ |
| `longitude` | `Float` | NULLABLE | ลองจิจูดของสถานที่ |
| `status` | `Enum/String` | NOT NULL, Default `ACTIVE` | `ACTIVE` (รอรับ/ตามหา), `RETURNED` (คืนแล้ว), `CANCELLED` |
| `source` | `String` | NOT NULL, Default `DIRECT` | `DIRECT`, `AI_OCR_BATCH`, `SOCIAL_IMPORT` |
| `sourceUrl` | `String` | NULLABLE | ลิงก์โพสต์ต้นทาง (เช่น Facebook, X, ข่าว) |
| `sourceImageUrl` | `String` | NULLABLE | รูปแคปหน้าจอโพสต์/แชทต้นทาง |
| `pinHash` | `String` | NOT NULL | รหัส PIN 4 หลัก เข้ารหัสผ่าน bcrypt/hash |
| `batchImportId`| `String` | NULLABLE, FK | อ้างอิงตาราง BatchImport |
| `matchedPlateId`| `String`| NULLABLE, FK | อ้างอิงป้ายคู่กรณี (เช่น เจอจับคู่กับหา) |
| `createdAt` | `DateTime` | NOT NULL, Default NOW | วันที่เวลาสร้าง |
| `updatedAt` | `DateTime` | NOT NULL, OnUpdate NOW | วันที่เวลาแก้ไข |

---

### 3.2 ตาราง `BatchImport` (ชุดการนำเข้าข้อมูลผ่าน AI)
| ฟิลด์ | ชนิดข้อมูล | เงื่อนไข | คำอธิบาย |
|---|---|---|---|
| `id` | `String` | PK | รหัสการนำเข้า |
| `sourceType` | `String` | NOT NULL | `IMAGE_OCR` หรือ `SOCIAL_TEXT` |
| `sourceReference` | `String` | NULLABLE | ลิงก์โพสต์เฟซบุ๊ก หรือ กลุ่มกู้ภัย |
| `rawContent` | `Text` | NULLABLE | ข้อความต้นฉบับที่นำมาวาง |
| `totalExtracted` | `Int` | NOT NULL | จำนวนป้ายที่ AI อ่านได้ |
| `totalApproved` | `Int` | NOT NULL | จำนวนป้ายที่ผู้ใช้ตรวจสอบแล้วกดบันทึก |
| `createdAt` | `DateTime` | NOT NULL, Default NOW | วันที่นำเข้า |

---

### 3.3 ตาราง `AuditLog` (บันทึกประวัติละเอียด: IP, Browser, OS, Device, Location)
| ฟิลด์ | ชนิดข้อมูล | เงื่อนไข | คำอธิบาย |
|---|---|---|---|
| `id` | `String` | PK | รหัสบันทึก (CUID) |
| `plateId` | `String` | NOT NULL, FK | รหัสป้ายทะเบียนที่ทำรายการ |
| `action` | `String` | NOT NULL | `CREATED`, `BATCH_CREATED`, `STATUS_RETURNED`, `PIN_UPDATED`, `ADMIN_UPDATED`, `DELETED` |
| `ipAddress` | `String` | NULLABLE | Client IP จริง (ดึงจาก X-Forwarded-For, X-Real-IP, Cloudflare, Vercel) |
| `userAgent` | `String` | NULLABLE | User-Agent Header แบบเต็ม |
| `deviceType` | `String` | NULLABLE | ประเภทอุปกรณ์ (`MOBILE`, `TABLET`, `DESKTOP`, `UNKNOWN`) |
| `browser` | `String` | NULLABLE | ชื่อเบราว์เซอร์ (เช่น Google Chrome, Safari, LINE In-App, Facebook In-App) |
| `os` | `String` | NULLABLE | ระบบปฏิบัติการ (เช่น iOS 17.4, Android 14, Windows 10/11, macOS) |
| `city` | `String` | NULLABLE | เมือง/จังหวัด จาก Geo-IP (Vercel / Cloudflare) |
| `country` | `String` | NULLABLE | ประเทศ (เช่น `TH`) |
| `latitude` | `Float` | NULLABLE | ละติจูด (จาก GPS มือถือ หรือ Geo-IP) |
| `longitude` | `Float` | NULLABLE | ลองจิจูด (จาก GPS มือถือ หรือ Geo-IP) |
| `metadata` | `Text/JSON` | NULLABLE | JSON รายละเอียดดิบทั้งหมด (Screen, Languages, Timezone, Full Headers) |
| `createdAt` | `DateTime` | NOT NULL, Default NOW | วันที่และเวลาที่ทำรายการ |

---

## 4. กลยุทธ์การทำดัชนี (Indexing Strategy)
เพื่อประสิทธิภาพสูงสุดในการค้นหาบนสมาร์ทโฟน:
1. `CREATE INDEX idx_plate_normalized ON Plate(normalizedPlate);` -> ใช้สำหรับการค้นหาแบบ Exact และ Prefix
2. `CREATE INDEX idx_plate_search ON Plate(plateNumber, province, vehicleType);` -> ค้นหาแยกตามเลขทะเบียนและจังหวัด
3. `CREATE INDEX idx_plate_status_type ON Plate(reportType, status, createdAt DESC);` -> ฟิลเตอร์หน้าแรก (รายการที่ยังรอเจ้าของ)
