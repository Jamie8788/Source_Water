const router = require('express').Router()
const multer = require('multer')
const cloudinary = require('cloudinary').v2
const { Readable } = require('stream')
const path = require('path')
const crypto = require('crypto')

// Belt-and-suspenders: if env vars not loaded yet, try loading .env from server dir
if (!process.env.CLOUDINARY_CLOUD_NAME) {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') })
}

// Config is set per-request so it always reads the latest env vars


const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } })

function bufferToStream(buffer) {
  const readable = new Readable({ read() {} })
  readable.push(buffer)
  readable.push(null)
  return readable
}

// POST /api/upload
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' })

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME
    const apiKey = process.env.CLOUDINARY_API_KEY
    const apiSecret = process.env.CLOUDINARY_API_SECRET

    console.log('[upload] Cloudinary config check — cloud_name:', cloudName, 'api_key:', apiKey ? '✓' : '✗', 'api_secret:', apiSecret ? '✓' : '✗')

    if (!cloudName || !apiKey || !apiSecret) {
      const missing = [!cloudName && 'CLOUDINARY_CLOUD_NAME', !apiKey && 'CLOUDINARY_API_KEY', !apiSecret && 'CLOUDINARY_API_SECRET'].filter(Boolean).join(', ')
      return res.status(500).json({ error: `Cloudinary not configured. Missing: ${missing}` })
    }

    // Configure fresh on each request
    cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret })

    const folder = req.body.folder || 'source-water'
    const isVideo = req.file.mimetype.startsWith('video/')
    const isAudio = req.file.mimetype.startsWith('audio/')

    const resourceType = isVideo ? 'video' : isAudio ? 'video' : 'image'

    const uploadOptions = { folder, resource_type: resourceType }
    if (!isVideo) {
      uploadOptions.quality = 'auto'
      uploadOptions.fetch_format = 'auto'
    } else {
      // Large videos must use async eager processing — skip sync transformations
      uploadOptions.eager_async = true
    }

    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (err, result) => err ? reject(err) : resolve(result)
      )
      bufferToStream(req.file.buffer).pipe(uploadStream)
    })

    res.json({ url: result.secure_url, public_id: result.public_id, resource_type: result.resource_type })
  } catch (err) {
    console.error('Cloudinary upload error:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/upload/sign — client calls this first, then uploads directly to Cloudinary
// Bypasses Render's 30s timeout for large videos
router.get('/sign', (req, res) => {
  const cloudName  = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey     = process.env.CLOUDINARY_API_KEY
  const apiSecret  = process.env.CLOUDINARY_API_SECRET
  if (!cloudName || !apiKey || !apiSecret) return res.status(500).json({ error: 'Cloudinary not configured' })

  const folder    = req.query.folder || 'source-water/videos'
  const timestamp = Math.round(Date.now() / 1000)
  // Must sort params alphabetically before signing
  const paramsStr = `folder=${folder}&timestamp=${timestamp}`
  const signature = crypto.createHash('sha256').update(paramsStr + apiSecret).digest('hex')

  res.json({ signature, timestamp, api_key: apiKey, cloud_name: cloudName, folder })
})

module.exports = router
