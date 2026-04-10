const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const API_BASE   = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace('/api', '')

function getToken() {
  return localStorage.getItem('sb_access_token') || localStorage.getItem('sw_token')
}

/**
 * Upload a file to Cloudinary.
 * - Videos: client uploads DIRECTLY to Cloudinary (bypasses Render's 30s timeout)
 * - Images/audio: route through server (fast enough)
 */
export async function uploadToCloudinary(file, folder = 'source-water', onProgress) {
  const isVideo = file.type.startsWith('video/')
  const token   = getToken()

  if (isVideo) {
    return uploadVideoDirectly(file, folder, token, onProgress)
  }

  // ── Images / audio: server route ─────────────────────────────────────────
  const formData = new FormData()
  formData.append('file', file)
  formData.append('folder', folder)

  const ctrl  = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 120_000) // 2-min timeout for images

  try {
    const res = await fetch(`${API_BASE}/api/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
      signal: ctrl.signal,
    })
    clearTimeout(timer)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Upload failed')
    }
    const data = await res.json()
    return data.url
  } catch (e) {
    clearTimeout(timer)
    if (e.name === 'AbortError') throw new Error('Upload timed out — try a smaller file')
    throw e
  }
}

/**
 * Upload video directly from browser to Cloudinary.
 * 1. Get signed params from our server (tiny fast request)
 * 2. POST the actual video bytes straight to Cloudinary API
 * No Render timeout involved.
 */
async function uploadVideoDirectly(file, folder, token, onProgress) {
  // Step 1: get signature
  const signRes = await fetch(`${API_BASE}/api/upload/sign?folder=${encodeURIComponent(folder)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!signRes.ok) throw new Error('Failed to get upload signature')
  const { signature, timestamp, api_key, cloud_name } = await signRes.json()

  // Step 2: upload directly to Cloudinary
  const formData = new FormData()
  formData.append('file', file)
  formData.append('folder', folder)
  formData.append('timestamp', String(timestamp))
  formData.append('api_key', api_key)
  formData.append('signature', signature)
  formData.append('eager_async', 'true') // async processing — avoids sync timeout

  // Use XMLHttpRequest so we can track upload progress
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloud_name}/video/upload`)

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText)
          resolve(data.secure_url)
        } catch {
          reject(new Error('Invalid response from Cloudinary'))
        }
      } else {
        reject(new Error(`Cloudinary upload failed: ${xhr.status}`))
      }
    }
    xhr.onerror  = () => reject(new Error('Network error during video upload'))
    xhr.ontimeout = () => reject(new Error('Video upload timed out'))
    xhr.timeout  = 15 * 60 * 1000 // 15 minutes max for large videos

    xhr.send(formData)
  })
}

export function cloudinaryUrl(publicId, opts = {}) {
  if (!publicId) return ''
  if (publicId.startsWith('http')) return publicId
  const { width, height, crop = 'fill', quality = 'auto', format = 'auto' } = opts
  const transforms = [
    width && `w_${width}`,
    height && `h_${height}`,
    `c_${crop}`,
    `q_${quality}`,
    `f_${format}`,
  ].filter(Boolean).join(',')
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${transforms}/${publicId}`
}
