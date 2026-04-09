const multer = require('multer')
const path = require('path')
const fs = require('fs')

// Use absolute path so files always land in source-water/uploads/
// regardless of which directory the server process is started from
const uploadDir = (process.env.UPLOAD_DIR && !process.env.UPLOAD_DIR.startsWith('.'))
  ? process.env.UPLOAD_DIR
  : path.join(__dirname, '..', '..', 'uploads')

// Ensure upload directory exists with proper permissions
if (!fs.existsSync(uploadDir)) {
  try {
    fs.mkdirSync(uploadDir, { recursive: true, mode: 0o755 })
    console.log(`Created upload directory: ${uploadDir}`)
  } catch (err) {
    console.error(`Failed to create upload directory: ${err.message}`)
    // Fallback to current directory uploads
    const fallbackDir = path.join(__dirname, 'uploads')
    if (!fs.existsSync(fallbackDir)) fs.mkdirSync(fallbackDir, { recursive: true })
    console.log(`Using fallback upload directory: ${fallbackDir}`)
  }
}

const subDirs = ['images','documents','audio','datasets','logos','videos']
subDirs.forEach(d => {
  const p = path.join(uploadDir, d)
  if (!fs.existsSync(p)) {
    try {
      fs.mkdirSync(p, { recursive: true, mode: 0o755 })
    } catch (err) {
      console.error(`Failed to create subdirectory ${p}: ${err.message}`)
    }
  }
})

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const mime = file.mimetype
    let sub = 'documents'
    if (mime.startsWith('image/')) sub = 'images'
    else if (mime.startsWith('video/')) sub = 'videos'
    else if (mime.startsWith('audio/')) sub = 'audio'
    else if (['text/csv','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/json'].includes(mime)) sub = 'datasets'
    else sub = 'documents'
    
    const destPath = path.join(uploadDir, sub)
    if (!fs.existsSync(destPath)) {
      try {
        fs.mkdirSync(destPath, { recursive: true, mode: 0o755 })
      } catch (err) {
        console.error(`Failed to create destination directory ${destPath}: ${err.message}`)
        return cb(err, uploadDir) // fallback to root upload dir
      }
    }
    cb(null, destPath)
  },
  filename: (req, file, cb) => {
    // Generate unique filename with original extension
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
    const ext = path.extname(file.originalname) || '.jpg'
    const filename = `${unique}${ext}`
    cb(null, filename)
  }
})

const fileFilter = (req, file, cb) => {
  const allowed = [
    'image/jpeg','image/png','image/gif','image/webp','image/bmp','image/tiff',
    'application/pdf','text/plain','text/csv',
    'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/json','audio/mpeg','audio/wav','audio/ogg','audio/webm','audio/mp4',
    'video/mp4','video/webm','video/quicktime','video/x-msvideo','video/avi','video/mov',
    'video/x-matroska','video/3gpp',
  ]
  
  // Allow all image types for broader compatibility
  if (file.mimetype.startsWith('image/')) {
    cb(null, true)
  } else if (allowed.includes(file.mimetype)) {
    cb(null, true)
  } else {
    console.log(`File type not allowed: ${file.mimetype}`)
    cb(new Error(`File type not allowed: ${file.mimetype}`), false)
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: { 
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 104857600, // 100MB
    files: 10 // Allow up to 10 files per request
  }
})

// Add error handling middleware
upload.singleWithErrors = (fieldName) => {
  return (req, res, next) => {
    upload.single(fieldName)(req, res, (err) => {
      if (err) {
        console.error('Upload error:', err.message)
        return res.status(400).json({ 
          error: 'Upload failed', 
          message: err.message,
          code: err.code 
        })
      }
      next()
    })
  }
}

upload.arrayWithErrors = (fieldName, maxCount) => {
  return (req, res, next) => {
    upload.array(fieldName, maxCount)(req, res, (err) => {
      if (err) {
        console.error('Upload error:', err.message)
        return res.status(400).json({ 
          error: 'Upload failed', 
          message: err.message,
          code: err.code 
        })
      }
      next()
    })
  }
}

module.exports = upload
