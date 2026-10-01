export function normalizePlateQuery(value: string = ''): string {
  return String(value || '')
    .normalize('NFC')
    .replace(/[๐-๙]/g, (c) => String(c.charCodeAt(0) - 3664))
    .replace(/[\s\u200b-\u200d\ufeff\-]/g, '')
    .toLowerCase()
}

export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const curr = [i]
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      )
    }
    prev = curr
  }
  return prev[b.length]
}

export function normalizePlate(prefix: string = '', number: string = '', province: string = ''): string {
  const p = normalizePlateQuery(prefix)
  const n = normalizePlateQuery(number)
  const pr = normalizePlateQuery(province)
  return `${p}${n}${pr}`
}

export function maskPhoneNumber(phone: string): string {
  if (!phone) return ''
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-xxx-${cleaned.slice(6)}`
  } else if (cleaned.length === 9) {
    return `${cleaned.slice(0, 2)}-xxx-${cleaned.slice(5)}`
  }
  return phone.replace(/(\d{3})\d{3,4}(\d{2,4})/, '$1-xxx-$2')
}

