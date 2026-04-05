const router = require('express').Router()
const db = require('../db/connection')
const { requireAuth, requireAdmin } = require('../middleware/auth')

// GET /api/quizzes
router.get('/', requireAuth, (req, res) => {
  const isAdmin = req.user.is_admin
  const quizzes = db.prepare(`SELECT q.*, u.display_name as creator_name FROM quizzes q LEFT JOIN users u ON q.created_by=u.id ${isAdmin ? '' : "WHERE q.status='published'"} ORDER BY q.created_at DESC`).all()
  const enriched = quizzes.map(q => {
    const questionCount = db.prepare('SELECT COUNT(*) as c FROM quiz_questions WHERE quiz_id=?').get(q.id).c
    const attemptCount = db.prepare('SELECT COUNT(*) as c FROM quiz_attempts WHERE quiz_id=?').get(q.id).c
    const avgScore = db.prepare('SELECT AVG(score) as a FROM quiz_attempts WHERE quiz_id=?').get(q.id).a
    return { ...q, question_count: questionCount, attempt_count: attemptCount, avg_score: avgScore }
  })
  res.json({ quizzes: enriched })
})

// GET /api/quizzes/:id
router.get('/:id', requireAuth, (req, res) => {
  const quiz = db.prepare('SELECT * FROM quizzes WHERE id=?').get(req.params.id)
  if (!quiz) return res.status(404).json({ error: 'Quiz not found' })
  if (quiz.status !== 'published' && !req.user.is_admin) return res.status(403).json({ error: 'Quiz not available' })
  const questions = db.prepare('SELECT * FROM quiz_questions WHERE quiz_id=? ORDER BY sort_order ASC').all(req.params.id)
  const parsed = questions.map(q => ({
    ...q,
    options: q.options ? JSON.parse(q.options) : null,
    correct_answers: q.correct_answers ? JSON.parse(q.correct_answers) : null,
  }))
  if (quiz.shuffle_questions) parsed.sort(() => Math.random() - 0.5)
  res.json({ ...quiz, questions: parsed })
})

