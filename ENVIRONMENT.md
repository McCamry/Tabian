# ENVIRONMENT.md - ตัวแปรสภาพแวดล้อม (Environment Variables)

ไฟล์นี้อธิบายรายการ Configuration และ Environment Variables ที่ใช้ในระบบ Tabian
ให้สร้างไฟล์ `.env` ที่ Root ของโปรเจกต์ตามรูปแบบตัวอย่างด้านล่าง

---

## 1. ตัวอย่างไฟล์ `.env`

```env
# ==========================================
# 1. Server & Application Config
# ==========================================
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000

# ==========================================
# 2. Database Connection
# ==========================================
# สำหรับ SQLite ในเครื่อง / Render (ค่าเริ่มต้น):
DATABASE_URL="file:./tabian.db"

# สำหรับ Vercel Serverless (แนะนำใช้ Turso Cloud SQLite ฟรี):
# TURSO_DATABASE_URL="libsql://your-db-name-your-user.turso.io"
# TURSO_AUTH_TOKEN="your_turso_auth_token"

# สำหรับ PostgreSQL (กรณี Production สเกลใหญ่):
# DATABASE_URL="postgresql://user:password@localhost:5432/tabian?schema=public"

# ==========================================
# 3. Google Gemini AI API (สำหรับ Vision, OCR & Cascade Fallback)
# ==========================================
# รับ API Key ฟรีได้จาก https://aistudio.google.com/
# รองรับการระบุคีย์เดียว หรือหลายคีย์คั่นด้วยจุลภาค (key1,key2) เพื่อสลับคีย์อัตโนมัติเมื่อโควต้าเต็ม
GEMINI_API_KEY=your_gemini_api_key_here
# คีย์สำรอง (ทางเลือก):
# GEMINI_API_KEY_BACKUP=your_backup_gemini_key
# GEMINI_API_KEYS=key1,key2,key3

# ==========================================
# 4. Security & Admin Moderation
# ==========================================
# รหัสผ่านหลักสำหรับผู้ดูแลระบบ เพื่อลบสแปมหรือจัดการข้อมูลฉุกเฉิน
ADMIN_SECRET_KEY=change_this_to_a_secure_admin_key

# ==========================================
# 5. LINE Integration (ทางเลือก / Optional)
# ==========================================
# LIFF ID สำหรับเปิดใช้งานในแอป LINE
LINE_LIFF_ID=

# ==========================================
# 6. File Storage
# ==========================================
UPLOAD_DIR="./public/uploads"
```

---

## 2. รายละเอียดตัวแปรแต่ละตัว

| ตัวแปร | ความจำเป็น | ค่าเริ่มต้น | คำอธิบาย |
|---|---|---|---|
| `DATABASE_URL` | **จำเป็น (Required)** | `file:./tabian.db` | Connection String ไปยังฐานข้อมูล SQLite ในเครื่องหรือ Render |
| `TURSO_DATABASE_URL` | แนะนำสำหรับ Vercel | ไม่มี | Connection URL สำหรับ Turso Cloud SQLite เช่น `libsql://tabian-xxx.turso.io` |
| `TURSO_AUTH_TOKEN` | จำเป็นเมื่อใช้ Turso | ไม่มี | Auth Token สำหรับยืนยันสิทธิ์กับ Turso Cloud Database |
| `GEMINI_API_KEY` | **จำเป็นสำหรับฟังก์ชัน AI** | ไม่มี | คีย์สำหรับเรียกใช้งาน Gemini API (รองรับหลายคีย์คั่นด้วย `,` เพื่อทำ Key Rotation) |
| `GEMINI_API_KEY_BACKUP` | ทางเลือก | ไม่มี | คีย์สำรองที่จะถูกเรียกใช้เมื่อคีย์หลักติดโควต้าเต็ม (429) |
| `APP_URL` | แนะนำสำหรับ Production | `http://localhost:3000` | โดเมนหลักของเว็บ ใช้สร้าง Open Graph Image และ LINE Share Links |
| `ADMIN_SECRET_KEY` | **จำเป็น** | `admin1234` | คีย์ลับสำหรับแอดมินใช้แก้ไขหรือลบข้อมูลที่ไม่เหมาะสม |
| `LINE_LIFF_ID` | ทางเลือก | ว่าง | ID สำหรับการทำงานร่วมกับ LINE Front-end Framework |
| `PORT` | ทางเลือก | `3000` | พอร์ตที่ใช้รันเซิร์ฟเวอร์ |
