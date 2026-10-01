import type { H3Event } from 'h3'

export interface ClientAuditData {
  ipAddress: string | null
  userAgent: string | null
  deviceType: string
  browser: string
  os: string
  city: string | null
  country: string | null
  latitude: number | null
  longitude: number | null
  metadata: string
}

export function extractClientAudit(event: H3Event, clientPayload?: any): ClientAuditData {
  // 1. IP Address
  const forwardedFor = getHeader(event, 'x-forwarded-for')
  const clientIp =
    (forwardedFor ? forwardedFor.split(',')[0].trim() : null) ||
    getHeader(event, 'x-real-ip') ||
    getHeader(event, 'cf-connecting-ip') ||
    getHeader(event, 'x-vercel-forwarded-for') ||
    getRequestIP(event) ||
    null

  // 2. User-Agent
  const ua = getHeader(event, 'user-agent') || ''

  // Device Type
  let deviceType = 'DESKTOP'
  if (/iPad|Tablet/i.test(ua)) {
    deviceType = 'TABLET'
  } else if (/Mobile|Android|iPhone|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    deviceType = 'MOBILE'
  }

  // Browser Detection
  let browser = 'Unknown Browser'
  if (/Line\//i.test(ua)) {
    browser = 'LINE In-App Browser'
  } else if (/FBAV\/|FBAN\//i.test(ua)) {
    browser = 'Facebook In-App Browser'
  } else if (/Instagram/i.test(ua)) {
    browser = 'Instagram In-App Browser'
  } else if (/TikTok/i.test(ua)) {
    browser = 'TikTok In-App Browser'
  } else if (/Edg\//i.test(ua)) {
    browser = 'Microsoft Edge'
  } else if (/Chrome\/|CriOS\//i.test(ua)) {
    browser = 'Google Chrome'
  } else if (/Firefox\/|FxiOS\//i.test(ua)) {
    browser = 'Mozilla Firefox'
  } else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) {
    browser = 'Apple Safari'
  } else if (/Opera|OPR\//i.test(ua)) {
    browser = 'Opera'
  }

  // OS Detection
  let os = 'Unknown OS'
  if (/iPhone|iPad|iPod/i.test(ua)) {
    const match = ua.match(/OS (\d+[._]\d+)/)
    os = match ? `iOS ${match[1].replace('_', '.')}` : 'iOS'
  } else if (/Android/i.test(ua)) {
    const match = ua.match(/Android (\d+(\.\d+)?)/)
    os = match ? `Android ${match[1]}` : 'Android'
  } else if (/Windows NT 10\.0/i.test(ua)) {
    os = 'Windows 10/11'
  } else if (/Windows/i.test(ua)) {
    os = 'Windows'
  } else if (/Mac OS X/i.test(ua)) {
    const match = ua.match(/Mac OS X (\d+[._]\d+)/)
    os = match ? `macOS ${match[1].replace('_', '.')}` : 'macOS'
  } else if (/Linux/i.test(ua)) {
    os = 'Linux'
  }

  // 3. Location from Edge / Cloud Headers
  const city =
    (getHeader(event, 'x-vercel-ip-city') ? decodeURIComponent(getHeader(event, 'x-vercel-ip-city')!) : null) ||
    getHeader(event, 'cf-ipcity') ||
    null
  const country = getHeader(event, 'x-vercel-ip-country') || getHeader(event, 'cf-ipcountry') || null
  const region = getHeader(event, 'x-vercel-ip-country-region') || null
  const timezone = getHeader(event, 'x-vercel-ip-timezone') || null

  const edgeLat = getHeader(event, 'x-vercel-ip-latitude') ? parseFloat(getHeader(event, 'x-vercel-ip-latitude')!) : null
  const edgeLon = getHeader(event, 'x-vercel-ip-longitude') ? parseFloat(getHeader(event, 'x-vercel-ip-longitude')!) : null

  // 4. Client GPS fallback or priority
  let finalLat: number | null = edgeLat
  let finalLon: number | null = edgeLon

  if (clientPayload?.gps && typeof clientPayload.gps.latitude === 'number' && typeof clientPayload.gps.longitude === 'number') {
    finalLat = clientPayload.gps.latitude
    finalLon = clientPayload.gps.longitude
  }

  // 5. Comprehensive Metadata JSON
  const metadata = JSON.stringify({
    capturedAt: new Date().toISOString(),
    network: {
      clientIp,
      forwardedFor,
      realIp: getHeader(event, 'x-real-ip') || null,
      cfConnectingIp: getHeader(event, 'cf-connecting-ip') || null,
      host: getHeader(event, 'host') || null,
      referer: getHeader(event, 'referer') || null,
    },
    geoIp: {
      city,
      country,
      region,
      timezone,
      latitude: edgeLat,
      longitude: edgeLon,
    },
    deviceHints: {
      secChUa: getHeader(event, 'sec-ch-ua') || null,
      secChUaMobile: getHeader(event, 'sec-ch-ua-mobile') || null,
      secChUaPlatform: getHeader(event, 'sec-ch-ua-platform') || null,
      acceptLanguage: getHeader(event, 'accept-language') || null,
    },
    clientReported: clientPayload || null,
  })

  return {
    ipAddress: clientIp,
    userAgent: ua || null,
    deviceType,
    browser,
    os,
    city,
    country,
    latitude: finalLat,
    longitude: finalLon,
    metadata,
  }
}
