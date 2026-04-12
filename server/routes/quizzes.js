const router  = require('express').Router()
const db      = require('../db/connection')
const { requireAuth, requireAdmin } = require('../middleware/auth')
const multer  = require('multer')
const cloudinary = require('cloudinary').v2
const { Readable } = require('stream')
const path = require('path')

if (!process.env.CLOUDINARY_CLOUD_NAME) {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') })
}

const memUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })

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
    const isAdmin = req.user.is_admin
    const quizzes = await db.all(
      `SELECT q.*, u.display_name as creator_name,
        (SELECT COUNT(*) FROM quiz_questions WHERE quiz_id=q.id) as question_count,
        (SELECT COUNT(*) FROM quiz_attempts WHERE quiz_id=q.id AND completed_at IS NOT NULL) as attempt_count,
        (SELECT ROUND(AVG(score)) FROM quiz_attempts WHERE quiz_id=q.id AND completed_at IS NOT NULL) as avg_score
       FROM quizzes q LEFT JOIN users u ON q.created_by=u.id
       ${isAdmin ? '' : "WHERE q.status='published'"}
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

// ── Single quiz (questions stripped of correct answers) ───────────────────────
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const quiz = await db.get('SELECT * FROM quizzes WHERE id=?', [req.params.id])
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' })
    if (quiz.status !== 'published' && !req.user.is_admin) return res.status(403).json({ error: 'Quiz not available' })
    const questions = await db.all('SELECT * FROM quiz_questions WHERE quiz_id=? ORDER BY sort_order ASC', [req.params.id])
    res.json({ ...quiz, questions: questions.map(q => ({ ...q, options: parseOptions(q.options), correct_answers: parseOptions(q.correct_answers) })) })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── Create quiz ───────────────────────────────────────────────────────────────
router.post('/', requireAuth, requireAdmin, async (req, res) => {
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
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
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
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await db.run('DELETE FROM quizzes WHERE id=?', [req.params.id])
    res.json({ success: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── Add question (Cloudinary image) ──────────────────────────────────────────
router.post('/:id/questions', requireAuth, requireAdmin, memUpload.single('question_image'), async (req, res) => {
  try {
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
router.put('/questions/:qid', requireAuth, requireAdmin, memUpload.single('question_image'), async (req, res) => {
  try {
    const { question_type, question_text, options, correct_answers, explanation, points, sort_order, negative_points } = req.body
    const existing = await db.get('SELECT question_image FROM quiz_questions WHERE id=?', [req.params.qid])
    let imagePath = existing?.question_image || null
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
router.delete('/questions/:qid', requireAuth, requireAdmin, async (req, res) => {
  try {
    await db.run('DELETE FROM quiz_questions WHERE id=?', [req.params.qid])
    res.json({ success: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── Bulk import JSON questions ─────────────────────────────────────────────────
router.post('/:id/import', requireAuth, requireAdmin, async (req, res) => {
  try {
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

// ── Start attempt ─────────────────────────────────────────────────────────────
router.post('/:id/start', requireAuth, async (req, res) => {
  try {
    const quiz = await db.get('SELECT * FROM quizzes WHERE id=?', [req.params.id])
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' })
    if (quiz.status !== 'published' && !req.user.is_admin) return res.status(403).json({ error: 'Quiz not available' })
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
    // Never send correct_answers to browser
    const safe = questions.map(({ correct_answers, ...q }) => q)
    res.json({ attempt_id: lastInsertRowid, questions: safe, quiz })
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
    const score = total > 0 ? Math.round((earned / total) * 100) : 0
    const passed = score >= (+quiz.pass_score || 70)

    await db.run(
      `UPDATE quiz_attempts SET score=?,total_points=?,passed=?,time_taken=?,answers=?,completed_at=NOW() WHERE id=?`,
      [score, total, passed?1:0, +time_taken||0, JSON.stringify({ results, raw: answers }), attempt_id]
    )
    const xp = Math.max(0, Math.round(earned * 2))
    await db.run('UPDATE users SET xp=xp+? WHERE id=?', [xp, req.user.id])
    if (passed) {
      await db.run(
        'INSERT INTO leaderboard_points (user_id,points,action,month) VALUES (?,?,?,?)',
        [req.user.id, 10, 'quiz_pass', new Date().toISOString().slice(0,7)]
      ).catch(() => {})
    }
    res.json({ score, passed, earned, total, xp_earned: xp, results, quiz_title: quiz.title })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── Research-level analytics ──────────────────────────────────────────────────
router.get('/:id/analytics', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [quiz, questions, attempts] = await Promise.all([
      db.get('SELECT * FROM quizzes WHERE id=?', [req.params.id]),
      db.all('SELECT * FROM quiz_questions WHERE quiz_id=? ORDER BY sort_order', [req.params.id]),
      db.all(
        `SELECT qa.*, u.username, u.display_name
         FROM quiz_attempts qa JOIN users u ON qa.user_id=u.id
         WHERE qa.quiz_id=? AND qa.completed_at IS NOT NULL
         ORDER BY qa.completed_at DESC`,
        [req.params.id]
      )
    ])
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' })

    const n = attempts.length
    if (n === 0) return res.json({ quiz, questions, attempts: [], item_analysis: [], stats: null })

    // Score distribution (10 buckets: 0-9, 10-19, ..., 90-100)
    const score_distribution = new Array(10).fill(0)
    attempts.forEach(a => { score_distribution[Math.min(9, Math.floor((a.score||0)/10))]++ })

    // Top 27% / bottom 27% for discrimination index
    const sorted = [...attempts].sort((a,b) => (b.score||0)-(a.score||0))
    const k = Math.max(1, Math.floor(n * 0.27))
    const top = sorted.slice(0, k)
    const bot = sorted.slice(n - k)

    const item_analysis = questions.map(q => {
      const correct = parseOptions(q.correct_answers)
      const opts = parseOptions(q.options)
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
        options: opts,
        correct_answers: correct,
        p_value: Math.round(pValue * 100) / 100,
        difficulty_label: pValue > 0.8 ? 'Easy' : pValue > 0.5 ? 'Medium' : pValue > 0.3 ? 'Hard' : 'Very Hard',
        discrimination_index: Math.round(discIdx * 100) / 100,
        discrimination_label: discIdx >= 0.4 ? 'Excellent' : discIdx >= 0.3 ? 'Good' : discIdx >= 0.2 ? 'Fair' : 'Poor',
        answer_frequency: answerFreq,
        total_correct: totalCorrect,
        total_attempts: n,
      }
    })

    const scores = attempts.map(a => a.score||0)
    const avg = scores.reduce((s,x) => s+x, 0) / n
    const std = Math.sqrt(scores.reduce((s,x) => s + Math.pow(x-avg, 2), 0) / n)

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
        median_score: scores.sort((a,b)=>a-b)[Math.floor(n/2)],
        avg_time_sec: Math.round(attempts.reduce((s,a) => s+(a.time_taken||0), 0) / n),
        score_distribution,
      }
    })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
