import { GoogleGenerativeAI, type GenerationConfig, type Part } from '@google/generative-ai'

// Models arranged by priority (Best capability -> Fast & high quota)
export const GEMINI_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-3.8-flash',
]

/**
 * Retrieves all available Gemini API keys from environment
 * Supports comma-separated keys or backup keys
 */
export function getGeminiApiKeys(): string[] {
  const keys: string[] = []

  const primary = (process.env.GEMINI_API_KEY || '').trim()
  const backup = (process.env.GEMINI_API_KEY_BACKUP || '').trim()
  const multiple = (process.env.GEMINI_API_KEYS || '').trim()

  if (multiple) {
    keys.push(...multiple.split(',').map((k) => k.trim()))
  }
  if (primary) {
    keys.push(...primary.split(',').map((k) => k.trim()))
  }
  if (backup) {
    keys.push(...backup.split(',').map((k) => k.trim()))
  }

  // Deduplicate and filter out invalid/empty keys
  return Array.from(new Set(keys)).filter(
    (k) => k && k !== 'your_gemini_api_key_here' && k.length > 10
  )
}

/**
 * Backward compatibility client getter (uses first valid key)
 */
export function getGeminiClient(): GoogleGenerativeAI | null {
  const keys = getGeminiApiKeys()
  if (keys.length === 0) return null
  return new GoogleGenerativeAI(keys[0])
}

export interface GenerateOptions {
  contents: string | Array<string | Part | { inlineData: { data: string; mimeType: string } }>
  generationConfig?: GenerationConfig
}

export interface GenerateResult {
  text: string
  modelUsed: string
}

/**
 * Executes a Gemini request with automatic Multi-Key & Multi-Model Cascade Fallback.
 * If a model or key hits a quota limit (429) or high demand (503), it immediately
 * tries the next model or next key in line with zero downtime for users.
 */
export async function generateWithGeminiFallback(options: GenerateOptions): Promise<GenerateResult> {
  const keys = getGeminiApiKeys()
  if (keys.length === 0) {
    throw new Error('ไม่พบคีย์ GEMINI_API_KEY ในระบบ กรุณาตรวจสอบการตั้งค่า Environment Variables')
  }

  let lastError: any = null

  for (let kIdx = 0; kIdx < keys.length; kIdx++) {
    const key = keys[kIdx]
    const genAI = new GoogleGenerativeAI(key)

    for (const modelName of GEMINI_MODELS) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: options.generationConfig,
        })

        const result = await model.generateContent(options.contents)
        const text = result.response.text()

        if (text && text.trim()) {
          return {
            text: text.trim(),
            modelUsed: `${modelName} (Key #${kIdx + 1})`,
          }
        }
      } catch (err: any) {
        lastError = err
        const isQuotaOrBusy =
          err?.status === 429 ||
          err?.status === 503 ||
          err?.message?.includes('429') ||
          err?.message?.includes('503') ||
          err?.message?.includes('quota') ||
          err?.message?.includes('ResourceExhausted') ||
          err?.message?.includes('high demand')

        console.warn(
          `[Gemini Cascade] Model '${modelName}' on Key #${kIdx + 1} ${
            isQuotaOrBusy ? 'hit quota/busy' : 'failed'
          }: ${err.message?.slice(0, 120)}. Trying next candidate...`
        )
      }
    }
  }

  console.error('[Gemini Cascade] All model candidates and keys exhausted:', lastError)
  throw new Error(
    'ระบบ AI มีผู้ใช้งานจำนวนมากหรือโควต้าชั่วคราวเต็ม กรุณาลองใหม่อีกครั้งในอีกสักครู่ หรือกรอกข้อมูลป้ายทะเบียนด้วยตนเองครับ'
  )
}
