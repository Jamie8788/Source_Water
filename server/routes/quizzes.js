const router   = require('express').Router()
const db       = require('../db/connection')
const { requireAuth, requireAdmin } = require('../middleware/auth')
const multer   = require('multer')
const cloudinary = require('cloudinary').v2
const { Readable } = require('stream')
const path = require('path')

if (!process.env.CLOUDINARY_CLOUD_NAME) {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') })
}

const memUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })

// Roles that can create / manage quizzes (in addition to is_admin)
const CREATOR_ROLES = ['Teacher', 'Professor', 'Researcher', 'SOURCE Water team member']

function requireQuizCreator(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Auth required' })
  if (req.user.is_admin || CREATOR_ROLES.includes(req.user.role)) return next()
  return res.status(403).json({ error: 'Quiz creator role required. Ask an admin to assign Teacher, Professor, or Researcher role.' })
}

async function uploadImage(buffer) {
  return new Promise((resolve, reject) => {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    })
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'source-water/quiz', resource_type: 'image' },
      (err, result) => err ? reject(err) : resolve(result.secure_url)
    )
    const r = new Readable({ read() {} })
    r.push(buffer); r.push(null)
    r.pipe(stream)
  })
}

function parseOptions(val) {
  if (!val) return []
  if (typeof val === 'string') { try { return JSON.parse(val) } catch { return [] } }
  return Array.isArray(val) ? val : []
}

// ── List quizzes ──────────────────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const isCreator = req.user.is_admin || CREATOR_ROLES.includes(req.user.role)
    const quizzes = await db.all(
      `SELECT q.*, u.display_name as creator_name,
        (SELECT COUNT(*) FROM quiz_questions WHERE quiz_id=q.id) as question_count,
        (SELECT COUNT(*) FROM quiz_attempts WHERE quiz_id=q.id AND completed_at IS NOT NULL) as attempt_count,
        (SELECT ROUND(AVG(score)) FROM quiz_attempts WHERE quiz_id=q.id AND completed_at IS NOT NULL) as avg_score
       FROM quizzes q LEFT JOIN users u ON q.created_by=u.id
       ${isCreator ? '' : "WHERE q.status='published'"}
       ORDER BY q.created_at DESC`, []
    )
    res.json({ quizzes })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── My progress — MUST be before /:id ────────────────────────────────────────
