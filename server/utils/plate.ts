export function normalizePlate(prefix: string, number: string, province: string): string {
  return `${prefix.replace(/\s+/g, '')}${number.replace(/\s+/g, '')}${province.replace(/\s+/g, '')}`.toLowerCase()
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
