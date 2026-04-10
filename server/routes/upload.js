const router = require('express').Router()
const multer = require('multer')
const cloudinary = require('cloudinary').v2
const { Readable } = require('stream')

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

    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder, resource_type: resourceType, quality: 'auto', fetch_format: 'auto' },
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

module.exports = router