router.get('/my-progress', requireAuth, async (req, res) => {
  try {
    const attempts = await db.all(
      `SELECT qa.id, qa.quiz_id, qa.score, qa.passed, qa.time_taken, qa.completed_at,
              q.title as quiz_title, q.category, q.difficulty
       FROM quiz_attempts qa
       JOIN quizzes q ON qa.quiz_id=q.id
       WHERE qa.user_id=? AND qa.completed_at IS NOT NULL
       ORDER BY qa.completed_at DESC`,
      [req.user.id]
    )
    res.json(attempts)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── My created quizzes — MUST be before /:id ─────────────────────────────────
router.get('/my-quizzes', requireAuth, requireQuizCreator, async (req, res) => {
  try {
    const quizzes = await db.all(
      `SELECT q.*, u.display_name as creator_name,
        (SELECT COUNT(*) FROM quiz_questions WHERE quiz_id=q.id) as question_count,
        (SELECT COUNT(*) FROM quiz_attempts WHERE quiz_id=q.id AND completed_at IS NOT NULL) as attempt_count
       FROM quizzes q LEFT JOIN users u ON q.created_by=u.id
       WHERE q.created_by=?
       ORDER BY q.created_at DESC`,
      [req.user.id]
    )
    res.json({ quizzes })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── AI Question Generation (Gemini free tier) ─────────────────────────────────
router.post('/ai-generate', requireAuth, requireQuizCreator, async (req, res) => {
  try {
    const { text, count = 5, difficulty = 'Intermediate', category = 'General' } = req.body
    if (!text?.trim()) return res.status(400).json({ error: 'text is required' })
    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ error: 'Gemini API not configured. Add GEMINI_API_KEY to server environment.' })
    }

    const prompt = `You are an expert water science educator. Generate exactly ${count} quiz questions based on the following text.

TEXT:
${text.slice(0, 5000)}

Return ONLY a valid JSON array (no markdown, no explanation). Each question must follow this exact schema:
{
  "question_text": "The full question text",
  "question_type": "mcq",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correct_answers": [0],
  "explanation": "Brief explanation of why the answer is correct",
  "difficulty": "${difficulty}",
  "points": 1
}

Rules:
- question_type must be one of: mcq, true_false, short_answer
- For mcq: 4 options, correct_answers is array of 0-based index, e.g. [1]
- For true_false: options must be exactly ["True","False"], correct_answers is [0] or [1]
- For short_answer: options is [], correct_answers is ["the expected answer text"]
- Make questions educational, accurate, and clearly worded
- Cover different aspects of the text
- Return ONLY the JSON array — nothing else`

    const apiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 4096 }
        })
      }
    )

    if (!apiRes.ok) {
      const errData = await apiRes.json().catch(() => ({}))
      return res.status(apiRes.status).json({ error: errData?.error?.message || `Gemini API error ${apiRes.status}` })
    }

    const data = await apiRes.json()
    const raw  = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    let questions
    try {
      questions = JSON.parse(clean)
    } catch {
      const match = clean.match(/\[[\s\S]*\]/)
      if (!match) return res.status(500).json({ error: 'Failed to parse AI response as JSON', raw: clean.slice(0,500) })
      questions = JSON.parse(match[0])
    }

    res.json({ questions: Array.isArray(questions) ? questions : [], model: 'gemini-1.5-flash' })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── Single quiz ───────────────────────────────────────────────────────────────
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const quiz = await db.get('SELECT * FROM quizzes WHERE id=?', [req.params.id])
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' })
    const isCreator = req.user.is_admin || CREATOR_ROLES.includes(req.user.role)
    if (quiz.status !== 'published' && !isCreator) return res.status(403).json({ error: 'Quiz not available' })
    const questions = await db.all('SELECT * FROM quiz_questions WHERE quiz_id=? ORDER BY sort_order ASC', [req.params.id])
    res.json({ ...quiz, questions: questions.map(q => ({ ...q, options: parseOptions(q.options), correct_answers: parseOptions(q.correct_answers) })) })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── Create quiz ───────────────────────────────────────────────────────────────
router.post('/', requireAuth, requireQuizCreator, async (req, res) => {
  try {
    const { title, description, category, difficulty, time_per_question, time_limit, pass_score,
            status, shuffle_questions, shuffle_answers, show_answers_after, negative_marking } = req.body
    const { lastInsertRowid } = await db.run(
      `INSERT INTO quizzes (title,description,category,difficulty,time_per_question,time_limit,pass_score,
        status,shuffle_questions,shuffle_answers,show_answers_after,negative_marking,created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [title, description||'', category||'general', difficulty||'Beginner',
       +time_per_question||60, +time_limit||0, +pass_score||70,
       status||'draft', shuffle_questions?1:0, shuffle_answers?1:0,
       show_answers_after!==false?1:0, +negative_marking||0, req.user.id]
    )
    res.json(await db.get('SELECT * FROM quizzes WHERE id=?', [lastInsertRowid]))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── Update quiz ───────────────────────────────────────────────────────────────
router.put('/:id', requireAuth, requireQuizCreator, async (req, res) => {
  try {
    // Non-admins can only update their own quizzes
    const quiz = await db.get('SELECT * FROM quizzes WHERE id=?', [req.params.id])
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' })
    if (!req.user.is_admin && quiz.created_by !== req.user.id) return res.status(403).json({ error: 'You can only edit your own quizzes' })

    const { title, description, category, difficulty, time_per_question, time_limit, pass_score,
            status, shuffle_questions, shuffle_answers, show_answers_after, negative_marking } = req.body
    await db.run(
      `UPDATE quizzes SET title=?,description=?,category=?,difficulty=?,time_per_question=?,time_limit=?,
        pass_score=?,status=?,shuffle_questions=?,shuffle_answers=?,show_answers_after=?,negative_marking=? WHERE id=?`,
      [title, description||'', category||'general', difficulty||'Beginner',
       +time_per_question||60, +time_limit||0, +pass_score||70, status||'draft',
       shuffle_questions?1:0, shuffle_answers?1:0, show_answers_after?1:0, +negative_marking||0, req.params.id]
    )
    res.json(await db.get('SELECT * FROM quizzes WHERE id=?', [req.params.id]))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── Delete quiz ───────────────────────────────────────────────────────────────
router.delete('/:id', requireAuth, requireQuizCreator, async (req, res) => {
  try {
    const quiz = await db.get('SELECT * FROM quizzes WHERE id=?', [req.params.id])
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' })
    if (!req.user.is_admin && quiz.created_by !== req.user.id) return res.status(403).json({ error: 'You can only delete your own quizzes' })
    await db.run('DELETE FROM quizzes WHERE id=?', [req.params.id])
    res.json({ success: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── Add question ──────────────────────────────────────────────────────────────
router.post('/:id/questions', requireAuth, requireQuizCreator, memUpload.single('question_image'), async (req, res) => {
  try {
    const quiz = await db.get('SELECT created_by FROM quizzes WHERE id=?', [req.params.id])
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' })
    if (!req.user.is_admin && quiz.created_by !== req.user.id) return res.status(403).json({ error: 'You can only edit your own quizzes' })

    const { question_type, question_text, options, correct_answers, explanation, points, sort_order, negative_points } = req.body
    let imagePath = null
    if (req.file) imagePath = await uploadImage(req.file.buffer)
    const { lastInsertRowid } = await db.run(
      `INSERT INTO quiz_questions (quiz_id,question_type,question_text,question_image,options,correct_answers,explanation,points,negative_points,sort_order)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [req.params.id, question_type||'mcq', question_text, imagePath,
       JSON.stringify(parseOptions(options)), JSON.stringify(parseOptions(correct_answers)),
       explanation||'', +points||1, +negative_points||0, +sort_order||0]
    )
    res.json(await db.get('SELECT * FROM quiz_questions WHERE id=?', [lastInsertRowid]))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── Edit question ─────────────────────────────────────────────────────────────
router.put('/questions/:qid', requireAuth, requireQuizCreator, memUpload.single('question_image'), async (req, res) => {
  try {
    const existing = await db.get(
      'SELECT qq.*, q.created_by FROM quiz_questions qq JOIN quizzes q ON q.id=qq.quiz_id WHERE qq.id=?',
      [req.params.qid]
    )
    if (!existing) return res.status(404).json({ error: 'Question not found' })
    if (!req.user.is_admin && existing.created_by !== req.user.id) return res.status(403).json({ error: 'You can only edit your own quizzes' })

    const { question_type, question_text, options, correct_answers, explanation, points, sort_order, negative_points } = req.body
    let imagePath = existing.question_image || null
    if (req.file) imagePath = await uploadImage(req.file.buffer)
    await db.run(
      `UPDATE quiz_questions SET question_type=?,question_text=?,question_image=?,options=?,correct_answers=?,explanation=?,points=?,negative_points=?,sort_order=? WHERE id=?`,
      [question_type||'mcq', question_text, imagePath,
       JSON.stringify(parseOptions(options)), JSON.stringify(parseOptions(correct_answers)),
       explanation||'', +points||1, +negative_points||0, +sort_order||0, req.params.qid]
    )
    res.json(await db.get('SELECT * FROM quiz_questions WHERE id=?', [req.params.qid]))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── Delete question ───────────────────────────────────────────────────────────
router.delete('/questions/:qid', requireAuth, requireQuizCreator, async (req, res) => {
  try {
    const existing = await db.get(
      'SELECT qq.*, q.created_by FROM quiz_questions qq JOIN quizzes q ON q.id=qq.quiz_id WHERE qq.id=?',
      [req.params.qid]
    )
    if (!existing) return res.status(404).json({ error: 'Question not found' })
    if (!req.user.is_admin && existing.created_by !== req.user.id) return res.status(403).json({ error: 'You can only edit your own quizzes' })
    await db.run('DELETE FROM quiz_questions WHERE id=?', [req.params.qid])
    res.json({ success: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── Bulk import JSON questions ────────────────────────────────────────────────
router.post('/:id/import', requireAuth, requireQuizCreator, async (req, res) => {
  try {
    const quiz = await db.get('SELECT created_by FROM quizzes WHERE id=?', [req.params.id])
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' })
    if (!req.user.is_admin && quiz.created_by !== req.user.id) return res.status(403).json({ error: 'You can only edit your own quizzes' })

    const { questions } = req.body
    if (!Array.isArray(questions) || !questions.length) return res.status(400).json({ error: 'questions array required' })
    let count = 0
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      if (!q.question_text) continue
      await db.run(
        `INSERT INTO quiz_questions (quiz_id,question_type,question_text,options,correct_answers,explanation,points,negative_points,sort_order)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [req.params.id, q.question_type||'mcq', q.question_text,
         JSON.stringify(q.options||[]), JSON.stringify(q.correct_answers||[0]),
         q.explanation||'', +q.points||1, +q.negative_points||0, i]
      )
      count++
    }
    res.json({ imported: count })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── Start attempt (study_mode sends correct_answers) ─────────────────────────
router.post('/:id/start', requireAuth, async (req, res) => {
  try {
    const { study_mode } = req.body
    const quiz = await db.get('SELECT * FROM quizzes WHERE id=?', [req.params.id])
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' })
    const isCreator = req.user.is_admin || CREATOR_ROLES.includes(req.user.role)
    if (quiz.status !== 'published' && !isCreator) return res.status(403).json({ error: 'Quiz not available' })

    const raw = await db.all('SELECT * FROM quiz_questions WHERE quiz_id=? ORDER BY sort_order ASC', [req.params.id])
    let questions = raw.map(q => ({
      ...q,
      options: parseOptions(q.options),
      correct_answers: parseOptions(q.correct_answers),
    }))
    if (quiz.shuffle_questions) questions.sort(() => Math.random() - 0.5)

    const { lastInsertRowid } = await db.run(
      'INSERT INTO quiz_attempts (quiz_id,user_id,started_at) VALUES (?,?,NOW())',
      [req.params.id, req.user.id]
    )

    // Study mode: send correct_answers so client can show immediate feedback
    // Normal mode: strip correct_answers (security)
    const safe = study_mode
      ? questions
      : questions.map(({ correct_answers, ...q }) => q)

    res.json({ attempt_id: lastInsertRowid, questions: safe, quiz, study_mode: !!study_mode })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── Submit attempt ────────────────────────────────────────────────────────────
router.post('/:id/submit', requireAuth, async (req, res) => {
  try {
    const { answers, time_taken, attempt_id } = req.body
    const [quiz, questions] = await Promise.all([
      db.get('SELECT * FROM quizzes WHERE id=?', [req.params.id]),
      db.all('SELECT * FROM quiz_questions WHERE quiz_id=? ORDER BY sort_order', [req.params.id]),
    ])
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' })

    let earned = 0
    const total = questions.reduce((s, q) => s + (+q.points || 1), 0)

    const results = questions.map(q => {
      const correct = parseOptions(q.correct_answers)
      const userAnswer = answers?.[q.id]
      let isCorrect = false

      if (q.question_type === 'mcq' || q.question_type === 'true_false') {
        isCorrect = correct.includes(+userAnswer) || correct.includes(userAnswer)
      } else if (q.question_type === 'multiple_select') {
        const ua = (Array.isArray(userAnswer) ? userAnswer : []).map(Number)
        isCorrect = correct.length === ua.length && correct.every(c => ua.includes(+c))
      } else if (q.question_type === 'short_answer' || q.question_type === 'fill_blank') {
        const ans = String(userAnswer || '').toLowerCase().trim()
        isCorrect = ans.length > 0 && correct.some(c =>
          String(c).toLowerCase().includes(ans) || ans.includes(String(c).toLowerCase())
        )
      } else if (q.question_type === 'numeric') {
        const tolerance = parseFloat(correct[1] ?? 0)
        isCorrect = !isNaN(parseFloat(userAnswer)) &&
          Math.abs(parseFloat(userAnswer) - parseFloat(correct[0])) <= Math.max(tolerance, 0.001)
      }

      if (isCorrect) earned += +q.points || 1
      else if (userAnswer !== undefined && userAnswer !== null && userAnswer !== '') {
        earned -= +q.negative_points > 0 ? +q.negative_points : (+quiz.negative_marking || 0)
      }

      return {
        question_id: q.id,
        question_text: q.question_text,
        question_type: q.question_type,
        options: parseOptions(q.options),
        user_answer: userAnswer,
        correct_answers: correct,
        is_correct: isCorrect,
        explanation: q.explanation,
        points_earned: isCorrect ? (+q.points || 1) : -(+q.negative_points || 0),
        max_points: +q.points || 1,
      }
    })

    earned = Math.max(0, earned)
    const score  = total > 0 ? Math.round((earned / total) * 100) : 0
    const passed = score >= (+quiz.pass_score || 70)

    if (attempt_id) {
      await db.run(
        `UPDATE quiz_attempts SET score=?,total_points=?,passed=?,time_taken=?,answers=?,completed_at=NOW() WHERE id=?`,
        [score, total, passed?1:0, +time_taken||0, JSON.stringify({ results, raw: answers }), attempt_id]
      )
    }
    const xp = Math.max(0, Math.round(earned * 2))
    await db.run('UPDATE users SET xp=xp+? WHERE id=?', [xp, req.user.id])
    if (passed) {
      await db.run(
        'INSERT INTO leaderboard_points (user_id,points,action,month) VALUES (?,?,?,?)',
        [req.user.id, 10, 'quiz_pass', new Date().toISOString().slice(0,7)]
      ).catch(() => {})
    }
    res.json({ score, passed, earned, total, xp_earned: xp, results, quiz_title: quiz.title, time_taken: +time_taken||0 })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── Research-level analytics ──────────────────────────────────────────────────
router.get('/:id/analytics', requireAuth, requireQuizCreator, async (req, res) => {
  try {
    // Non-admins only see analytics for their own quizzes
    const quiz = await db.get('SELECT * FROM quizzes WHERE id=?', [req.params.id])
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' })
    if (!req.user.is_admin && quiz.created_by !== req.user.id) return res.status(403).json({ error: 'You can only view analytics for your own quizzes' })

    const [questions, attempts] = await Promise.all([
      db.all('SELECT * FROM quiz_questions WHERE quiz_id=? ORDER BY sort_order', [req.params.id]),
      db.all(
        `SELECT qa.*, u.username, u.display_name
         FROM quiz_attempts qa JOIN users u ON qa.user_id=u.id
         WHERE qa.quiz_id=? AND qa.completed_at IS NOT NULL
         ORDER BY qa.completed_at DESC`,
        [req.params.id]
      )
    ])

    const n = attempts.length
    if (n === 0) return res.json({ quiz, questions, attempts: [], item_analysis: [], stats: null })

    const score_distribution = new Array(10).fill(0)
    attempts.forEach(a => { score_distribution[Math.min(9, Math.floor((a.score||0)/10))]++ })

    const sorted = [...attempts].sort((a,b) => (b.score||0)-(a.score||0))
    const k = Math.max(1, Math.floor(n * 0.27))
    const top = sorted.slice(0, k)
    const bot = sorted.slice(n - k)

    const item_analysis = questions.map(q => {
      const correct = parseOptions(q.correct_answers)
      const answerFreq = {}
      let totalCorrect = 0

      attempts.forEach(a => {
        let parsed = {}
        try { parsed = JSON.parse(a.answers || '{}') } catch {}
        const ua = parsed.raw?.[q.id]
        const key = ua !== undefined && ua !== null ? String(ua) : '__skipped'
        answerFreq[key] = (answerFreq[key] || 0) + 1
        let ok = false
        if (q.question_type === 'mcq' || q.question_type === 'true_false') {
          ok = correct.includes(+ua) || correct.includes(ua)
        } else if (q.question_type === 'short_answer' || q.question_type === 'fill_blank') {
          const a2 = String(ua||'').toLowerCase().trim()
          ok = a2.length > 0 && correct.some(c => String(c).toLowerCase().includes(a2) || a2.includes(String(c).toLowerCase()))
        } else if (q.question_type === 'numeric') {
          const tol = parseFloat(correct[1]??0)
          ok = !isNaN(parseFloat(ua)) && Math.abs(parseFloat(ua)-parseFloat(correct[0])) <= Math.max(tol,0.001)
        }
        if (ok) totalCorrect++
      })

      const checkOk = (a) => {
        let parsed = {}
        try { parsed = JSON.parse(a.answers || '{}') } catch {}
        const ua = parsed.raw?.[q.id]
        return correct.includes(+ua) || correct.includes(ua)
      }
      const pTop = top.filter(checkOk).length / top.length
      const pBot = bot.filter(checkOk).length / bot.length
      const pValue = totalCorrect / n
      const discIdx = pTop - pBot

      return {
        question_id: q.id,
        question_text: q.question_text,
        question_type: q.question_type,
        options: parseOptions(q.options),
        correct_answers: correct,
        p_value: Math.round(pValue * 100) / 100,
        difficulty_label: pValue > 0.8 ? 'Easy' : pValue > 0.5 ? 'Medium' : pValue > 0.3 ? 'Hard' : 'Very Hard',
        discrimination_index: Math.round(discIdx * 100) / 100,
        discrimination_label: discIdx >= 0.4 ? 'Excellent' : discIdx >= 0.3 ? 'Good' : discIdx >= 0.2 ? 'Fair' : 'Poor',
        answer_frequency: answerFreq,
        total_correct: totalCorrect,
        total_attempts: n,
        flag: pValue < 0.15 || pValue > 0.95 || discIdx < 0.15,
        flag_reason: pValue < 0.15 ? 'Too difficult (p < 0.15)' : pValue > 0.95 ? 'Too easy (p > 0.95)' : discIdx < 0.15 ? 'Poor discriminator (d < 0.15)' : null,
      }
    })

    const scores = attempts.map(a => a.score||0)
    const avg    = scores.reduce((s,x) => s+x, 0) / n
    const std    = Math.sqrt(scores.reduce((s,x) => s + Math.pow(x-avg, 2), 0) / n)

    res.json({
      quiz,
      questions,
      attempts: attempts.slice(0, 200),
      item_analysis,
      stats: {
        total_attempts: n,
        unique_users: new Set(attempts.map(a => a.user_id)).size,
        pass_count: attempts.filter(a => a.passed).length,
        pass_rate: Math.round(attempts.filter(a => a.passed).length / n * 100),
        avg_score: Math.round(avg),
        std_dev: Math.round(std),
        min_score: Math.min(...scores),
        max_score: Math.max(...scores),
        median_score: [...scores].sort((a,b)=>a-b)[Math.floor(n/2)],
        avg_time_sec: Math.round(attempts.reduce((s,a) => s+(a.time_taken||0), 0) / n),
        score_distribution,
        cronbach_alpha_estimate: n >= 10 ? Math.min(0.99, Math.max(0, 1 - (item_analysis.length * std * std) / (n * avg))) : null,
      }
    })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
