# SETUP.md - คู่มือการติดตั้งและเริ่มต้นพัฒนา (Developer Setup Guide)

คู่มือนี้แนะนำขั้นตอนการติดตั้งและรันระบบ Tabian บนเครื่องคอมพิวเตอร์ของคุณแบบ Step-by-Step

---

## 1. ข้อกำหนดเบื้องต้น (Prerequisites)
- **Node.js**: เวอร์ชัน 18.18.0 หรือ 20.x ขึ้นไป (แนะนำ LTS)
- **Package Manager**: `npm`, `pnpm` หรือ `yarn`
- **Google Gemini API Key**: สามารถขอรับได้ฟรีที่ [Google AI Studio](https://aistudio.google.com/)

---

## 2. ขั้นตอนการติดตั้ง (Installation Steps)

### ขั้นที่ 1: เข้าสู่โฟลเดอร์โปรเจกต์
```bash
cd c:\Users\ASUS\Downloads\Tabian
```

### ขั้นที่ 2: ติดตั้ง Dependencies
```bash
npm install
```

### ขั้นที่ 3: ตั้งค่า Environment Variables
คัดลอกไฟล์ `.env.example` เป็น `.env`
```bash
cp .env.example .env
```
เปิดไฟล์ `.env` แล้วใส่ `GEMINI_API_KEY` ของคุณ:
```env
GEMINI_API_KEY="AIzaSy..."
```

### ขั้นที่ 4: ตั้งค่าฐานข้อมูล (SQLite Database)
สั่งสร้างตารางในฐานข้อมูล SQLite ผ่าน Prisma:
```bash
npx prisma generate
npx prisma db push
```

### ขั้นที่ 5: นำเข้าข้อมูลตัวอย่างสำหรับทดสอบ (Seed Data)
สั่งรันสคริปต์ Seed เพื่อสร้างข้อมูลป้ายทะเบียนจำลอง (ทั้งรถยนต์ มอเตอร์ไซค์ ฝั่งเจอ และฝั่งหา):
```bash
npm run seed
```

---

## 3. การรันเซิร์ฟเวอร์สำหรับพัฒนา (Run Development Server)

```bash
npm run dev
```
ระบบจะเปิดให้บริการที่:
- บนคอมพิวเตอร์: `http://localhost:3000`
- บนโทรศัพท์มือถือในวง Wi-Fi เดียวกัน: `http://<IP-เครื่องคอมพิวเตอร์>:3000` (เช่น `http://192.168.1.45:3000`)

---

## 4. สคริปต์คำสั่งที่สำคัญ (NPM Scripts)

| คำสั่ง | หน้าที่ |
|---|---|
| `npm run dev` | รันเซิร์ฟเวอร์โหมด Development พร้อม Hot Module Replacement |
| `npm run build` | บิลด์โปรเจกต์สำหรับ Production |
| `npm run preview` | ทดสอบรันไฟล์ที่บิลด์แล้วในโหมด Production |
| `npm run prisma:studio` | เปิดหน้าต่าง GUI จัดการฐานข้อมูล Prisma Studio (`http://localhost:5555`) |
| `npm run seed` | ใส่ข้อมูลจำลองสำหรับทดสอบระบบค้นหาและจับคู่ |
