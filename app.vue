<script setup lang="ts">
import { ref, reactive, watch, onMounted, nextTick } from 'vue'

interface MatchedPlate {
  id: string
  reportType: string
  contactName: string
  pickupLocation: string
}

interface PlateItem {
  id: string
  reportType: 'FOUND' | 'LOST'
  vehicleType: 'CAR' | 'MOTORCYCLE' | 'OTHER'
  platePrefix: string
  plateNumber: string
  province: string
  imageUrl?: string | null
  sourceUrl?: string | null
  sourceImageUrl?: string | null
  contactName: string
  contactPhone: string
  contactPhoneMasked: string
  pickupLocation: string
  status: 'ACTIVE' | 'RETURNED' | 'CANCELLED'
  source: string
  createdAt: string
  matchedOpposite?: MatchedPlate | null
}

interface StatsData {
  foundCount: number
  lostCount: number
  returnedCount: number
  totalCount: number
}

// ---------------- State ----------------
const route = useRoute()
const targetPlateId = ref<string>('')
const searchQuery = ref('')
const selectedTab = ref<'ALL' | 'FOUND' | 'LOST' | 'RETURNED'>('ALL')
const selectedVehicle = ref<'ALL' | 'CAR' | 'MOTORCYCLE'>('ALL')
const selectedProvince = ref('')
const plates = ref<PlateItem[]>([])
const stats = ref<StatsData>({ foundCount: 0, lostCount: 0, returnedCount: 0, totalCount: 0 })
const provinces = ref<string[]>([])
const isLoading = ref(true)

// Toast
const toastMessage = ref('')
function showToast(msg: string) {
  toastMessage.value = msg
  setTimeout(() => {
    toastMessage.value = ''
  }, 3000)
}

// Modals State
const showCallModal = ref(false)
const selectedPlateToCall = ref<PlateItem | null>(null)
const previewImageUrl = ref<string | null>(null)

const showSingleModal = ref(false)
const showOcrModal = ref(false)
const showSocialModal = ref(false)

// ---------------- Admin State ----------------
const isAdmin = ref(false)
const adminKey = ref('')
const showAdminLoginModal = ref(false)
const adminPasswordInput = ref('')
const adminLoginError = ref('')
const isVerifyingAdmin = ref(false)

// ---------------- Client Info & Geolocation Audit Helper ----------------
const userGpsCoords = ref<{ latitude: number; longitude: number; accuracy?: number } | null>(null)

function requestGpsLocation() {
  if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        userGpsCoords.value = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }
      },
      () => {},
      { timeout: 6000, enableHighAccuracy: false, maximumAge: 300000 }
    )
  }
}

function getClientPayload() {
  if (typeof window === 'undefined') return null
  return {
    screen: {
      width: window.screen?.width || null,
      height: window.screen?.height || null,
      colorDepth: window.screen?.colorDepth || null,
      pixelRatio: window.devicePixelRatio || 1,
    },
    language: navigator.language || null,
    languages: navigator.languages ? [...navigator.languages] : [],
    timezone: Intl.DateTimeFormat ? Intl.DateTimeFormat().resolvedOptions().timeZone : null,
    platform: (navigator as any).userAgentData?.platform || navigator.platform || null,
    online: navigator.onLine,
    gps: userGpsCoords.value || null,
  }
}

// ---------------- PIN-Protected Edit State ----------------
const showPinPromptModal = ref(false)
const plateForPin = ref<PlateItem | null>(null)
const inputPin = ref('')
const isVerifyingPin = ref(false)
const pinError = ref('')
const verifiedPin = ref('')

// ---------------- Plate Edit Modal State (PIN & Admin) ----------------
const showEditModal = ref(false)
const isSubmittingEdit = ref(false)
const editingPlate = ref<PlateItem | null>(null)
const editForm = reactive({
  reportType: 'FOUND' as 'FOUND' | 'LOST',
  vehicleType: 'CAR' as 'CAR' | 'MOTORCYCLE' | 'OTHER',
  platePrefix: '',
  plateNumber: '',
  province: 'ระยอง',
  contactName: '',
  contactPhone: '',
  pickupLocation: '',
  status: 'ACTIVE' as 'ACTIVE' | 'RETURNED' | 'CANCELLED',
  sourceUrl: '',
  pin: '',
})

// ---------------- Admin Delete Modal State ----------------
const showDeleteConfirmModal = ref(false)
const isDeletingPlate = ref(false)
const plateToDelete = ref<PlateItem | null>(null)

// ---------------- Single Entry Form State ----------------
const singleForm = ref({
  reportType: 'FOUND' as 'FOUND' | 'LOST',
  vehicleType: 'CAR' as 'CAR' | 'MOTORCYCLE',
  platePrefix: '',
  plateNumber: '',
  province: 'ระยอง',
  imageUrl: '',
  sourceUrl: '',
  sourceImageUrl: '',
  contactName: '',
  contactPhone: '',
  pickupLocation: '',
  pin: '1234',
})
const isSubmittingSingle = ref(false)
const matchAlertInfo = ref<any>(null)

function openSingleModal(type: 'FOUND' | 'LOST') {
  singleForm.value = {
    reportType: type,
    vehicleType: 'CAR',
    platePrefix: '',
    plateNumber: '',
    province: 'ระยอง',
    imageUrl: '',
    sourceUrl: '',
    sourceImageUrl: '',
    contactName: '',
    contactPhone: '',
    pickupLocation: '',
    pin: '1234',
  }
  matchAlertInfo.value = null
  showSingleModal.value = true
}

// Helper สำหรับบีบอัดรูปภาพด้วย HTML5 Canvas
function compressImage(file: File, callback: (base64: string) => void) {
  const reader = new FileReader()
  reader.onload = (event) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      let width = img.width
      let height = img.height
      const maxDim = 1200

      if (width > height && width > maxDim) {
        height = Math.round((height * maxDim) / width)
        width = maxDim
      } else if (height > maxDim) {
        width = Math.round((width * maxDim) / height)
        height = maxDim
      }

      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx?.drawImage(img, 0, 0, width, height)
      callback(canvas.toDataURL('image/jpeg', 0.8))
    }
    img.src = event.target?.result as string
  }
  reader.readAsDataURL(file)
}

function handleSingleImageUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  compressImage(file, (base64) => {
    singleForm.value.imageUrl = base64
  })
}

function handleScreenshotUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  compressImage(file, (base64) => {
    singleForm.value.sourceImageUrl = base64
  })
}

function handleOcrImageUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  ocrDetectedPlates.value = [] // เคลียร์ผลเก่า
  compressImage(file, (base64) => {
    ocrImage.value = base64
    // เริ่มสแกนด้วย AI อัตโนมัติทันทีที่เลือกรูป!
    runOcrAnalysis()
  })
}

function handleOcrScreenshotUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  compressImage(file, (base64) => {
    ocrShared.value.sourceImageUrl = base64
  })
}

// Submit Single Entry
async function submitSinglePlate() {
  if (!singleForm.value.platePrefix || !singleForm.value.plateNumber) {
    showToast('⚠️ กรุณากรอกหมวดอักษรและเลขทะเบียน')
    return
  }
  if (!singleForm.value.contactName || !singleForm.value.contactPhone || !singleForm.value.pickupLocation) {
    showToast('⚠️ กรุณากรอกชื่อ เบอร์โทร และสถานที่')
    return
  }

  isSubmittingSingle.value = true
  try {
    const res = await $fetch<any>('/api/plates', {
      method: 'POST',
      body: {
        ...singleForm.value,
        clientInfo: getClientPayload(),
      },
    })

    if (res.success) {
      showToast('✅ ' + res.message)
      if (res.matched) {
        matchAlertInfo.value = res.matchedPlates[0]
      } else {
        showSingleModal.value = false
      }
      fetchPlates()
      fetchStats()
    }
  } catch (err: any) {
    showToast('❌ ' + (err.data?.statusMessage || 'เกิดข้อผิดพลาดในการบันทึก'))
  } finally {
    isSubmittingSingle.value = false
  }
}

// ---------------- Multi-Plate AI OCR State ----------------
const ocrImage = ref('')
const isAnalyzingOcr = ref(false)
const isSubmittingOcrBatch = ref(false)
const ocrDetectedPlates = ref<any[]>([])
const ocrShared = ref({
  contactName: '',
  contactPhone: '',
  pickupLocation: '',
  sourceUrl: '',
  sourceImageUrl: '',
  pin: '1234',
})

async function runOcrAnalysis() {
  if (!ocrImage.value) {
    showToast('⚠️ กรุณาเลือกหรือถ่ายภาพก่อน')
    return
  }
  isAnalyzingOcr.value = true
  try {
    const res = await $fetch<any>('/api/ai/ocr-multi', {
      method: 'POST',
      body: { image: ocrImage.value },
    })

    if (res.success) {
      ocrDetectedPlates.value = res.plates
      showToast(`✨ AI สแกนพบ ${res.detectedCount} ป้าย`)
    }
  } catch (err: any) {
    showToast('❌ ' + (err.data?.statusMessage || 'AI ประมวลผลล้มเหลว'))
  } finally {
    isAnalyzingOcr.value = false
  }
}

function addOcrRow() {
  ocrDetectedPlates.value.push({
    vehicleType: 'CAR',
    platePrefix: '',
    plateNumber: '',
    province: 'ระยอง',
  })
}

function removeOcrRow(idx: number) {
  ocrDetectedPlates.value.splice(idx, 1)
}

async function submitOcrBatch() {
  if (ocrDetectedPlates.value.length === 0) {
    showToast('⚠️ ไม่มีรายการป้ายทะเบียนที่จะบันทึก')
    return
  }
  if (!ocrShared.value.contactName || !ocrShared.value.contactPhone || !ocrShared.value.pickupLocation) {
    showToast('⚠️ กรุณาระบุชื่อผู้ประสานงาน เบอร์โทร และจุดรับป้าย')
    return
  }

  isSubmittingOcrBatch.value = true
  try {
    const res = await $fetch<any>('/api/plates/batch', {
      method: 'POST',
      body: {
        plates: ocrDetectedPlates.value,
        sharedInfo: {
          ...ocrShared.value,
          imageUrl: ocrImage.value || null,
          sourceUrl: ocrShared.value.sourceUrl?.trim() || null,
          sourceImageUrl: ocrShared.value.sourceImageUrl || ocrImage.value || null,
        },
        sourceType: 'IMAGE_OCR',
        clientInfo: getClientPayload(),
      },
    })
    if (res.success) {
      showToast('🎉 ' + res.message)
      showOcrModal.value = false
      ocrDetectedPlates.value = []
      ocrImage.value = ''
      ocrShared.value.sourceUrl = ''
      ocrShared.value.sourceImageUrl = ''
      fetchPlates()
      fetchStats()
    }
  } catch (err: any) {
    showToast('❌ ' + (err.data?.statusMessage || 'บันทึกไม่สำเร็จ'))
  } finally {
    isSubmittingOcrBatch.value = false
  }
}

// ---------------- Social Media Importer State ----------------
const socialRawText = ref('')
const socialSourceUrl = ref('')
const socialImageUrl = ref<string | null>(null)
const isFetchingUrl = ref(false)
const fetchUrlWarning = ref('')
const isParsingSocial = ref(false)
const socialParsedData = ref<any>(null)
const isSubmittingSocial = ref(false)

