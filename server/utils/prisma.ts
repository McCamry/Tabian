import { PrismaClient } from '@prisma/client'
import path from 'node:path'
import fs from 'node:fs'

// Ensure SQLite database URL is properly configured and directory exists
const rawUrl = process.env.DATABASE_URL || 'file:./prisma/tabian.db'
if (rawUrl.startsWith('file:')) {
  const filePath = rawUrl.replace(/^file:/, '').replace(/^(\.\/|\.\\)/, '')
  const absoluteDbPath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath)
  const dir = path.dirname(absoluteDbPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  process.env.DATABASE_URL = `file:${absoluteDbPath.replace(/\\/g, '/')}`
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
