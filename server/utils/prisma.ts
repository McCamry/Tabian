import { PrismaClient } from '@prisma/client'
import path from 'node:path'

// ตรวจสอบและกำหนด Absolute Path ให้กับ SQLite tabian.db เพื่อป้องกันปัญหา Path แตกต่างระหว่าง CLI และ Runtime
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('file:.')) {
  const dbPath = path.resolve(process.cwd(), 'prisma/tabian.db').replace(/\\/g, '/')
  process.env.DATABASE_URL = `file:${dbPath}`
}

let prisma: PrismaClient

declare global {
  var __prisma: PrismaClient | undefined
}

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient()
} else {
  if (!global.__prisma) {
    global.__prisma = new PrismaClient()
  }
  prisma = global.__prisma
}

export { prisma }