async function autoFetchFromUrl() {
  if (!socialSourceUrl.value.trim()) {
    showToast('⚠️ กรุณาวางลิงก์โพสต์ก่อน')
    return
  }
  isFetchingUrl.value = true
  fetchUrlWarning.value = ''
  try {
    const res = await $fetch<any>('/api/ai/fetch-url', {
      method: 'POST',
      body: { url: socialSourceUrl.value.trim() },
    })

    if (res.blocked) {
      fetchUrlWarning.value = res.message
      showToast('⚠️ เว็บไซต์นี้ติดระบบรักษาความปลอดภัย')
    } else if (res.success) {
      socialRawText.value = res.extractedText || ''
      if (res.extractedImage) {
        socialImageUrl.value = res.extractedImage
      }
      if (res.data && res.data.plates && res.data.plates.length > 0) {
        socialParsedData.value = res.data
        showToast(`✨ ดึงข้อมูลและพบ ${res.data.plates.length} ป้ายทะเบียน!`)
      } else {
        showToast('✅ ดึงเนื้อหาสำเร็จ กรุณาตรวจสอบหรือกดให้ AI สกัดข้อมูล')
      }
    } else {
      fetchUrlWarning.value = res.message || 'ไม่สามารถดึงข้อมูลได้'
      showToast('⚠️ ' + (res.message || 'ไม่พบเนื้อหา'))
    }
  } catch (err: any) {
    fetchUrlWarning.value = 'ไม่สามารถเข้าถึงลิงก์ได้ กรุณาคัดลอกข้อความในโพสต์มาวางแทน'
    showToast('❌ ดึงข้อมูลล้มเหลว')
  } finally {
    isFetchingUrl.value = false
  }
}

async function runSocialParser() {
  if (!socialRawText.value.trim()) {
    showToast('⚠️ กรุณาวางข้อความจากโพสต์ก่อน')
    return
  }
  isParsingSocial.value = true
  try {
    const res = await $fetch<any>('/api/ai/parse-social', {
      method: 'POST',
      body: { rawText: socialRawText.value },
    })
    if (res.success) {
      socialParsedData.value = res.data
      showToast(`✨ สกัดได้ ${res.data.plates.length} ป้ายทะเบียน`)
    }
  } catch (err: any) {
    showToast('❌ ' + (err.data?.statusMessage || 'ไม่สามารถสกัดข้อความได้'))
  } finally {
    isParsingSocial.value = false
  }
}

async function submitSocialBatch() {
  if (!socialParsedData.value || socialParsedData.value.plates.length === 0) return
  isSubmittingSocial.value = true
  try {
    const res = await $fetch<any>('/api/plates/batch', {
      method: 'POST',
      body: {
        plates: socialParsedData.value.plates,
        sharedInfo: {
          contactName: socialParsedData.value.contactName || 'ผู้ประสานงาน',
          contactPhone: socialParsedData.value.contactPhone || '0812345678',
          pickupLocation: socialParsedData.value.pickupLocation || 'จุดรวมป้ายน้ำท่วม',
          sourceUrl: socialSourceUrl.value.trim(),
          sourceImageUrl: socialImageUrl.value || null,
          imageUrl: socialImageUrl.value || null,
          pin: '1234',
        },
        sourceType: 'SOCIAL_POST_TEXT',
        rawContent: socialRawText.value,
        clientInfo: getClientPayload(),
      },
    })
    if (res.success) {
      showToast('🎉 ' + res.message)
      showSocialModal.value = false
      socialRawText.value = ''
      socialSourceUrl.value = ''
      socialImageUrl.value = null
      fetchUrlWarning.value = ''
      socialParsedData.value = null
      fetchPlates()
      fetchStats()
    }
  } catch (err: any) {
    showToast('❌ ' + (err.data?.statusMessage || 'บันทึกไม่สำเร็จ'))
  } finally {
    isSubmittingSocial.value = false
  }
}

// ---------------- Data Fetching ----------------
async function fetchStats() {
  try {
    const res = await $fetch<any>('/api/stats')
    if (res.success) stats.value = res.data
  } catch (err) {
    console.error('Stats error:', err)
  }
}

async function fetchProvinces() {
  try {
    const res = await $fetch<any>('/api/provinces')
    if (res.success) provinces.value = res.data
  } catch (err) {
    console.error('Provinces error:', err)
  }
}

async function fetchPlates() {
  isLoading.value = true
  try {
    const params: Record<string, string> = {}
    if (searchQuery.value.trim()) params.q = searchQuery.value.trim()
    
    // If opened via deep link id and no tab was explicitly switched yet, search ALL statuses to guarantee plate visibility
    if (targetPlateId.value && selectedTab.value === 'ALL') {
      params.status = 'ALL'
    } else if (selectedTab.value === 'FOUND') {
      params.type = 'FOUND'
      params.status = 'ACTIVE'
    } else if (selectedTab.value === 'LOST') {
      params.type = 'LOST'
      params.status = 'ACTIVE'
    } else if (selectedTab.value === 'RETURNED') {
      params.status = 'RETURNED'
    } else {
      params.status = 'ALL'
    }

    if (selectedVehicle.value !== 'ALL') params.vehicle = selectedVehicle.value
    if (selectedProvince.value) params.province = selectedProvince.value

    const res = await $fetch<any>('/api/plates', { params })
    if (res.success) plates.value = res.data
  } catch (err) {
    console.error('Plates error:', err)
  } finally {
    isLoading.value = false
  }
}

let searchTimer: any = null
watch(searchQuery, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(fetchPlates, 250)
})

watch([selectedTab, selectedVehicle, selectedProvince], fetchPlates)

