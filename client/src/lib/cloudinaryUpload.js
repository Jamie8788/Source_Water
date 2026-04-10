const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME

/**
 * Upload a file to Cloudinary via the Node server (signed upload).
 * Returns the secure_url of the uploaded file.
 */
export async function uploadToCloudinary(file, folder = 'source-water') {
  const API = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace('/api', '')
  const token = localStorage.getItem('sb_access_token') || localStorage.getItem('sw_token')

  const formData = new FormData()
  formData.append('file', file)
  formData.append('folder', folder)

  const res = await fetch(`${API}/api/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Upload failed')
  }

  const data = await res.json()
  return data.url // secure_url from Cloudinary
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
