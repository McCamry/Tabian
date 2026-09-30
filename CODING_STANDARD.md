# CODING_STANDARD.md - มาตรฐานการเขียนโค้ดและการจัดระเบียบโปรเจกต์

เพื่อให้โค้ดและการพัฒนาระบบ Tabian มีคุณภาพ ความโปร่งใส และตรงกับความต้องการสูงสุด นักพัฒนาและผู้ร่วมพัฒนาทุกคน (รวมถึง AI Pair Programmer) ต้องปฏิบัติตามมาตรฐานต่อไปนี้:

---

## 0. กฎเหล็กประจำโครงการ (The Golden Rules) ⚠️

> [!IMPORTANT]
> กฎเหล็ก 4 ข้อนี้เป็นระเบียบปฏิบัติสูงสุดของโครงการ ต้องปฏิบัติตามอย่างเคร่งครัดทุกครั้ง:
> 
> 1. **จะแก้อะไร หรือสงสัยอะไร ให้ถามก่อน อย่าเดาเอง (Ask, Never Assume)**
>    - หากพบข้อกำกวม ทางแยกในการออกแบบ หรือมีข้อสงสัยใด ๆ ต้องสอบถามผู้ใช้/ทีมก่อนเสมอ ห้ามตัดสินใจหรือคาดเดาไปเอง
> 2. **เสนอแผนก่อนลงมือทำ (Propose Plan First)**
>    - ต้องแจกแจงขั้นตอน วิธีการ และแผนงานที่จะทำให้อนุมัติก่อนเริ่มลงมือเขียนโค้ดหรือแก้ไขระบบ
> 3. **ทำแล้วต้องตรวจสอบและพิสูจน์ผลลัพธ์จริง (Verify with Real Evidence)**
>    - หลังจากทำแต่ละขั้นตอนแล้ว ต้องรันคำสั่ง ทดสอบจริง และแสดงผลลัพธ์ที่พิสูจน์ได้ว่าทำงานได้ถูกต้องจริง ไม่สรุปเอาเอง
> 4. **อัปเดตเอกสารที่เกี่ยวข้องให้ตรงกันเสมอ (Keep Docs in Sync)**
>    - เมื่อมีฟีเจอร์ใหม่ สถาปัตยกรรมเปลี่ยน หรือ API มีการปรับปรุง ต้องอัปเดตเอกสารที่เกี่ยวข้อง (`API.md`, `ARCHITECTURE.md`, `DATABASE.md`, ฯลฯ) ให้สอดคล้องกับสถานะล่าสุดทันที

---

## 1. การใช้ TypeScript และ Type Safety
- บังคับใช้ **Strict Mode** ใน `tsconfig.json`
- หลีกเลี่ยงการใช้ `any` โดยเด็ดขาด ให้กำหนด Interface หรือ Type ที่ชัดเจนในไดเรกทอรี `types/`
- ตัวอย่าง Type หลัก:
  ```ts
  export type VehicleType = 'CAR' | 'MOTORCYCLE' | 'OTHER';
  export type ReportType = 'FOUND' | 'LOST';
  export type PlateStatus = 'ACTIVE' | 'RETURNED' | 'CANCELLED';

  export interface PlateItem {
    id: string;
    reportType: ReportType;
    vehicleType: VehicleType;
    platePrefix: string;
    plateNumber: string;
    province: string;
    imageUrl?: string;
    contactName: string;
    contactPhone: string;
    pickupLocation: string;
    status: PlateStatus;
    createdAt: string;
  }
  ```

---

## 2. มาตรฐาน Vue 3 Component (`<script setup lang="ts">`)
- ใช้ Single File Component (SFC) ด้วยไวยากรณ์ `<script setup lang="ts">` เสมอ
- การจัดลำดับในไฟล์ `.vue`:
  1. `<script setup lang="ts">`
  2. `<template>`
  3. `<style scoped>` (ถ้ามี โดยเน้นใช้ Tailwind CSS เป็นหลัก)
- ตัวอย่าง Component:
  ```vue
  <script setup lang="ts">
  import type { PlateItem } from '~/types';

  const props = defineProps<{
    plate: PlateItem;
  }>();

  const emit = defineEmits<{
    (e: 'select', id: string): void;
  }>();
  </script>

  <template>
    <div class="p-4 bg-white rounded-2xl shadow-sm border border-slate-100 active:scale-[0.99] transition">
      <!-- Content -->
    </div>
  </template>
  ```

---

## 3. มาตรฐาน Tailwind CSS (Mobile-First)
- ยึดหลัก **Mobile-First**: สไตล์พื้นฐานคือหน้าจอมือถือ (Default) และใช้ Breakpoint เช่น `sm:`, `md:` สำหรับจอแท็บเล็ต/เดสก์ท็อป
- **Touch Target**: ปุ่มกดบนมือถือต้องมีความสูงอย่างน้อย `h-11` (44px) ถึง `h-14` (56px) เพื่อให้แตะด้วยนิ้วได้สะดวก
- **Color System**:
  - สีหลัก (Brand Green/Emerald): ตัวแทนของความปลอดภัยและฝั่ง "เจอ" (เช่น `emerald-600`)
  - สีเตือน/ฝั่ง "หา" (Brand Amber/Rose): ตัวแทนของฝั่ง "หา" และการแจ้งเตือน (เช่น `amber-500`, `rose-500`)
  - สีพื้นหลัง: สะอาด สบายตา (เช่น `slate-50`, `slate-100`)

---

## 4. มาตรฐาน Server Routes (Nitro API)
- วางโค้ด API ไว้ใน `server/api/...`
- ใช้ `defineEventHandler`
- จัดการ Error ด้วย `createError`:
  ```ts
  export default defineEventHandler(async (event) => {
    const body = await readBody(event);
    if (!body.plateNumber) {
      throw createError({
        statusCode: 400,
        statusMessage: 'กรุณาระบุหมายเลขทะเบียน',
      });
    }
    // Logic
  });
  ```