onMounted(async () => {
  // Restore Admin Session if exists
  if (typeof window !== 'undefined') {
    const savedAdminKey = sessionStorage.getItem('tabian_admin_key')
    if (savedAdminKey) {
      adminKey.value = savedAdminKey
      isAdmin.value = true
    }
  }

  // Request GPS location passively for geolocation audit trail
  requestGpsLocation()

  fetchProvinces()
  fetchStats()

  // Deep Link handling from URL query params
  if (route.query.id) {
    targetPlateId.value = String(route.query.id).trim()
  }
  if (route.query.q) {
    searchQuery.value = String(route.query.q).trim()
  }

  await fetchPlates()

  // Auto-scroll to targeted plate card if opened from deep link
  if (targetPlateId.value) {
    await nextTick()
    setTimeout(() => {
      const el = document.getElementById(`plate-${targetPlateId.value}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 350)
  }
})

// Social Sharing Helpers (Always Deep Links to this specific plate in our Web App)
function getShareUrl(plate: PlateItem): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://tabian.app'
  return `${origin}/?id=${encodeURIComponent(plate.id)}&q=${encodeURIComponent(plate.plateNumber)}`
}

function buildShareText(plate: PlateItem): string {
  const isFound = plate.reportType === 'FOUND'
  const actionText = isFound ? 'พบป้ายทะเบียนตกหล่นช่วงน้ำท่วม' : 'ตามหาป้ายทะเบียนรถที่หลุดหาย'
  const vehicleEmoji = plate.vehicleType === 'MOTORCYCLE' ? '🛵' : '🚗'
  const vehicleLabel = plate.vehicleType === 'MOTORCYCLE' ? 'รถจักรยานยนต์' : 'รถยนต์'
  const locLabel = isFound ? 'จุดรับป้าย' : 'พิกัดที่หลุดหาย'
  const deepLinkUrl = getShareUrl(plate)

  return (
    `📢 ${actionText}!\n` +
    `${vehicleEmoji} ทะเบียน: ${plate.platePrefix} ${plate.plateNumber} ${plate.province} (${vehicleLabel})\n` +
    `📍 ${locLabel}: ${plate.pickupLocation}\n` +
    `👤 ติดต่อ: ${plate.contactName}\n` +
    (plate.contactPhone ? `📞 เบอร์โทร: ${plate.contactPhone}\n` : '') +
    (plate.sourceUrl ? `🔗 โพสต์ต้นทางภายนอก: ${plate.sourceUrl}\n` : '') +
    `🔎 ดูข้อมูลป้ายนี้ในระบบ Tabian ได้ที่: ${deepLinkUrl}`
  )
}

function sharePlateToLine(plate: PlateItem) {
  const text = encodeURIComponent(buildShareText(plate))
  window.open(`https://line.me/R/msg/text/?${text}`, '_blank')
}

function sharePlateToFacebook(plate: PlateItem) {
  const url = encodeURIComponent(getShareUrl(plate))
  const quote = encodeURIComponent(buildShareText(plate))
  window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${quote}`, '_blank', 'width=600,height=500')
}

async function sharePlateToTikTok(plate: PlateItem) {
  const text = buildShareText(plate)
  const url = getShareUrl(plate)

  // 1. Try Native Web Share API if available (especially on iOS/Android with TikTok installed)
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title: `ป้ายทะเบียน ${plate.platePrefix} ${plate.plateNumber} ${plate.province}`,
        text: text,
        url: url,
      })
      showToast('🎉 ส่งข้อมูลแชร์เรียบร้อย')
      return
    } catch (err: any) {
      if (err.name === 'AbortError') return
    }
  }

  // 2. Fallback: Copy full plate details to clipboard & open TikTok
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(`${text}\n${url}`)
      showToast('📋 คัดลอกข้อมูลป้ายแล้ว กำลังเปิด TikTok...')
    }
  } catch (err) {
    showToast('🚀 กำลังเปิด TikTok...')
  }

  window.open('https://www.tiktok.com', '_blank')
}

async function copyPlateShareLink(plate: PlateItem) {
  const text = buildShareText(plate)
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      showToast('📋 คัดลอกข้อมูลและลิงก์สำหรับแชร์แล้ว')
    } else {
      const textArea = document.createElement('textarea')
      textArea.value = text
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      showToast('📋 คัดลอกข้อมูลและลิงก์สำหรับแชร์แล้ว')
    }
  } catch (err) {
    showToast('⚠️ ไม่สามารถคัดลอกได้')
  }
}

// ==================== Admin Management Functions ====================
async function submitAdminLogin() {
  const pwd = adminPasswordInput.value.trim()
  if (!pwd) {
    adminLoginError.value = 'กรุณากรอกรหัสผ่านผู้ดูแลระบบ'
    return
  }
  isVerifyingAdmin.value = true
  adminLoginError.value = ''
  try {
    const res = await $fetch<any>('/api/admin/verify', {
      method: 'POST',
      body: { password: pwd },
    })
    if (res.success) {
      adminKey.value = pwd
      isAdmin.value = true
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('tabian_admin_key', pwd)
      }
      showAdminLoginModal.value = false
      adminPasswordInput.value = ''
      showToast('🛡️ เข้าสู่โหมดผู้ดูแลระบบเรียบร้อย')
    }
  } catch (err: any) {
    adminLoginError.value = err.data?.statusMessage || 'รหัสผ่านผู้ดูแลระบบไม่ถูกต้อง'
  } finally {
    isVerifyingAdmin.value = false
  }
}

function logoutAdmin() {
  isAdmin.value = false
  adminKey.value = ''
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('tabian_admin_key')
  }
  showToast('🔒 ออกจากโหมดผู้ดูแลระบบแล้ว')
}

function openPinPrompt(plate: PlateItem) {
  if (isAdmin.value) {
    openEditPlateModal(plate)
    return
  }
  plateForPin.value = plate
  inputPin.value = ''
  pinError.value = ''
  showPinPromptModal.value = true
}

async function verifyPinAndOpenEdit() {
  if (!plateForPin.value) return
  const pin = inputPin.value.trim()
  if (pin.length !== 4) {
    pinError.value = 'กรุณากรอกรหัส PIN 4 หลักให้ครบถ้วน'
    return
  }
  isVerifyingPin.value = true
  pinError.value = ''
  try {
    const res = await $fetch<any>(`/api/plates/${plateForPin.value.id}/verify-pin`, {
      method: 'POST',
      body: { pin },
    })
    if (res.valid) {
      verifiedPin.value = pin
      showPinPromptModal.value = false
      openEditPlateModal(plateForPin.value, pin)
    }
  } catch (err: any) {
    pinError.value = err.data?.statusMessage || 'รหัส PIN ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง'
  } finally {
    isVerifyingPin.value = false
  }
}

function openEditPlateModal(plate: PlateItem, pin?: string) {
  editingPlate.value = plate
  editForm.reportType = plate.reportType
  editForm.vehicleType = plate.vehicleType
  editForm.platePrefix = plate.platePrefix
  editForm.plateNumber = plate.plateNumber
  editForm.province = plate.province
  editForm.contactName = plate.contactName
  editForm.contactPhone = plate.contactPhone
  editForm.pickupLocation = plate.pickupLocation
  editForm.status = plate.status
  editForm.sourceUrl = plate.sourceUrl || ''
  editForm.pin = pin || verifiedPin.value || ''
  showEditModal.value = true
}

async function submitEditPlate() {
  if (!editingPlate.value) return
  isSubmittingEdit.value = true
  try {
    const headers: Record<string, string> = {}
    if (isAdmin.value && adminKey.value) {
      headers['x-admin-key'] = adminKey.value
    }
    const res = await $fetch<any>(`/api/plates/${editingPlate.value.id}`, {
      method: 'PUT',
      headers,
      body: {
        ...editForm,
        pin: editForm.pin || verifiedPin.value,
        clientInfo: getClientPayload(),
      },
    })
    if (res.success) {
      showToast('✅ บันทึกการแก้ไขข้อมูลสำเร็จ')
      showEditModal.value = false
      verifiedPin.value = ''
      await fetchPlates()
      await fetchStats()
    }
  } catch (err: any) {
    showToast('❌ ' + (err.data?.statusMessage || 'แก้ไขข้อมูลไม่สำเร็จ'))
  } finally {
    isSubmittingEdit.value = false
  }
}

function confirmDeletePlate(plate: PlateItem) {
  plateToDelete.value = plate
  showDeleteConfirmModal.value = true
}

async function executeDeletePlate() {
  if (!plateToDelete.value) return
  isDeletingPlate.value = true
  try {
    const res = await $fetch<any>(`/api/plates/${plateToDelete.value.id}`, {
      method: 'DELETE',
      headers: {
        'x-admin-key': adminKey.value,
      },
    })
    if (res.success) {
      showToast('🗑️ ลบรายการป้ายทะเบียนเรียบร้อย')
      showDeleteConfirmModal.value = false
      plateToDelete.value = null
      await fetchPlates()
      await fetchStats()
    }
  } catch (err: any) {
    showToast('❌ ' + (err.data?.statusMessage || 'ลบข้อมูลไม่สำเร็จ'))
  } finally {
    isDeletingPlate.value = false
  }
}

async function quickToggleReturnedStatus(plate: PlateItem) {
  const newStatus = plate.status === 'RETURNED' ? 'ACTIVE' : 'RETURNED'
  try {
    const res = await $fetch<any>(`/api/plates/${plate.id}`, {
      method: 'PUT',
      headers: {
        'x-admin-key': adminKey.value,
      },
      body: {
        status: newStatus,
      },
    })
    if (res.success) {
      showToast(newStatus === 'RETURNED' ? '✅ ทำเครื่องหมายส่งมอบแล้ว' : '🔄 คืนสถานะรอส่งมอบ')
      await fetchPlates()
      await fetchStats()
    }
  } catch (err: any) {
    showToast('❌ ' + (err.data?.statusMessage || 'เปลี่ยนสถานะไม่สำเร็จ'))
  }
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <div class="min-h-screen bg-slate-100 text-slate-800 flex flex-col font-sans pb-28 antialiased">
    <!-- Toast Notification -->
    <div 
      v-if="toastMessage" 
      class="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-white px-5 py-2.5 rounded-full text-xs font-medium shadow-2xl animate-bounce backdrop-blur-xs flex items-center space-x-2"
    >
      <span>{{ toastMessage }}</span>
    </div>

    <!-- Mobile Header -->
    <header class="sticky top-0 z-30 bg-emerald-700 text-white px-4 py-3 shadow-md flex items-center justify-between">
      <div class="flex items-center space-x-2.5">
        <div class="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center font-bold text-xl shadow-inner">
          🚗
        </div>
        <div>
          <div class="flex items-center space-x-1.5">
            <h1 class="text-base font-bold leading-tight">Tabian</h1>
            <span class="text-[10px] bg-emerald-800/80 px-1.5 py-0.5 rounded text-emerald-200">ช่วยภัยน้ำท่วม</span>
          </div>
          <p class="text-[11px] text-emerald-100">ศูนย์รวมแจ้งพบ & ตามหาป้ายทะเบียนรถ</p>
        </div>
      </div>
      <div class="flex items-center space-x-1.5">
        <!-- Admin Mode Toggle / Status Button -->
        <button 
          v-if="!isAdmin"
          @click="showAdminLoginModal = true; adminLoginError = ''" 
          class="px-2.5 py-1.5 rounded-xl bg-emerald-800/80 hover:bg-emerald-900 text-emerald-100 font-medium text-xs flex items-center space-x-1 active:scale-95 transition border border-emerald-600/50"
          title="เข้าสู่ระบบผู้ดูแล (Admin)"
        >
          <span>🔒</span>
          <span>Admin</span>
        </button>
        <button 
          v-else
          @click="logoutAdmin" 
          class="px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold text-xs flex items-center space-x-1 active:scale-95 transition shadow-sm border border-amber-400"
          title="ออกจากโหมด Admin"
        >
          <span>🛡️</span>
          <span>ออก Admin</span>
        </button>

        <button 
          @click="fetchPlates(); fetchStats(); showToast('รีเฟรชข้อมูลล่าสุดแล้ว')" 
          class="p-2 rounded-xl bg-emerald-800/60 hover:bg-emerald-800 text-white active:scale-95 transition"
          title="รีเฟรชข้อมูล"
        >
          🔄
        </button>
      </div>
    </header>

    <!-- Main Container -->
    <main class="flex-1 max-w-md w-full mx-auto px-4 py-3 space-y-3.5">
      <!-- Admin Mode Active Indicator Banner -->
      <div v-if="isAdmin" class="p-2.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 flex items-center justify-between text-xs shadow-xs animate-fade-in">
        <div class="flex items-center space-x-2">
          <span class="text-base">🛡️</span>
          <div>
            <div class="font-bold">โหมดผู้ดูแลระบบ (Admin Active)</div>
            <div class="text-[11px] text-amber-700">สามารถแก้ไขหรือลบรายการป้ายทะเบียนได้ทุกรายการ</div>
          </div>
        </div>
        <button 
          @click="logoutAdmin"
          class="px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-amber-800 hover:bg-amber-100 text-[11px] font-semibold active:scale-95 transition"
        >
          ปิดโหมด
        </button>
      </div>
      <!-- 2 Core Action Buttons (Mobile-First) -->
      <div class="grid grid-cols-2 gap-3 pt-1">
        <button 
          @click="openSingleModal('FOUND')"
          class="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-700 text-white shadow-sm hover:shadow active:scale-[0.98] transition border border-emerald-500"
        >
          <span class="text-3xl mb-1">🟢</span>
          <span class="font-bold text-base">เจอ (พบป้าย)</span>
          <span class="text-[11px] text-emerald-100 mt-0.5">ลงข้อมูลคนเก็บได้</span>
        </button>
        <button 
          @click="openSingleModal('LOST')"
          class="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-sm hover:shadow active:scale-[0.98] transition border border-amber-400"
        >
          <span class="text-3xl mb-1">🔴</span>
          <span class="font-bold text-base">หา (ป้ายหาย)</span>
          <span class="text-[11px] text-amber-100 mt-0.5">เจ้าของลงตามหา</span>
        </button>
      </div>

      <!-- Quick AI Batch Import Actions -->
      <div class="grid grid-cols-2 gap-2 text-xs">
        <button 
          @click="showOcrModal = true"
          class="flex items-center justify-center space-x-1.5 p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs hover:bg-emerald-50 hover:border-emerald-300 font-medium text-slate-700 active:scale-95 transition"
        >
          <span>📸</span>
          <span class="font-bold text-emerald-700">AI สแกนกองป้าย</span>
        </button>
        <button 
          @click="showSocialModal = true"
          class="flex items-center justify-center space-x-1.5 p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs hover:bg-emerald-50 hover:border-emerald-300 font-medium text-slate-700 active:scale-95 transition"
        >
          <span>📋</span>
          <span class="font-bold text-blue-700">นำเข้าจากโซเชียล</span>
        </button>
      </div>

      <!-- Quick Stats Counter -->
      <div class="grid grid-cols-3 gap-2 bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs text-center text-xs">
        <div class="border-r border-slate-100">
          <div class="text-emerald-600 font-bold text-base leading-tight">{{ stats.foundCount }}</div>
          <div class="text-[11px] text-slate-500">🟢 รอส่งมอบ</div>
        </div>
        <div class="border-r border-slate-100">
          <div class="text-amber-500 font-bold text-base leading-tight">{{ stats.lostCount }}</div>
          <div class="text-[11px] text-slate-500">🔴 กำลังตามหา</div>
        </div>
        <div>
          <div class="text-slate-600 font-bold text-base leading-tight">{{ stats.returnedCount }}</div>
          <div class="text-[11px] text-slate-500">⚪ ส่งมอบแล้ว</div>
        </div>
      </div>

      <!-- Search Omnibox -->
      <div class="relative">
        <input 
          v-model="searchQuery"
          type="text" 
          placeholder="🔍 พิมพ์เลขทะเบียน เช่น 1234 หรือ เชียงใหม่..."
          class="w-full pl-4 pr-10 py-3 rounded-xl bg-white border border-slate-200 shadow-xs text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
        />
        <button 
          v-if="searchQuery" 
          @click="searchQuery = ''" 
          class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm p-1"
        >
          ✕
        </button>
      </div>

      <!-- Quick Zone Chips -->
      <div class="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
        <span class="text-slate-600 text-[11px] font-medium shrink-0">จุดน้ำท่วม:</span>
        <button 
          v-for="zone in ['ระยอง', 'ชลบุรี', 'จันทบุรี', 'กรุงเทพ', 'เชียงใหม่', 'แม่สาย']" 
          :key="zone"
          @click="searchQuery = zone"
          class="px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-700 hover:bg-emerald-50 hover:border-emerald-300 shrink-0 active:scale-95 transition"
        >
          {{ zone }}
        </button>
      </div>

      <!-- Status Filter Tabs -->
      <div class="flex space-x-1.5 bg-slate-200/70 p-1 rounded-xl text-xs font-medium">
        <button 
          @click="selectedTab = 'ALL'"
          :class="selectedTab === 'ALL' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'"
          class="flex-1 py-1.5 rounded-lg transition text-center"
        >
          ทั้งหมด
        </button>
        <button 
          @click="selectedTab = 'FOUND'"
          :class="selectedTab === 'FOUND' ? 'bg-emerald-600 text-white shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'"
          class="flex-1 py-1.5 rounded-lg transition text-center"
        >
          🟢 เจอแล้ว
        </button>
        <button 
          @click="selectedTab = 'LOST'"
          :class="selectedTab === 'LOST' ? 'bg-amber-500 text-white shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'"
          class="flex-1 py-1.5 rounded-lg transition text-center"
        >
          🔴 กำลังหา
        </button>
        <button 
          @click="selectedTab = 'RETURNED'"
          :class="selectedTab === 'RETURNED' ? 'bg-slate-700 text-white shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'"
          class="flex-1 py-1.5 rounded-lg transition text-center"
        >
          ⚪ ส่งมอบแล้ว
        </button>
      </div>

      <!-- Vehicle Filter Pills -->
      <div class="flex space-x-2 text-xs">
        <button 
          @click="selectedVehicle = 'ALL'"
          :class="selectedVehicle === 'ALL' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200'"
          class="px-3 py-1 rounded-lg transition"
        >
          ทุกประเภทรถ
        </button>
        <button 
          @click="selectedVehicle = 'CAR'"
          :class="selectedVehicle === 'CAR' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200'"
          class="px-3 py-1 rounded-lg transition"
        >
          🚗 รถยนต์
        </button>
        <button 
          @click="selectedVehicle = 'MOTORCYCLE'"
          :class="selectedVehicle === 'MOTORCYCLE' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200'"
          class="px-3 py-1 rounded-lg transition"
        >
          🛵 มอเตอร์ไซค์
        </button>
      </div>

      <!-- Plates List Section -->
      <div class="space-y-3 pt-1">
        <!-- Loading State -->
        <div v-if="isLoading" class="text-center py-10 space-y-2">
          <div class="inline-block w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
          <p class="text-xs text-slate-500">กำลังค้นหารายการป้ายทะเบียน...</p>
        </div>

        <!-- Empty State -->
        <div v-else-if="plates.length === 0" class="text-center py-12 bg-white rounded-2xl border border-slate-200 p-6 space-y-2">
          <span class="text-4xl">🔍</span>
          <h3 class="font-bold text-slate-700 text-sm">ไม่พบข้อมูลป้ายทะเบียนที่ค้นหา</h3>
          <p class="text-xs text-slate-500">ลองค้นหาด้วยคำอื่น หรือกดปุ่มด้านบนเพื่อลงข้อมูลใหม่</p>
          <button 
            @click="searchQuery = ''; selectedTab = 'ALL'; selectedVehicle = 'ALL'"
            class="mt-2 text-xs text-emerald-600 font-bold underline"
          >
            ล้างตัวกรองทั้งหมด
          </button>
        </div>

        <!-- Plate Cards -->
        <div 
          v-else 
          v-for="plate in plates" 
          :key="plate.id" 
          :id="'plate-' + plate.id"
          class="bg-white rounded-2xl border transition overflow-hidden"
          :class="targetPlateId === plate.id 
            ? 'ring-3 ring-blue-500 border-blue-400 shadow-xl bg-blue-50/15' 
            : 'border-slate-200/90 shadow-2xs hover:border-slate-300'"
        >
          <!-- Deep Link Target Highlight Banner -->
          <div 
            v-if="targetPlateId === plate.id"
            class="bg-blue-600 text-white px-3.5 py-1.5 flex items-center justify-between text-xs font-bold shadow-2xs"
          >
            <div class="flex items-center space-x-1.5">
              <span>🎯</span>
              <span>รายการป้ายทะเบียนที่คุณเปิดจากลิงก์แชร์</span>
            </div>
            <button 
              type="button" 
              @click="targetPlateId = ''" 
              class="text-blue-200 hover:text-white text-xs px-1"
              title="ปิดแถบแจ้งเตือน"
            >
              ✕
            </button>
          </div>

          <!-- Smart Match Banner -->
          <div 
            v-if="plate.matchedOpposite" 
            class="bg-amber-50 border-b border-amber-200 px-3.5 py-1.5 flex items-center justify-between text-xs text-amber-900"
          >
            <div class="flex items-center space-x-1.5">
              <span class="text-sm">⚡</span>
              <span class="font-bold">พบข้อมูลคู่ตรงกันในระบบ!</span>
            </div>
            <span class="text-[11px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded font-semibold">
              {{ plate.matchedOpposite.reportType === 'FOUND' ? 'มีคนเก็บได้แล้ว' : 'มีเจ้าของกำลังหา' }}
            </span>
          </div>

          <div class="p-3.5 space-y-3">
            <!-- Header: Status Badge & Date -->
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-1.5">
                <span 
                  v-if="plate.reportType === 'FOUND'" 
                  class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 flex items-center"
                >
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1"></span>
                  🟢 พบป้ายแล้ว
                </span>
                <span 
                  v-else 
                  class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 flex items-center"
                >
                  <span class="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1"></span>
                  🔴 แจ้งป้ายหาย
                </span>

                <span 
                  v-if="plate.status === 'RETURNED'" 
                  class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200"
                >
                  ส่งมอบเรียบร้อย
                </span>

                <span class="text-[11px] text-slate-500">
                  {{ plate.vehicleType === 'MOTORCYCLE' ? '🛵 มอเตอร์ไซค์' : '🚗 รถยนต์' }}
                </span>
              </div>
              <span class="text-[10px] text-slate-500">{{ formatDate(plate.createdAt) }}</span>
            </div>

            <!-- License Plate Graphic Mockup -->
            <div class="flex justify-center my-1">
              <!-- Car Plate -->
              <div 
                v-if="plate.vehicleType !== 'MOTORCYCLE'"
                class="w-full max-w-[280px] bg-white border-4 border-slate-900 rounded-xl px-4 py-2 shadow-2xs flex flex-col items-center justify-center relative overflow-hidden"
              >
                <div class="absolute left-2.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-slate-300 border border-slate-400"></div>
                <div class="absolute right-2.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-slate-300 border border-slate-400"></div>

                <div class="font-extrabold text-2xl tracking-wider text-slate-900 flex items-baseline space-x-2">
                  <span>{{ plate.platePrefix }}</span>
                  <span>{{ plate.plateNumber }}</span>
                </div>
                <div class="text-[11px] font-semibold text-slate-700 tracking-tight">
                  {{ plate.province }}
                </div>
              </div>

              <!-- Motorcycle Plate -->
              <div 
                v-else
                class="w-40 h-32 bg-white border-4 border-slate-900 rounded-xl p-2 shadow-2xs flex flex-col items-center justify-between text-center relative"
              >
                <div class="absolute left-2 top-2 w-2 h-2 rounded-full bg-slate-300 border border-slate-400"></div>
                <div class="absolute right-2 top-2 w-2 h-2 rounded-full bg-slate-300 border border-slate-400"></div>

                <div class="font-extrabold text-lg text-slate-900 tracking-wide pt-1">
                  {{ plate.platePrefix }}
                </div>
                <div class="text-[10px] font-bold text-slate-700">
                  {{ plate.province }}
                </div>
                <div class="font-extrabold text-2xl text-slate-900 pb-1">
                  {{ plate.plateNumber }}
                </div>
              </div>
            </div>

            <!-- Plate Image (if present) -->
            <div v-if="plate.imageUrl" class="rounded-xl overflow-hidden border border-slate-200 max-h-48 bg-slate-100 flex items-center justify-center">
              <img :src="plate.imageUrl" alt="รูปถ่ายป้ายทะเบียน" class="w-full h-auto object-cover" />
            </div>

            <!-- Location & Contact Info -->
            <div class="space-y-1.5 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <div class="flex items-start text-slate-700">
                <span class="mr-1.5 text-sm shrink-0">📍</span>
                <span class="leading-relaxed">
                  <span class="font-medium text-slate-500">{{ plate.reportType === 'FOUND' ? 'จุดรับป้าย:' : 'จุดที่คาดว่าหลุดหาย:' }}</span>
                  {{ plate.pickupLocation }}
                </span>
              </div>
              <div class="flex items-center text-slate-700">
                <span class="mr-1.5 text-sm shrink-0">👤</span>
                <span class="font-medium text-slate-500 mr-1">ผู้ติดต่อ:</span>
                <span>{{ plate.contactName }}</span>
              </div>
              <div class="flex items-center justify-between pt-1">
                <div class="flex items-center text-slate-700">
                  <span class="mr-1.5 text-sm shrink-0">📞</span>
                  <span class="font-medium text-slate-500 mr-1">เบอร์โทร:</span>
                  <span class="font-mono font-semibold">{{ plate.contactPhoneMasked }}</span>
                </div>
                <button 
                  @click="selectedPlateToCall = plate; showCallModal = true"
                  class="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-xs hover:bg-emerald-100 active:scale-95 transition"
                >
                  แตะเพื่อโทรออก
                </button>
              </div>
            </div>

            <!-- Source Reference (URL or Screenshot) -->
            <div v-if="plate.sourceUrl || plate.sourceImageUrl" class="flex flex-wrap items-center gap-2 pt-1 text-xs">
              <a 
                v-if="plate.sourceUrl" 
                :href="plate.sourceUrl" 
                target="_blank" 
                rel="noopener noreferrer"
                class="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-semibold transition active:scale-95 text-xs shadow-2xs"
              >
                <span>🔗</span>
                <span class="truncate max-w-[190px]">ไปที่โพสต์ต้นทาง</span>
                <span class="text-[10px] opacity-70">↗</span>
              </a>

              <button 
                v-if="plate.sourceImageUrl" 
                @click="previewImageUrl = plate.sourceImageUrl"
                class="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 font-semibold transition active:scale-95 text-xs shadow-2xs"
              >
                <span>📸</span>
                <span>ดูรูปแคปโพสต์</span>
              </button>
            </div>

            <!-- Action Buttons: Multi-Platform Share (LINE, Facebook, TikTok, Copy) -->
            <div class="pt-2 border-t border-slate-100 space-y-1.5">
              <div class="flex items-center justify-between text-[11px] font-medium text-slate-500 px-0.5">
                <span class="flex items-center space-x-1">
                  <span>📢</span>
                  <span>ช่วยแชร์กระจายข่าว:</span>
                </span>
                <button 
                  type="button"
                  @click="copyPlateShareLink(plate)"
                  class="inline-flex items-center space-x-1 text-blue-600 hover:text-blue-800 text-[10px] font-medium active:scale-95 transition"
                  title="คัดลอกข้อความและลิงก์"
                >
                  <span>📋</span>
                  <span>คัดลอกข้อความ</span>
                </button>
              </div>
              <div class="grid grid-cols-3 gap-1.5">
                <!-- LINE -->
                <button 
                  type="button"
                  @click="sharePlateToLine(plate)"
                  class="py-2 px-2 rounded-xl bg-[#06C755] hover:bg-[#05b34c] text-white font-bold text-xs flex items-center justify-center space-x-1 shadow-2xs active:scale-95 transition"
                  title="แชร์เข้า LINE"
                >
                  <span class="text-sm">💬</span>
                  <span>LINE</span>
                </button>

                <!-- Facebook -->
                <button 
                  type="button"
                  @click="sharePlateToFacebook(plate)"
                  class="py-2 px-2 rounded-xl bg-[#1877F2] hover:bg-[#166fe5] text-white font-bold text-xs flex items-center justify-center space-x-1 shadow-2xs active:scale-95 transition"
                  title="แชร์ลง Facebook"
                >
                  <span class="text-sm">📘</span>
                  <span>Facebook</span>
                </button>

                <!-- TikTok -->
                <button 
                  type="button"
                  @click="sharePlateToTikTok(plate)"
                  class="py-2 px-2 rounded-xl bg-[#010101] hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center space-x-1 shadow-2xs active:scale-95 transition border border-slate-900"
                  title="แชร์เข้า TikTok"
                >
                  <span class="text-sm">🎵</span>
                  <span>TikTok</span>
                </button>
              </div>
            </div>

            <!-- Admin Actions Bar (Visible only when Admin Mode is active) -->
            <div 
              v-if="isAdmin" 
              class="pt-2 border-t border-amber-200/80 bg-amber-50/60 -mx-3.5 -mb-3.5 p-3 rounded-b-2xl flex items-center justify-between"
            >
              <div class="flex items-center space-x-1 text-[11px] font-bold text-amber-900">
                <span>🛡️</span>
                <span>จัดการ:</span>
              </div>
              <div class="flex items-center space-x-1.5">
                <button 
                  type="button"
                  @click="quickToggleReturnedStatus(plate)"
                  class="px-2 py-1.5 rounded-lg text-[11px] font-semibold active:scale-95 transition flex items-center space-x-1 shadow-2xs"
                  :class="plate.status === 'RETURNED' ? 'bg-slate-200 hover:bg-slate-300 text-slate-700' : 'bg-emerald-600 hover:bg-emerald-700 text-white'"
                  :title="plate.status === 'RETURNED' ? 'คืนสถานะกำลังตามหา/รอรับ' : 'ทำเครื่องหมายว่าส่งมอบสำเร็จแล้ว'"
                >
                  <span>{{ plate.status === 'RETURNED' ? '🔄 คืนสถานะ' : '✅ ส่งมอบแล้ว' }}</span>
                </button>
                <button 
                  type="button"
                  @click="openEditPlateModal(plate)"
                  class="px-2 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold active:scale-95 transition flex items-center space-x-1 shadow-2xs"
                  title="แก้ไขข้อมูลป้ายนี้"
                >
                  <span>✏️</span>
                  <span>แก้ไข</span>
                </button>
                <button 
                  type="button"
                  @click="confirmDeletePlate(plate)"
                  class="px-2 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-semibold active:scale-95 transition flex items-center space-x-1 shadow-2xs"
                  title="ลบป้ายนี้ออกจากระบบ"
                >
                  <span>🗑️</span>
                  <span>ลบ</span>
                </button>
              </div>
            </div>

            <!-- Owner Action Bar (Visible to regular users when not in Admin Mode) -->
            <div 
              v-else 
              class="pt-2 border-t border-slate-100 -mx-3.5 -mb-3.5 p-2.5 px-3.5 bg-slate-50/70 rounded-b-2xl flex items-center justify-between"
            >
              <div class="flex items-center space-x-1 text-[11px] text-slate-500">
                <span>🔐</span>
                <span>เจ้าของป้าย:</span>
              </div>
              <button 
                type="button"
                @click="openPinPrompt(plate)"
                class="px-2.5 py-1 rounded-lg bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-[11px] font-semibold active:scale-95 transition flex items-center space-x-1 border border-slate-200 shadow-2xs"
                title="ใช้รหัส PIN 4 หลักที่เคยตั้งไว้เพื่อแก้ไขข้อมูลหรือแจ้งส่งมอบแล้ว"
              >
                <span>🔑</span>
                <span>แก้ไขด้วย PIN / ปิดรายการ</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- ==================== Modal 1: ลงข้อมูลป้ายเดี่ยว (เจอ หรือ หา) ==================== -->
    <div 
      v-if="showSingleModal" 
      class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div class="bg-white rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl my-auto animate-fade-in">
        <!-- Modal Header -->
        <div class="flex items-center justify-between border-b border-slate-100 pb-3">
          <div class="flex items-center space-x-2">
            <span class="text-2xl">{{ singleForm.reportType === 'FOUND' ? '🟢' : '🔴' }}</span>
            <div>
              <h3 class="font-bold text-base text-slate-900">
                {{ singleForm.reportType === 'FOUND' ? 'ลงข้อมูลพบป้ายทะเบียน (เจอ)' : 'ลงทะเบียนตามหาป้าย (หา)' }}
              </h3>
              <p class="text-[11px] text-slate-500">กรอกข้อมูลให้ครบเพื่อช่วยจับคู่ป้าย</p>
            </div>
          </div>
          <button @click="showSingleModal = false" class="text-slate-400 hover:text-slate-600 p-1 text-lg">✕</button>
        </div>

        <!-- Match Alert (If matched immediately!) -->
        <div v-if="matchAlertInfo" class="bg-amber-50 border border-amber-300 p-3 rounded-2xl space-y-2 text-xs text-amber-900">
          <div class="font-bold flex items-center text-sm text-amber-800">
            <span class="mr-1">🎉</span> พบป้ายที่ตรงกันทันที!
          </div>
          <p>มีผู้แจ้งข้อมูลป้ายตรงกับของคุณในระบบ: <b>{{ matchAlertInfo.contactName }}</b></p>
          <div class="bg-white p-2 rounded-xl border border-amber-200">
            <div>จุดติดต่อ: {{ matchAlertInfo.pickupLocation }}</div>
            <div class="font-mono font-bold mt-1">เบอร์: {{ matchAlertInfo.contactPhoneMasked }}</div>
          </div>
          <button 
            @click="showSingleModal = false" 
            class="w-full py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs"
          >
            ตกลง ปิดหน้านี้
          </button>
        </div>

        <div v-else class="space-y-3 text-xs">
          <!-- Toggle Vehicle Type -->
          <div>
            <label class="font-medium text-slate-700 block mb-1">ประเภทรถ</label>
            <div class="grid grid-cols-2 gap-2">
              <button 
                type="button"
                @click="singleForm.vehicleType = 'CAR'"
                :class="singleForm.vehicleType === 'CAR' ? 'bg-emerald-600 text-white font-bold' : 'bg-slate-100 text-slate-600'"
                class="py-2 rounded-xl transition"
              >
                🚗 รถยนต์
              </button>
              <button 
                type="button"
                @click="singleForm.vehicleType = 'MOTORCYCLE'"
                :class="singleForm.vehicleType === 'MOTORCYCLE' ? 'bg-emerald-600 text-white font-bold' : 'bg-slate-100 text-slate-600'"
                class="py-2 rounded-xl transition"
              >
                🛵 มอเตอร์ไซค์
              </button>
            </div>
          </div>

          <!-- Plate Prefix & Number -->
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="font-medium text-slate-700 block mb-1">หมวดอักษร</label>
              <input 
                v-model="singleForm.platePrefix" 
                type="text" 
                placeholder="เช่น กข หรือ 1กข" 
                class="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 font-bold"
              />
            </div>
            <div>
              <label class="font-medium text-slate-700 block mb-1">หมายเลขทะเบียน</label>
              <input 
                v-model="singleForm.plateNumber" 
                type="text" 
                placeholder="เช่น 1234 หรือ 9" 
                class="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 font-bold"
              />
            </div>
          </div>

          <!-- Province Selector -->
          <div>
            <label class="font-medium text-slate-700 block mb-1">จังหวัด</label>
            <select 
              v-model="singleForm.province" 
              class="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-emerald-500"
            >
              <option v-for="p in provinces" :key="p" :value="p">{{ p }}</option>
            </select>
          </div>

          <!-- Photo Upload (Optional) -->
          <div>
            <label class="font-medium text-slate-700 block mb-1">รูปถ่ายป้ายทะเบียน (ถ้ามี)</label>
            <input 
              type="file" 
              accept="image/*" 
              @change="handleSingleImageUpload"
              class="w-full text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:bg-emerald-50 file:text-emerald-700"
            />
            <div v-if="singleForm.imageUrl" class="mt-2 w-full h-24 rounded-xl overflow-hidden border border-slate-200">
              <img :src="singleForm.imageUrl" class="w-full h-full object-cover" />
            </div>
          </div>

          <!-- Source Reference (FOUND only) -->
          <div v-if="singleForm.reportType === 'FOUND'" class="p-3 bg-blue-50/70 rounded-2xl border border-blue-200/80 space-y-2.5">
            <div class="flex items-center justify-between">
              <label class="font-bold text-blue-900 flex items-center space-x-1.5 text-xs">
                <span>🌐</span>
                <span>แหล่งที่มา / เบาะแสโซเชียล</span>
              </label>
              <span class="text-[10px] text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full font-medium">ไม่บังคับ</span>
            </div>

            <!-- Source URL -->
            <div>
              <label class="font-medium text-slate-700 block mb-1 text-[11px]">ลิงก์โพสต์ต้นทาง (URL)</label>
              <input 
                v-model="singleForm.sourceUrl" 
                type="url" 
                placeholder="เช่น https://www.facebook.com/... หรือกลุ่มข่าว" 
                class="w-full px-3 py-2 rounded-xl bg-white border border-blue-200 focus:ring-2 focus:ring-blue-500 text-xs"
              />
            </div>

            <!-- Screenshot Upload -->
            <div>
              <label class="font-medium text-slate-700 block mb-1 text-[11px]">รูปแคปหน้าจอโพสต์/แชท (Screenshot)</label>
              <input 
                type="file" 
                accept="image/*" 
                @change="handleScreenshotUpload"
                class="w-full text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-xl file:border-0 file:text-[11px] file:bg-blue-100 file:text-blue-800"
              />
              <div v-if="singleForm.sourceImageUrl" class="mt-2 relative w-full h-24 rounded-xl overflow-hidden border border-blue-300 bg-slate-900">
                <img :src="singleForm.sourceImageUrl" class="w-full h-full object-contain" />
                <button 
                  type="button" 
                  @click="singleForm.sourceImageUrl = ''"
                  class="absolute top-1.5 right-1.5 bg-rose-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shadow"
                  title="ลบรูปแคป"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>

          <!-- Contact Name & Phone -->
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="font-medium text-slate-700 block mb-1">ชื่อผู้ติดต่อ</label>
              <input 
                v-model="singleForm.contactName" 
                type="text" 
                placeholder="เช่น คุณวิชัย (กู้ภัย)" 
                class="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label class="font-medium text-slate-700 block mb-1">เบอร์โทรศัพท์</label>
              <input 
                v-model="singleForm.contactPhone" 
                type="tel" 
                placeholder="0812345678" 
                class="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 font-mono"
              />
            </div>
          </div>

          <!-- Pickup Location -->
          <div>
            <label class="font-medium text-slate-700 block mb-1">
              {{ singleForm.reportType === 'FOUND' ? 'สถานที่รับป้าย (จุดส่งมอบ)' : 'จุดที่ลุยน้ำแล้วหลุดหาย' }}
            </label>
            <input 
              v-model="singleForm.pickupLocation" 
              type="text" 
              placeholder="เช่น ป้อมตำรวจแยกดอยเขาควาย แม่สาย" 
              class="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <!-- PIN 4 Digits -->
          <div>
            <label class="font-medium text-slate-700 block mb-1">รหัส PIN 4 หลัก (สำหรับกลับมาแก้ไข/ปิดสถานะ)</label>
            <input 
              v-model="singleForm.pin" 
              type="password" 
              maxlength="4" 
              placeholder="1234" 
              class="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 font-mono tracking-widest text-center"
            />
          </div>

          <!-- Submit Button -->
          <button 
            @click="submitSinglePlate" 
            :disabled="isSubmittingSingle"
            class="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md active:scale-[0.98] transition flex items-center justify-center space-x-2"
          >
            <span v-if="isSubmittingSingle" class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            <span>ยืนยันบันทึกข้อมูล</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ==================== Modal 2: AI สแกนกองป้ายทะเบียน (Multi-Plate Batch OCR) ==================== -->
    <div 
      v-if="showOcrModal" 
      class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div class="bg-white rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl my-auto animate-fade-in">
        <div class="flex items-center justify-between border-b border-slate-100 pb-3">
          <div class="flex items-center space-x-2">
            <span class="text-2xl">📸</span>
            <div>
              <h3 class="font-bold text-base text-slate-900">AI สแกนกองป้ายทะเบียน</h3>
              <p class="text-[11px] text-slate-500">ถ่ายรูปเดียว สกัดหลายสิบป้ายด้วย Gemini</p>
            </div>
          </div>
          <button @click="showOcrModal = false" class="text-slate-400 hover:text-slate-600 p-1 text-lg">✕</button>
        </div>

        <div class="space-y-3 text-xs">
          <!-- Step 1: Upload Photo -->
          <div>
            <label class="font-medium text-slate-700 block mb-1">เลือกภาพถ่ายกองป้ายทะเบียน (5 - 30 แผ่น)</label>
            <input 
              type="file" 
              accept="image/*" 
              @change="handleOcrImageUpload"
              class="w-full text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:bg-emerald-50 file:text-emerald-700 font-medium"
            />
            <div v-if="ocrImage" class="mt-2.5 w-full h-36 rounded-2xl overflow-hidden border-2 border-emerald-400/60 shadow-xs relative bg-slate-900">
              <img :src="ocrImage" class="w-full h-full object-contain" />
              <div class="absolute top-2 right-2 bg-emerald-600/90 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                ✓ โหลดภาพแล้ว
              </div>
            </div>
          </div>

          <!-- Loading State for OCR -->
          <div v-if="isAnalyzingOcr" class="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-300 flex items-center space-x-3 text-emerald-900 animate-pulse">
            <span class="inline-block w-6 h-6 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin shrink-0"></span>
            <div>
              <div class="font-bold text-xs">กำลังให้ Gemini 2.5 Flash อ่านป้ายทะเบียน...</div>
              <div class="text-[10px] text-emerald-700">กำลังแยกหมวดอักษร ตัวเลข และจังหวัดในภาพ</div>
            </div>
          </div>

          <!-- Manual Scan Button if not auto-started -->
          <button 
            v-if="ocrImage && !isAnalyzingOcr && ocrDetectedPlates.length === 0"
            @click="runOcrAnalysis" 
            class="w-full py-3 rounded-2xl bg-emerald-600 text-white font-bold shadow-md hover:bg-emerald-700 flex items-center justify-center space-x-2 active:scale-98 transition"
          >
            <span>🔍 ให้ AI เริ่มสแกนป้ายทั้งหมด</span>
          </button>

          <!-- Step 2: Review Table -->
          <div v-if="ocrDetectedPlates.length > 0" class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="font-bold text-slate-800">รายการป้ายที่ตรวจพบ ({{ ocrDetectedPlates.length }} แผ่น)</span>
              <div class="flex items-center space-x-2">
                <button @click="runOcrAnalysis" :disabled="isAnalyzingOcr" class="text-emerald-700 font-bold text-[11px] underline">
                  🔄 สแกนใหม่
                </button>
                <button @click="addOcrRow" class="text-emerald-600 font-bold text-[11px] bg-emerald-50 px-2 py-1 rounded-lg">
                  + เพิ่มแถว
                </button>
              </div>
            </div>

            <div class="max-h-48 overflow-y-auto space-y-1.5 border border-slate-200 rounded-xl p-2 bg-slate-50">
              <div 
                v-for="(p, idx) in ocrDetectedPlates" 
                :key="idx" 
                class="flex items-center space-x-1 bg-white p-1.5 rounded-lg border border-slate-200"
              >
                <select v-model="p.vehicleType" class="px-1 py-1 rounded bg-slate-100 text-[10px]">
                  <option value="CAR">รถยนต์</option>
                  <option value="MOTORCYCLE">มอเตอร์ไซค์</option>
                </select>
                <input v-model="p.platePrefix" placeholder="หมวด" class="w-14 px-1.5 py-1 border rounded text-center font-bold" />
                <input v-model="p.plateNumber" placeholder="เลข" class="w-16 px-1.5 py-1 border rounded text-center font-bold" />
                <input v-model="p.province" placeholder="จังหวัด" class="flex-1 px-1.5 py-1 border rounded text-[11px]" />
                <button @click="removeOcrRow(idx)" class="text-rose-500 px-1 font-bold">✕</button>
              </div>
            </div>

            <!-- Shared Contact Info -->
            <div class="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 space-y-2">
              <div class="font-bold text-emerald-900 text-[11px]">ข้อมูลจุดรับร่วมกันทุกป้าย:</div>
              <input v-model="ocrShared.pickupLocation" placeholder="สถานที่รับป้าย (เช่น ป้อมกู้ภัยแม่สาย)" class="w-full px-2.5 py-1.5 bg-white border border-emerald-300 rounded-lg" />
              <div class="grid grid-cols-2 gap-2">
                <input v-model="ocrShared.contactName" placeholder="ชื่อผู้ติดต่อ" class="px-2.5 py-1.5 bg-white border border-emerald-300 rounded-lg" />
                <input v-model="ocrShared.contactPhone" placeholder="เบอร์โทร" class="px-2.5 py-1.5 bg-white border border-emerald-300 rounded-lg font-mono" />
              </div>
            </div>

            <!-- Source Reference for AI OCR (Optional) -->
            <div class="p-2.5 bg-blue-50/80 rounded-xl border border-blue-200 space-y-2">
              <div class="flex items-center justify-between">
                <div class="font-bold text-blue-900 text-[11px] flex items-center space-x-1">
                  <span>🌐</span>
                  <span>แหล่งที่มา / เบาะแสต้นทาง</span>
                </div>
                <span class="text-[10px] text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded font-medium">ไม่บังคับ</span>
              </div>

              <!-- Source URL -->
              <div>
                <label class="font-medium text-slate-700 block mb-0.5 text-[10px]">🔗 ลิงก์โพสต์ต้นทาง (URL)</label>
                <input 
                  v-model="ocrShared.sourceUrl" 
                  type="url" 
                  placeholder="เช่น https://www.facebook.com/... หรือกลุ่มกู้ภัย" 
                  class="w-full px-2.5 py-1.5 bg-white border border-blue-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500" 
                />
              </div>

              <!-- Screenshot Upload (Optional) -->
              <div>
                <label class="font-medium text-slate-700 block mb-0.5 text-[10px]">📸 รูปแคปหน้าจอโพสต์ (ถ้าไม่ใส่ จะใช้รูปกองป้ายที่สแกนเป็นรูปหลักฐาน)</label>
                <input 
                  type="file" 
                  accept="image/*" 
                  @change="handleOcrScreenshotUpload"
                  class="w-full text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-[10px] file:bg-blue-100 file:text-blue-800"
                />
                <div v-if="ocrShared.sourceImageUrl" class="mt-1.5 relative w-full h-20 rounded-lg overflow-hidden border border-blue-300 bg-slate-900">
                  <img :src="ocrShared.sourceImageUrl" class="w-full h-full object-contain" />
                  <button 
                    type="button" 
                    @click="ocrShared.sourceImageUrl = ''"
                    class="absolute top-1 right-1 bg-rose-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold shadow"
                    title="ลบรูปแคป"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>

            <button 
              @click="submitOcrBatch" 
              :disabled="isSubmittingOcrBatch"
              class="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md"
            >
              <span v-if="isSubmittingOcrBatch" class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1"></span>
              ยืนยันบันทึกทั้ง {{ ocrDetectedPlates.length }} ป้าย
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== Modal 3: นำเข้าจาก Social Media (Smart Paste) ==================== -->
    <div 
      v-if="showSocialModal" 
      class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div class="bg-white rounded-3xl max-w-lg w-full p-5 space-y-4 shadow-2xl my-auto animate-fade-in">
        <div class="flex items-center justify-between border-b border-slate-100 pb-3">
          <div class="flex items-center space-x-2">
            <span class="text-2xl">📋</span>
            <div>
              <h3 class="font-bold text-base text-slate-900">นำเข้าจากโพสต์โซเชียล & คอมเมนต์</h3>
              <p class="text-[11px] text-slate-500">วางลิงก์ หรือคัดลอกโพสต์และคอมเมนต์มาวางให้ AI สกัดป้าย</p>
            </div>
          </div>
          <button @click="showSocialModal = false" class="text-slate-400 hover:text-slate-600 p-1 text-lg">✕</button>
        </div>

        <div class="space-y-3 text-xs">
          <!-- Option A: Smart URL Auto-Fetch -->
          <div class="p-3 bg-blue-50/70 rounded-2xl border border-blue-200/80 space-y-2">
            <div class="flex items-center justify-between">
              <label class="font-bold text-blue-900 text-[11px] flex items-center space-x-1">
                <span>🔗</span>
                <span>วางลิงก์โพสต์ (ดึงเนื้อหา, คอมเมนต์ และรูปอัตโนมัติ)</span>
              </label>
              <span class="text-[10px] text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded font-medium">เว็บข่าว / เพจสาธารณะ</span>
            </div>

            <div class="flex space-x-1.5">
              <input 
                v-model="socialSourceUrl" 
                type="url" 
                placeholder="https://... วางลิงก์โพสต์ที่นี่" 
                class="flex-1 px-3 py-2 rounded-xl bg-white border border-blue-200 focus:ring-2 focus:ring-blue-500 text-xs"
              />
              <button 
                @click="autoFetchFromUrl" 
                :disabled="isFetchingUrl"
                class="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center space-x-1 shrink-0 active:scale-95 transition shadow-2xs"
              >
                <span v-if="isFetchingUrl" class="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <span>{{ isFetchingUrl ? 'กำลังอ่าน...' : '🌐 ดึงข้อมูล' }}</span>
              </button>
            </div>

            <!-- Warning if platform blocks bot/crawler -->
            <div v-if="fetchUrlWarning" class="p-2.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-[11px] space-y-1 animate-fade-in">
              <div class="font-bold flex items-center space-x-1">
                <span>⚠️</span>
                <span>แจ้งเตือนการเข้าถึงลิงก์:</span>
              </div>
              <p class="leading-relaxed">{{ fetchUrlWarning }}</p>
            </div>

            <!-- Preview Image if fetched -->
            <div v-if="socialImageUrl" class="relative w-full h-24 rounded-xl overflow-hidden border border-blue-300 bg-slate-900 mt-1.5">
              <img :src="socialImageUrl" class="w-full h-full object-contain" />
              <div class="absolute top-1.5 left-1.5 bg-blue-700/90 text-white text-[9px] px-2 py-0.5 rounded-full font-bold">
                ✓ ดึงรูปภาพจากโพสต์แล้ว
              </div>
              <button 
                type="button" 
                @click="socialImageUrl = null"
                class="absolute top-1.5 right-1.5 bg-rose-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold shadow"
                title="ลบรูป"
              >
                ✕
              </button>
            </div>
          </div>

          <!-- Divider -->
          <div class="flex items-center my-2 text-[10px] text-slate-400">
            <div class="flex-1 border-t border-slate-200"></div>
            <span class="px-2 font-medium">หรือ คัดลอกเนื้อหาโพสต์และคอมเมนต์มาวาง</span>
            <div class="flex-1 border-t border-slate-200"></div>
          </div>

          <!-- Option B: Paste Raw Text -->
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="font-medium text-slate-700">เนื้อหาโพสต์และคอมเมนต์ทั้งหมด:</label>
              <span class="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-medium">แนะนำสำหรับ Facebook / LINE</span>
            </div>
            <textarea 
              v-model="socialRawText" 
              rows="5" 
              placeholder="💡 สามารถคัดลอกทั้งเนื้อหาโพสต์ และข้อความในคอมเมนต์ทั้งหมดมาวางรวมกันได้เลย AI จะช่วยแยกป้ายและผู้ติดต่อของแต่ละคอมเมนต์ให้เองอัตโนมัติ

ตัวอย่าง:
โพสต์หลัก: เจอทะเบียนแถวหน้าตลาดน้ำท่วม ติดต่อ สมชาย 081-111-xxxx
คอมเมนต์ 1: มีคนเก็บป้าย กข 1234 ระยอง ได้ที่ซอย 2 โทรหาพี่นพ 089-xxx
คอมเมนต์ 2: ทะเบียน 2ขข 5678 ชลบุรี อยู่ที่ป้อมยามนะครับ" 
              class="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 font-sans text-xs leading-relaxed"
            ></textarea>
            <p class="text-[10px] text-slate-500 mt-1">
              ✨ รองรับการก๊อปปี้คอมเมนต์หลายๆ อันมาวางพร้อมกันได้เลย ระบบจะจับคู่เบอร์โทรและจุดรับของแต่ละคอมเมนต์ให้อัตโนมัติ
            </p>
          </div>

          <button 
            @click="runSocialParser" 
            :disabled="isParsingSocial || isFetchingUrl"
            class="w-full py-2.5 rounded-xl bg-blue-600 text-white font-bold shadow-xs hover:bg-blue-700 flex items-center justify-center space-x-1.5 active:scale-95 transition"
          >
            <span v-if="isParsingSocial" class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            <span>🧠 ให้ AI สกัดข้อมูลโพสต์ & คอมเมนต์</span>
          </button>

          <!-- Result Preview -->
          <div v-if="socialParsedData" class="space-y-2 pt-1 border-t border-slate-100">
            <div class="p-2.5 bg-blue-50/80 rounded-xl border border-blue-200 text-xs space-y-1">
              <div class="text-[10px] font-bold text-blue-800 uppercase tracking-wide">ข้อมูลเริ่มต้น (โพสต์หลัก)</div>
              <div>📍 จุดรับหลัก: <b>{{ socialParsedData.pickupLocation }}</b></div>
              <div>👤 ผู้ติดต่อหลัก: <b>{{ socialParsedData.contactName }}</b> ({{ socialParsedData.contactPhone }})</div>
            </div>

            <div class="flex items-center justify-between text-xs font-bold text-slate-700 pt-1">
              <span>รายการป้ายที่ตรวจพบ ({{ socialParsedData.plates.length }} ป้าย):</span>
            </div>

            <div class="max-h-48 overflow-y-auto space-y-2 pr-1">
              <div 
                v-for="(p, i) in socialParsedData.plates" 
                :key="i"
                class="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5 shadow-2xs"
              >
                <div class="flex items-center justify-between">
                  <span class="font-bold text-slate-900 text-sm tracking-wide">{{ p.platePrefix }} {{ p.plateNumber }} {{ p.province }}</span>
                  <span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-semibold">
                    {{ p.vehicleType === 'MOTORCYCLE' ? '🛵 มอเตอร์ไซค์' : '🚗 รถยนต์' }}
                  </span>
                </div>
                
                <!-- Per-plate contact details (e.g. from specific comment) -->
                <div v-if="p.contactName || p.contactPhone || p.pickupLocation" class="text-[11px] text-slate-600 bg-white p-2 rounded-lg border border-slate-200/60 space-y-0.5">
                  <div v-if="p.contactName || p.contactPhone" class="flex items-center space-x-1.5">
                    <span>👤</span>
                    <span class="font-semibold text-slate-800">{{ p.contactName || socialParsedData.contactName }}</span>
                    <span v-if="p.contactPhone" class="text-blue-700 font-medium">({{ p.contactPhone }})</span>
                  </div>
                  <div v-if="p.pickupLocation" class="flex items-center space-x-1.5 text-slate-600">
                    <span>📍</span>
                    <span>{{ p.pickupLocation }}</span>
                  </div>
                </div>
              </div>
            </div>

            <button 
              @click="submitSocialBatch" 
              :disabled="isSubmittingSocial"
              class="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md flex items-center justify-center space-x-1.5 active:scale-95 transition"
            >
              <span v-if="isSubmittingSocial" class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              <span>ยืนยันบันทึกทั้ง {{ socialParsedData.plates.length }} รายการ</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== Modal: Call Confirmation ==================== -->
    <div 
      v-if="showCallModal && selectedPlateToCall" 
      class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
    >
      <div class="bg-white rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-xl text-center">
        <div class="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-2xl mx-auto">
          📞
        </div>
        <div>
          <h3 class="font-bold text-base text-slate-900">ติดต่อรับป้ายทะเบียน</h3>
          <p class="text-xs text-slate-500 mt-1">
            {{ selectedPlateToCall.platePrefix }} {{ selectedPlateToCall.plateNumber }} {{ selectedPlateToCall.province }}
          </p>
        </div>

        <div class="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1 text-xs">
          <div class="text-slate-500">ผู้ประสานงาน: <b class="text-slate-800">{{ selectedPlateToCall.contactName }}</b></div>
          <div class="text-slate-500">จุดรับ: <span class="text-slate-800">{{ selectedPlateToCall.pickupLocation }}</span></div>
          <div class="text-base font-bold font-mono text-emerald-700 pt-1">
            {{ selectedPlateToCall.contactPhone }}
          </div>
        </div>

        <div class="flex space-x-2">
          <button 
            @click="showCallModal = false"
            class="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-xs"
          >
            ยกเลิก
          </button>
          <a 
            :href="'tel:' + selectedPlateToCall.contactPhone"
            class="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs flex items-center justify-center space-x-1 shadow-sm hover:bg-emerald-700"
          >
            <span>📞 โทรออก</span>
          </a>
        </div>
      </div>
    </div>

    <!-- ==================== Modal: Image Preview ==================== -->
    <div 
      v-if="previewImageUrl" 
      class="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
      @click="previewImageUrl = null"
    >
      <div class="relative max-w-lg w-full bg-white rounded-3xl overflow-hidden shadow-2xl p-4 my-auto" @click.stop>
        <div class="flex justify-between items-center pb-2.5 border-b border-slate-100 mb-3">
          <div class="flex items-center space-x-1.5 font-bold text-slate-800 text-sm">
            <span>📸</span>
            <span>รูปภาพแคปหน้าจอต้นทาง</span>
          </div>
          <button @click="previewImageUrl = null" class="text-slate-400 hover:text-slate-600 font-bold text-lg p-1">✕</button>
        </div>
        <div class="max-h-[75vh] overflow-auto flex items-center justify-center bg-slate-900 rounded-2xl p-1">
          <img :src="previewImageUrl" class="max-w-full max-h-[70vh] object-contain rounded-xl" />
        </div>
      </div>
    </div>

    <!-- ==================== Modal: เข้าสู่โหมดผู้ดูแล (Admin Login) ==================== -->
    <div 
      v-if="showAdminLoginModal" 
      class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
      @click="showAdminLoginModal = false"
    >
      <div class="bg-white rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl my-auto animate-scale-up" @click.stop>
        <div class="flex items-center justify-between border-b border-slate-100 pb-3">
          <div class="flex items-center space-x-2">
            <span class="text-2xl">🔒</span>
            <div>
              <h3 class="font-bold text-base text-slate-900">เข้าสู่ระบบผู้ดูแล (Admin)</h3>
              <p class="text-[11px] text-slate-500">สำหรับเจ้าหน้าที่จัดการและแก้ไขข้อมูล</p>
            </div>
          </div>
          <button @click="showAdminLoginModal = false" class="text-slate-400 hover:text-slate-600 p-1 text-lg">✕</button>
        </div>

        <form @submit.prevent="submitAdminLogin" class="space-y-3.5 text-xs">
          <div>
            <label class="font-semibold text-slate-700 block mb-1">รหัสผ่านผู้ดูแลระบบ (Admin Secret Key)</label>
            <input 
              v-model="adminPasswordInput"
              type="password"
              placeholder="กรอกรหัสผ่านผู้ดูแลระบบ..."
              class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm font-mono"
              autofocus
            />
          </div>

          <div v-if="adminLoginError" class="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-1.5">
            <span>⚠️</span>
            <span>{{ adminLoginError }}</span>
          </div>

          <div class="flex space-x-2 pt-1">
            <button 
              type="button" 
              @click="showAdminLoginModal = false"
              class="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition"
            >
              ยกเลิก
            </button>
            <button 
              type="submit" 
              :disabled="isVerifyingAdmin"
              class="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition flex items-center justify-center space-x-1 shadow-sm"
            >
              <span v-if="isVerifyingAdmin" class="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              <span>{{ isVerifyingAdmin ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- ==================== Modal: ยืนยันรหัส PIN 4 หลักเพื่อแก้ไขข้อมูล ==================== -->
    <div 
      v-if="showPinPromptModal && plateForPin" 
      class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
      @click="showPinPromptModal = false"
    >
      <div class="bg-white rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl my-auto animate-scale-up" @click.stop>
        <div class="flex items-center justify-between border-b border-slate-100 pb-3">
          <div class="flex items-center space-x-2">
            <span class="text-2xl">🔐</span>
            <div>
              <h3 class="font-bold text-base text-slate-900">ยืนยันความเป็นเจ้าของ</h3>
              <p class="text-[11px] text-slate-500">
                ป้าย {{ plateForPin.platePrefix }} {{ plateForPin.plateNumber }} {{ plateForPin.province }}
              </p>
            </div>
          </div>
          <button @click="showPinPromptModal = false" class="text-slate-400 hover:text-slate-600 p-1 text-lg">✕</button>
        </div>

        <form @submit.prevent="verifyPinAndOpenEdit" class="space-y-4 text-xs">
          <div>
            <label class="block font-semibold text-slate-700 mb-1.5">
              กรอกรหัส PIN 4 หลัก (ที่ตั้งไว้ตอนลงข้อมูล)
            </label>
            <input 
              v-model="inputPin" 
              type="password" 
              inputmode="numeric" 
              pattern="[0-9]*" 
              maxlength="4" 
              placeholder="••••" 
              class="w-full text-center text-3xl font-mono tracking-widest px-4 py-3 rounded-2xl border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition" 
              autofocus 
              required 
            />
            <p v-if="pinError" class="text-xs text-rose-600 font-medium mt-2 flex items-center space-x-1">
              <span>⚠️</span>
              <span>{{ pinError }}</span>
            </p>
          </div>

          <div class="flex space-x-2 pt-1">
            <button 
              type="button" 
              @click="showPinPromptModal = false"
              class="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition text-xs"
            >
              ยกเลิก
            </button>
            <button 
              type="submit" 
              :disabled="isVerifyingPin || inputPin.length !== 4"
              class="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold transition flex items-center justify-center space-x-1 shadow-sm text-xs"
            >
              <span v-if="isVerifyingPin" class="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              <span>{{ isVerifyingPin ? 'กำลังตรวจสอบ...' : 'เข้าสู่หน้าแก้ไข' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- ==================== Modal: แก้ไขข้อมูลป้ายทะเบียน (PIN / Admin Edit) ==================== -->
    <div 
      v-if="showEditModal" 
      class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fade-in"
      @click="showEditModal = false"
    >
      <div class="bg-white rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl my-auto animate-scale-up" @click.stop>
        <div class="flex items-center justify-between border-b border-slate-100 pb-3">
          <div class="flex items-center space-x-2">
            <span class="text-2xl">✏️</span>
            <div>
              <h3 class="font-bold text-base text-slate-900">แก้ไขข้อมูลป้ายทะเบียน</h3>
              <p class="text-[11px] font-medium" :class="isAdmin ? 'text-amber-600' : 'text-blue-600'">
                {{ isAdmin ? '🛡️ สิทธิ์ผู้ดูแลระบบ (Admin Edit)' : '🔑 สิทธิ์เจ้าของรายการ (PIN Verified)' }}
              </p>
            </div>
          </div>
          <button @click="showEditModal = false" class="text-slate-400 hover:text-slate-600 p-1 text-lg">✕</button>
        </div>

        <!-- Quick Status Toggle to RETURNED if not already RETURNED -->
        <div 
          v-if="editForm.status !== 'RETURNED'" 
          class="p-2.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between"
        >
          <div>
            <p class="text-xs font-bold text-emerald-800">ส่งมอบป้ายให้เจ้าของแล้ว?</p>
            <p class="text-[10px] text-emerald-600">กดปุ่มเพื่อเปลี่ยนสถานะเป็นส่งมอบแล้ว</p>
          </div>
          <button 
            type="button"
            @click="editForm.status = 'RETURNED'"
            class="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold active:scale-95 transition flex items-center space-x-1 shadow-2xs"
          >
            <span>✅</span>
            <span>ปิดรายการทันที</span>
          </button>
        </div>

        <form @submit.prevent="submitEditPlate" class="space-y-3 text-xs">
          <!-- Report Type -->
          <div class="grid grid-cols-2 gap-2">
            <button 
              type="button" 
              @click="editForm.reportType = 'FOUND'"
              :class="editForm.reportType === 'FOUND' ? 'bg-emerald-600 text-white font-bold' : 'bg-slate-100 text-slate-700'"
              class="py-2 rounded-xl text-center transition"
            >
              🟢 พบป้าย (เจอ)
            </button>
            <button 
              type="button" 
              @click="editForm.reportType = 'LOST'"
              :class="editForm.reportType === 'LOST' ? 'bg-amber-500 text-white font-bold' : 'bg-slate-100 text-slate-700'"
              class="py-2 rounded-xl text-center transition"
            >
              🔴 แจ้งหาย (หา)
            </button>
          </div>

          <!-- Vehicle Type & Status -->
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="font-medium text-slate-700 block mb-1">ประเภทรถ</label>
              <select v-model="editForm.vehicleType" class="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white">
                <option value="CAR">🚗 รถยนต์</option>
                <option value="MOTORCYCLE">🛵 มอเตอร์ไซค์</option>
                <option value="OTHER">🚚 อื่นๆ</option>
              </select>
            </div>
            <div>
              <label class="font-medium text-slate-700 block mb-1">สถานะป้าย</label>
              <select v-model="editForm.status" class="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium">
                <option value="ACTIVE">🟢 รอส่งมอบ (Active)</option>
                <option value="RETURNED">⚪ ส่งมอบเรียบร้อย (Returned)</option>
                <option value="CANCELLED">❌ ยกเลิก (Cancelled)</option>
              </select>
            </div>
          </div>

          <!-- Plate Prefix & Number -->
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="font-medium text-slate-700 block mb-1">หมวดอักษร</label>
              <input v-model="editForm.platePrefix" type="text" placeholder="เช่น กข, 1กข" class="w-full px-3 py-2 rounded-xl border border-slate-300" required />
            </div>
            <div>
              <label class="font-medium text-slate-700 block mb-1">หมายเลขทะเบียน</label>
              <input v-model="editForm.plateNumber" type="text" placeholder="เช่น 1234, 9" class="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono" required />
            </div>
          </div>

          <!-- Province -->
          <div>
            <label class="font-medium text-slate-700 block mb-1">จังหวัด</label>
            <select v-model="editForm.province" class="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white" required>
              <option v-for="prov in provinces" :key="prov" :value="prov">{{ prov }}</option>
            </select>
          </div>

          <!-- Location -->
          <div>
            <label class="font-medium text-slate-700 block mb-1">จุดรับป้าย / จุดที่หลุดหาย</label>
            <input v-model="editForm.pickupLocation" type="text" placeholder="เช่น ป้อมตำรวจแยกดอยเขาควาย" class="w-full px-3 py-2 rounded-xl border border-slate-300" required />
          </div>

          <!-- Contact Name & Phone -->
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="font-medium text-slate-700 block mb-1">ชื่อผู้ติดต่อ</label>
              <input v-model="editForm.contactName" type="text" placeholder="ชื่อผู้ติดต่อ/หน่วยงาน" class="w-full px-3 py-2 rounded-xl border border-slate-300" required />
            </div>
            <div>
              <label class="font-medium text-slate-700 block mb-1">เบอร์โทรศัพท์</label>
              <input v-model="editForm.contactPhone" type="tel" placeholder="08xxxxxxxx" class="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono" required />
            </div>
          </div>

          <!-- Source URL -->
          <div>
            <label class="font-medium text-slate-700 block mb-1">ลิงก์ต้นทางภายนอก (ถ้ามี)</label>
            <input v-model="editForm.sourceUrl" type="url" placeholder="https://..." class="w-full px-3 py-2 rounded-xl border border-slate-300" />
          </div>

          <!-- Buttons -->
          <div class="flex space-x-2 pt-2 border-t border-slate-100">
            <button 
              type="button" 
              @click="showEditModal = false"
              class="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition"
            >
              ยกเลิก
            </button>
            <button 
              type="submit" 
              :disabled="isSubmittingEdit"
              class="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition flex items-center justify-center space-x-1 shadow-sm"
            >
              <span v-if="isSubmittingEdit" class="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              <span>{{ isSubmittingEdit ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- ==================== Modal: ยืนยันการลบป้ายทะเบียน (Delete Confirm) ==================== -->
    <div 
      v-if="showDeleteConfirmModal && plateToDelete" 
      class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
      @click="showDeleteConfirmModal = false"
    >
      <div class="bg-white rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl my-auto animate-scale-up" @click.stop>
        <div class="flex items-center space-x-2.5 text-rose-600 border-b border-rose-100 pb-3">
          <span class="text-3xl">⚠️</span>
          <div>
            <h3 class="font-bold text-base text-slate-900">ยืนยันการลบป้ายทะเบียน</h3>
            <p class="text-[11px] text-slate-500">การดำเนินการนี้ไม่สามารถเรียกคืนได้</p>
          </div>
        </div>

        <div class="bg-rose-50/70 p-3 rounded-2xl border border-rose-200 space-y-1.5 text-xs text-rose-950">
          <div><b>ทะเบียน:</b> <span class="font-bold font-mono">{{ plateToDelete.platePrefix }} {{ plateToDelete.plateNumber }} {{ plateToDelete.province }}</span></div>
          <div><b>ประเภท:</b> {{ plateToDelete.reportType === 'FOUND' ? '🟢 พบป้ายแล้ว' : '🔴 แจ้งหาย' }}</div>
          <div><b>สถานที่:</b> {{ plateToDelete.pickupLocation }}</div>
          <div><b>ผู้ติดต่อ:</b> {{ plateToDelete.contactName }} ({{ plateToDelete.contactPhone }})</div>
        </div>

        <div class="flex space-x-2 pt-1">
          <button 
            type="button" 
            @click="showDeleteConfirmModal = false; plateToDelete = null"
            class="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition text-xs"
          >
            ยกเลิก
          </button>
          <button 
            type="button" 
            :disabled="isDeletingPlate"
            @click="executeDeletePlate"
            class="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition flex items-center justify-center space-x-1 shadow-sm text-xs"
          >
            <span v-if="isDeletingPlate" class="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            <span>{{ isDeletingPlate ? 'กำลังลบ...' : 'ยืนยันลบทันที' }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Bottom Navigation Bar for Mobile -->
    <nav class="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 px-6 py-2 flex justify-around items-center z-30 max-w-md mx-auto shadow-lg">
      <button 
        @click="selectedTab = 'ALL'; searchQuery = ''"
        class="flex flex-col items-center font-medium text-xs text-emerald-600"
      >
        <span class="text-xl">🏠</span>
        <span>หน้าแรก</span>
      </button>
      <button 
        @click="showOcrModal = true"
        class="flex flex-col items-center font-medium text-xs text-slate-500 hover:text-emerald-600"
      >
        <span class="text-xl">📸</span>
        <span>AI สแกน</span>
      </button>
      <button 
        @click="showSocialModal = true"
        class="flex flex-col items-center font-medium text-xs text-slate-500 hover:text-emerald-600"
      >
        <span class="text-xl">📋</span>
        <span>นำเข้าโซเชียล</span>
      </button>
      <button 
        @click="openSingleModal('FOUND')"
        class="flex flex-col items-center font-medium text-xs text-slate-500 hover:text-emerald-600"
      >
        <span class="text-xl">➕</span>
        <span>ลงข้อมูล</span>
      </button>
    </nav>
  </div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
