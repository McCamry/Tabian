# DATABASE_GUIDELINE.md - แนวทางปฏิบัติและระเบียบการจัดการฐานข้อมูล

## 1. การเลือกฐานข้อมูล (Database Engine Selection)

ระบบ Tabian รองรับ 2 สภาพแวดล้อม:
1. **SQLite (ค่าเริ่มต้นสำหรับ Local, Demo และการกู้ภัยฉุกเฉิน)**
   - ไฟล์เดียว (`tabian.db`) ไม่ต้องติดตั้งฐานข้อมูลแยก สะดวกต่อการสำรองและย้ายเซิร์ฟเวอร์
   - ต้องเปิดโหมด **WAL (Write-Ahead Logging)** เพื่อรองรับการอ่านและเขียนพร้อมกันหลายคำขอ
2. **PostgreSQL (สำหรับ Production สเกลใหญ่)**
   - แนะนำเมื่อมีผู้ใช้งานพร้อมกันเกิน 500 requests/วินาที หรือใช้ร่วมกับ Supabase / Neon / Cloud SQL

---

## 2. การกำหนดค่า SQLite ในโหมดประสิทธิภาพสูง (WAL Mode)
เมื่อเริ่มต้นระบบบน SQLite ให้รันคำสั่ง PRAGMA ต่อไปนี้เสมอ:
```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;
PRAGMA foreign_keys = ON;
```

---

## 3. กฎการเขียน Query และการค้นหา (Query Guidelines)

### 3.1 การค้นหาป้ายทะเบียน (Plate Search Query)
การค้นหาทะเบียนรถไทยมีความท้าทายเรื่องการเว้นวรรค เช่น "กข 1234", "กข1234", "1234"
- **กฎเหล็ก**: ทุกครั้งที่บันทึกข้อมูล ต้องสร้างคอลัมน์ `normalizedPlate` ด้วยฟังก์ชัน:
  ```ts
  export function normalizePlate(prefix: string, number: string, province: string): string {
    return `${prefix.replace(/\s+/g, '')}${number.replace(/\s+/g, '')}${province.replace(/\s+/g, '')}`.toLowerCase();
  }
  ```
- เวลาค้นหา: ให้ normalize คำค้นหาของผู้ใช้ก่อนนำมาค้นหาด้วย `LIKE '%searchTerm%'` หรือค้นหาแบบเจาะจง `plateNumber = :number`

### 3.2 การทำ Pagination
- ห้ามใช้ `OFFSET` ขนาดใหญ่ในตารางขนาดใหญ่ ให้ใช้ **Cursor-based Pagination** โดยใช้ `createdAt` หรือ `id` เป็น Cursor สำหรับการโหลดแบบ Infinite Scroll บนมือถือ

---

## 4. นโยบายการสำรองและ Migration (Migration Policy)
- การเปลี่ยนแปลง Schema ทุกครั้งต้องทำผ่าน **Prisma Migrate** หรือ **Drizzle Migrations**
- ห้ามแก้ไขไฟล์ฐานข้อมูลจริงโดยตรงใน Production
- ทำ Snapshot ไฟล์ SQLite ก่อนรัน Migration ทุกครั้ง
