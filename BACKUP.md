# BACKUP.md - แผนและขั้นตอนการสำรองข้อมูล (Backup & Disaster Recovery)

ข้อมูลป้ายทะเบียนรถที่สูญหายเป็นข้อมูลสำคัญต่อประชาชนและเจ้าของทรัพย์สิน เอกสารนี้ระบุขั้นตอนการสำรองและกู้คืนข้อมูล

---

## 1. การสำรองฐานข้อมูล SQLite (Automated SQLite Backup)

เนื่องจาก SQLite ใช้ไฟล์เดียว สามารถสำรองข้อมูลแบบ Hot-Backup (ไม่ต้องหยุดการทำงานของเว็บ) ผ่านคำสั่ง `sqlite3`:

### สคริปต์สำรองข้อมูลอัตโนมัติ (`backup-sqlite.sh`):
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/tabian"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DB_PATH="/app/prisma/tabian.db"

mkdir -p $BACKUP_DIR

# สำรองข้อมูลแบบปลอดภัยผ่าน Online Backup API
sqlite3 $DB_PATH ".backup '$BACKUP_DIR/tabian_$TIMESTAMP.db'"

# บีบอัดไฟล์
gzip "$BACKUP_DIR/tabian_$TIMESTAMP.db"

# ลบไฟล์สำรองที่เก่าเกิน 14 วัน
find $BACKUP_DIR -type f -name "*.gz" -mtime +14 -exec rm {} \;

echo "Backup completed: tabian_$TIMESTAMP.db.gz"
```

---

## 2. การตั้งเวลาทำงานอัตโนมัติ (Cron Job)
เพิ่มใน `crontab -e` เพื่อสำรองข้อมูลทุก 6 ชั่วโมง:
```cron
0 */6 * * * /app/scripts/backup-sqlite.sh >> /var/log/tabian-backup.log 2>&1
```

---

## 3. การสำรองไฟล์รูปถ่ายป้ายทะเบียน (`/uploads`)
รูปถ่ายป้ายทะเบียนถูกจัดเก็บในโฟลเดอร์ `public/uploads`:
- สามารถใช้ `rsync` หรือ `rclone` เพื่อ Sync ข้อมูลรูปภาพไปยัง Cloud Storage (เช่น Cloudflare R2 หรือ AWS S3) วันละ 1 ครั้ง:
  ```bash
  rclone sync /app/public/uploads r2:tabian-storage/uploads
  ```

---

## 4. ขั้นตอนการกู้คืนข้อมูล (Restore Procedure)
กรณีเกิดเหตุเซิร์ฟเวอร์เสียหาย:
1. หยุดเซอร์วิสแอปพลิเคชัน:
   ```bash
   pm2 stop tabian-app
   ```
2. แตกไฟล์สำรองล่าสุด:
   ```bash
   gunzip -c /var/backups/tabian/tabian_2026xxxx.db.gz > /app/prisma/tabian.db
   ```
3. ตรวจสอบความสมบูรณ์ของฐานข้อมูล:
   ```bash
   sqlite3 /app/prisma/tabian.db "PRAGMA integrity_check;"
   ```
4. เริ่มรันเซอร์วิสใหม่อีกครั้ง:
   ```bash
   pm2 restart tabian-app
   ```
