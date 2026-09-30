# DEPLOYMENT.md - คู่มือการติดตั้งใช้งานบนเซิร์ฟเวอร์จริง (Production Deployment)

Tabian สามารถ Deploy ขึ้นสู่ Production ได้หลายรูปแบบ ทั้งแบบ Standalone Node.js Server, Docker Container, หรือ Serverless Platform

---

## 1. วิธีที่ 1: Deploy ด้วย Node.js + PM2 บน Linux VPS (แนะนำสำหรับ SQLite)

เหมาะสำหรับเครื่องเซิร์ฟเวอร์ Ubuntu/Debian ทั่วไป:

### ขั้นตอน:
```bash
# 1. ติดตั้ง Node.js 20 และ PM2
sudo apt update && sudo apt install -y curl
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2

# 2. โคลนและบิลด์โค้ด
git clone <repo-url> tabian
cd tabian
npm ci
cp .env.production .env
npx prisma generate
npx prisma db push

# 3. สั่งบิลด์โปรเจกต์ Nuxt 3
npm run build

# 4. สั่งรันด้วย PM2
pm2 start .output/server/index.mjs --name "tabian-app"
pm2 save
pm2 startup
```

---

## 2. วิธีที่ 2: Deploy ด้วย Docker & Docker Compose

### ตัวอย่าง `Dockerfile`:
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
```

### คำสั่งสั่งรัน Docker:
```bash
docker build -t tabian-app .
docker run -d -p 3000:3000 --env-file .env -v tabian_data:/app/prisma tabian-app
```

---

## 3. วิธีที่ 3: Deploy บน Render ด้วย GitHub (แนะนำที่สุดสำหรับ SQLite)

Render รองรับการรัน Node.js Server ต่อเนื่อง พร้อมรองรับ SQLite ไฟล์เดิมได้ทันที 100% ฟรี และมี HTTPS ในตัว:

### ขั้นตอน:
1. **Push โค้ดขึ้น GitHub**:
   ```bash
   git add .
   git commit -m "feat: setup for render deployment"
   git remote add origin https://github.com/<your-username>/<your-repo>.git
   git branch -M main
   git push -u origin main
   ```
2. **สร้าง Web Service บน Render**:
   - ไปที่ [dashboard.render.com](https://dashboard.render.com) แล้วเลือก **New + > Web Service** (หรือเลือก **Blueprint** แล้วเลือกไฟล์ `render.yaml`)
   - เลือก GitHub Repository ของคุณ
   - ตั้งค่า:
     - **Name**: `tabian`
     - **Region**: `Singapore` (ใกล้ไทยที่สุด)
     - **Runtime**: `Node`
     - **Build Command**: `npm install && npm run build`
     - **Start Command**: `npm run start`
   - เพิ่ม **Environment Variables**:
     - `DATABASE_URL`: `file:./dev.db`
     - `GEMINI_API_KEY`: `<ใส่ Google Gemini API Key ของคุณ>`
     - `NODE_VERSION`: `20`
3. **กด Deploy Web Service**:
   - Render จะทำการ Build และออกลิงก์ Public HTTPS ให้ทันที เช่น `https://tabian.onrender.com`
   - เข้าใช้งานจากมือถือได้ทั่วโลกตลอด 24 ชั่วโมง

---

## 4. วิธีที่ 4: Deploy บน Vercel หรือ Netlify (Serverless)
- เมื่อ Deploy บน Serverless Platform แนะนำให้ใช้ฐานข้อมูลแบบ Managed เช่น **Turso (LibSQL/SQLite)**, **Supabase (PostgreSQL)** หรือ **Neon** แทน Local SQLite
- เปลี่ยน `DATABASE_URL` ใน Environment Variables ของ Vercel เป็น Connection String
- สั่งรัน `prisma generate` ใน Build Command:
  ```bash
  npx prisma generate && nuxt build
  ```
---

## 4. การตั้งค่า Nginx Reverse Proxy & SSL (Let's Encrypt)

```nginx
server {
    server_name tabian.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    client_max_body_size 15M;
}
```
เปิดใช้งาน HTTPS ฟรีด้วย Certbot:
```bash
sudo certbot --nginx -d tabian.yourdomain.com
```