// POST /api/quizzes (admin)
router.post('/', requireAuth, requireAdmin, (req, res) => {
  const { title, description, category, difficulty, time_per_question, pass_score, status, shuffle_questions, shuffle_answers, show_answers_after, certificate_enabled } = req.body
  const result = db.prepare(`INSERT INTO quizzes (title,description,category,difficulty,time_per_question,pass_score,status,shuffle_questions,shuffle_answers,show_answers_after,certificate_enabled,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(title,description,category,difficulty,time_per_question||60,pass_score||70,status||'draft',shuffle_questions?1:0,shuffle_answers?1:0,show_answers_after!==false?1:0,certificate_enabled?1:0,req.user.id)
  db.prepare('INSERT INTO activity_log (user_id,action,target_type,target_id) VALUES (?,?,?,?)').run(req.user.id,'created_quiz','quiz',result.lastInsertRowid)
  res.json(db.prepare('SELECT * FROM quizzes WHERE id=?').get(result.lastInsertRowid))
})

// PUT /api/quizzes/:id (admin)
router.put('/:id', requireAuth, requireAdmin, (req, res) => {
  const { title, description, category, difficulty, time_per_question, pass_score, status, shuffle_questions, shuffle_answers, show_answers_after, certificate_enabled } = req.body
  db.prepare(`UPDATE quizzes SET title=?,description=?,category=?,difficulty=?,time_per_question=?,pass_score=?,status=?,shuffle_questions=?,shuffle_answers=?,show_answers_after=?,certificate_enabled=? WHERE id=?`).run(title,description,category,difficulty,time_per_question,pass_score,status,shuffle_questions?1:0,shuffle_answers?1:0,show_answers_after?1:0,certificate_enabled?1:0,req.params.id)
  res.json(db.prepare('SELECT * FROM quizzes WHERE id=?').get(req.params.id))
})

// DELETE /api/quizzes/:id (admin)
router.delete('/:id', requireAuth, requireAdmin, (req, res) => {
  db.prepare('DELETE FROM quizzes WHERE id=?').run(req.params.id)
  res.json({ success: true })
})

// POST /api/quizzes/:id/questions (admin)
router.post('/:id/questions', requireAuth, requireAdmin, (req, res) => {
  const { question_type, question_text, options, correct_answers, explanation, points, sort_order } = req.body
  const result = db.prepare(`INSERT INTO quiz_questions (quiz_id,question_type,question_text,options,correct_answers,explanation,points,sort_order) VALUES (?,?,?,?,?,?,?,?)`).run(req.params.id,question_type,question_text,JSON.stringify(options),JSON.stringify(correct_answers),explanation,points||1,sort_order||0)
  res.json(db.prepare('SELECT * FROM quiz_questions WHERE id=?').get(result.lastInsertRowid))
})

// PUT /api/quizzes/questions/:qid (admin)
router.put('/questions/:qid', requireAuth, requireAdmin, (req, res) => {
  const { question_type, question_text, options, correct_answers, explanation, points, sort_order } = req.body
  db.prepare(`UPDATE quiz_questions SET question_type=?,question_text=?,options=?,correct_answers=?,explanation=?,points=?,sort_order=? WHERE id=?`).run(question_type,question_text,JSON.stringify(options),JSON.stringify(correct_answers),explanation,points,sort_order,req.params.qid)
  res.json(db.prepare('SELECT * FROM quiz_questions WHERE id=?').get(req.params.qid))
})

// DELETE /api/quizzes/questions/:qid (admin)
router.delete('/questions/:qid', requireAuth, requireAdmin, (req, res) => {
  db.prepare('DELETE FROM quiz_questions WHERE id=?').run(req.params.qid)
  res.json({ success: true })
})

// POST /api/quizzes/:id/attempt OR /start
const startAttempt = (req, res) => {
  const quiz = db.prepare('SELECT * FROM quizzes WHERE id=?').get(req.params.id)
  if (!quiz) return res.status(404).json({ error: 'Quiz not found' })
  const raw = db.prepare('SELECT * FROM quiz_questions WHERE quiz_id=? ORDER BY sort_order ASC').all(req.params.id)
  const questions = raw.map(q => ({
    ...q,
    options: q.options ? JSON.parse(q.options) : null,
    correct_answers: q.correct_answers ? JSON.parse(q.correct_answers) : [],
  }))
  if (quiz.shuffle_questions) questions.sort(() => Math.random() - 0.5)
  const result = db.prepare("INSERT INTO quiz_attempts (quiz_id,user_id,started_at) VALUES (?,?,datetime('now'))").run(req.params.id, req.user.id)
  res.json({ attempt_id: result.lastInsertRowid, questions, quiz })
}
router.post('/:id/attempt', requireAuth, startAttempt)
router.post('/:id/start', requireAuth, startAttempt)

// POST /api/quizzes/:id/submit
router.post('/:id/submit', requireAuth, (req, res) => {
  const { answers, time_taken, attempt_id } = req.body
  const quiz = db.prepare('SELECT * FROM quizzes WHERE id=?').get(req.params.id)
  const questions = db.prepare('SELECT * FROM quiz_questions WHERE quiz_id=? ORDER BY sort_order').all(req.params.id)

  let earned = 0, total = 0
  const results = questions.map(q => {
    const userAnswer = answers?.[q.id]
    const correct = q.correct_answers ? JSON.parse(q.correct_answers) : []
    let isCorrect = false
    if (q.question_type === 'mcq' || q.question_type === 'true_false') {
      isCorrect = correct.includes(parseInt(userAnswer)) || correct.includes(userAnswer)
    } else if (q.question_type === 'multiple_select') {
      const ua = Array.isArray(userAnswer) ? userAnswer.map(Number) : []
      isCorrect = correct.length === ua.length && correct.every(c => ua.includes(c))
    } else if (q.question_type === 'ordering') {
      const ua = Array.isArray(userAnswer) ? userAnswer : []
      isCorrect = JSON.stringify(correct) === JSON.stringify(ua)
    } else if (q.question_type === 'numeric') {
      isCorrect = Math.abs(parseFloat(userAnswer) - parseFloat(correct[0])) < 0.01
    } else if (q.question_type === 'short_answer' || q.question_type === 'fill_blank') {
      const ans = String(userAnswer || '').toLowerCase().trim()
      isCorrect = correct.some(c => String(c).toLowerCase().includes(ans) || ans.includes(String(c).toLowerCase()))
    } else {
      isCorrect = false // essay graded manually
    }
    if (isCorrect) earned += q.points
    total += q.points
    return { question_id: q.id, user_answer: userAnswer, is_correct: isCorrect, points_earned: isCorrect ? q.points : 0 }
  })

  const score = total > 0 ? Math.round((earned / total) * 100) : 0
  const passed = score >= quiz.pass_score

  db.prepare(`UPDATE quiz_attempts SET score=?,total_points=?,passed=?,time_taken=?,answers=?,completed_at=datetime('now') WHERE id=?`)
    .run(score, total, passed ? 1 : 0, time_taken || 0, JSON.stringify({ results, raw: answers }), attempt_id)

  // XP + leaderboard
  const xpEarned = Math.round(earned * 2)
  db.prepare('UPDATE users SET xp=xp+? WHERE id=?').run(xpEarned, req.user.id)
  if (passed) {
    db.prepare('INSERT INTO leaderboard_points (user_id,points,action,month) VALUES (?,?,?,?)').run(req.user.id,10,'quiz_pass',new Date().toISOString().slice(0,7))
  }

  res.json({ score, passed, earned, total, xp_earned: xpEarned, results, quiz_title: quiz.title })
})

// GET /api/quizzes/:id/my-attempts
router.get('/:id/my-attempts', requireAuth, (req, res) => {
  const attempts = db.prepare('SELECT * FROM quiz_attempts WHERE quiz_id=? AND user_id=? ORDER BY completed_at DESC').all(req.params.id, req.user.id)
  res.json(attempts.map(a => ({ ...a, answers: a.answers ? JSON.parse(a.answers) : null })))
})

// GET /api/quizzes/:id/analytics (admin)
router.get('/:id/analytics', requireAuth, requireAdmin, (req, res) => {
  const attempts = db.prepare('SELECT qa.*, u.username, u.display_name FROM quiz_attempts qa JOIN users u ON qa.user_id=u.id WHERE qa.quiz_id=?').all(req.params.id)
  const questions = db.prepare('SELECT * FROM quiz_questions WHERE quiz_id=?').all(req.params.id)
  const total = attempts.length
  const passed = attempts.filter(a => a.passed).length
  const avgScore = total ? attempts.reduce((s,a) => s+(a.score||0),0)/total : 0
  res.json({ total_attempts: total, pass_count: passed, pass_rate: total ? Math.round(passed/total*100) : 0, avg_score: Math.round(avgScore), attempts, questions })
})

// GET /api/quizzes/my-progress (all user attempts)
router.get('/user/progress', requireAuth, (req, res) => {
  const attempts = db.prepare(`SELECT qa.*, q.title as quiz_title, q.category FROM quiz_attempts qa JOIN quizzes q ON qa.quiz_id=q.id WHERE qa.user_id=? ORDER BY qa.completed_at DESC`).all(req.user.id)
  res.json(attempts)
})

module.exports = router
