const multer = require('multer')
const path = require('path')
const fs = require('fs')

// Use absolute path so files always land in source-water/uploads/
// regardless of which directory the server process is started from
const uploadDir = (process.env.UPLOAD_DIR && !process.env.UPLOAD_DIR.startsWith('.'))
  ? process.env.UPLOAD_DIR
  : path.join(__dirname, '..', '..', 'uploads')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

const subDirs = ['images','documents','audio','datasets','logos','videos']
subDirs.forEach(d => {
  const p = path.join(uploadDir, d)
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true })
})

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const mime = file.mimetype
    let sub = 'documents'
    if (mime.startsWith('image/')) sub = 'images'
    else if (mime.startsWith('video/')) sub = 'videos'
    else if (mime.startsWith('audio/')) sub = 'audio'
    else if (['text/csv','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/json'].includes(mime)) sub = 'datasets'
    cb(null, path.join(uploadDir, sub))
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
    cb(null, `${unique}${path.extname(file.originalname)}`)
  }
})

const fileFilter = (req, file, cb) => {
  const allowed = [
    'image/jpeg','image/png','image/gif','image/webp',
    'application/pdf','text/plain','text/csv',
    'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/json','audio/mpeg','audio/wav','audio/ogg','audio/webm','audio/mp4',
    'video/mp4','video/webm','video/quicktime','video/x-msvideo','video/avi','video/mov',
    'video/x-matroska','video/3gpp',
  ]
  if (allowed.includes(file.mimetype)) cb(null, true)
  else cb(new Error('File type not allowed'), false)
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 104857600 }
})

module.exports = upload
