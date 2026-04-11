const router = require('express').Router()
const db = require('../db/connection')
const { requireAuth, requireAdmin } = require('../middleware/auth')
const upload = require('../middleware/upload')

router.get('/', requireAuth, async (req, res) => {
  const isAdmin = req.user.is_admin
  const quizzes = await db.all(
    `SELECT q.*, u.display_name as creator_name FROM quizzes q LEFT JOIN users u ON q.created_by=u.id ${isAdmin ? '' : "WHERE q.status='published'"} ORDER BY q.created_at DESC`, [])
  const enriched = await Promise.all(quizzes.map(async q => {
    const [qRow, aRow, avgRow] = await Promise.all([
      db.get('SELECT COUNT(*) as c FROM quiz_questions WHERE quiz_id=?', [q.id]),
      db.get('SELECT COUNT(*) as c FROM quiz_attempts WHERE quiz_id=?', [q.id]),
      db.get('SELECT AVG(score) as a FROM quiz_attempts WHERE quiz_id=?', [q.id]),
    ])
    return { ...q, question_count: parseInt(qRow?.c ?? 0), attempt_count: parseInt(aRow?.c ?? 0), avg_score: avgRow?.a ?? null }
  }))
  res.json({ quizzes: enriched })
})

router.get('/:id', requireAuth, async (req, res) => {
  const quiz = await db.get('SELECT * FROM quizzes WHERE id=?', [req.params.id])
  if (!quiz) return res.status(404).json({ error: 'Quiz not found' })
  if (quiz.status !== 'published' && !req.user.is_admin) return res.status(403).json({ error: 'Quiz not available' })
  const questions = await db.all('SELECT * FROM quiz_questions WHERE quiz_id=? ORDER BY sort_order ASC', [req.params.id])
  const parsed = questions.map(q => ({ ...q, options: q.options ? JSON.parse(q.options) : null, correct_answers: q.correct_answers ? JSON.parse(q.correct_answers) : null }))
  if (quiz.shuffle_questions) parsed.sort(() => Math.random() - 0.5)
  res.json({ ...quiz, questions: parsed })
})

router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const { title, description, category, difficulty, time_per_question, time_limit, pass_score, status, shuffle_questions, shuffle_answers, show_answers_after, certificate_enabled, negative_marking } = req.body
  const { lastInsertRowid } = await db.run(
    `INSERT INTO quizzes (title,description,category,difficulty,time_per_question,time_limit,pass_score,status,shuffle_questions,shuffle_answers,show_answers_after,certificate_enabled,negative_marking,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [title, description, category, difficulty, time_per_question || 60, time_limit || 0, pass_score || 70, status || 'draft', shuffle_questions ? 1 : 0, shuffle_answers ? 1 : 0, show_answers_after !== false ? 1 : 0, certificate_enabled ? 1 : 0, negative_marking || 0, req.user.id])
  await db.run('INSERT INTO activity_log (user_id,action,target_type,target_id) VALUES (?,?,?,?)',
    [req.user.id, 'created_quiz', 'quiz', lastInsertRowid])
  res.json(await db.get('SELECT * FROM quizzes WHERE id=?', [lastInsertRowid]))
})

router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const { title, description, category, difficulty, time_per_question, time_limit, pass_score, status, shuffle_questions, shuffle_answers, show_answers_after, certificate_enabled, negative_marking } = req.body
  await db.run(
    `UPDATE quizzes SET title=?,description=?,category=?,difficulty=?,time_per_question=?,time_limit=?,pass_score=?,status=?,shuffle_questions=?,shuffle_answers=?,show_answers_after=?,certificate_enabled=?,negative_marking=? WHERE id=?`,
    [title, description, category, difficulty, time_per_question, time_limit || 0, pass_score, status, shuffle_questions ? 1 : 0, shuffle_answers ? 1 : 0, show_answers_after ? 1 : 0, certificate_enabled ? 1 : 0, negative_marking || 0, req.params.id])
  res.json(await db.get('SELECT * FROM quizzes WHERE id=?', [req.params.id]))
})

router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  await db.run('DELETE FROM quizzes WHERE id=?', [req.params.id])
  res.json({ success: true })
})

router.post('/:id/questions', requireAuth, requireAdmin, upload.single('question_image'), async (req, res) => {
  const { question_type, question_text, options, correct_answers, explanation, points, sort_order, negative_points } = req.body
  let imagePath = null
  if (req.file) { const rel = req.file.path.replace(/\\/g, '/').split('/uploads/').pop(); imagePath = `/uploads/${rel}` }
  const { lastInsertRowid } = await db.run(
    `INSERT INTO quiz_questions (quiz_id,question_type,question_text,question_image,options,correct_answers,explanation,points,negative_points,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [req.params.id, question_type, question_text, imagePath, JSON.stringify(options || []), JSON.stringify(correct_answers || []), explanation || '', points || 1, negative_points || 0, sort_order || 0])
  res.json(await db.get('SELECT * FROM quiz_questions WHERE id=?', [lastInsertRowid]))
})

router.put('/questions/:qid', requireAuth, requireAdmin, upload.single('question_image'), async (req, res) => {
  const { question_type, question_text, options, correct_answers, explanation, points, sort_order, negative_points } = req.body
  const existing = await db.get('SELECT question_image FROM quiz_questions WHERE id=?', [req.params.qid])
  let imagePath = existing?.question_image || null
  if (req.file) { const rel = req.file.path.replace(/\\/g, '/').split('/uploads/').pop(); imagePath = `/uploads/${rel}` }
  await db.run(
    `UPDATE quiz_questions SET question_type=?,question_text=?,question_image=?,options=?,correct_answers=?,explanation=?,points=?,negative_points=?,sort_order=? WHERE id=?`,
    [question_type, question_text, imagePath, JSON.stringify(options || []), JSON.stringify(correct_answers || []), explanation || '', points, negative_points || 0, sort_order, req.params.qid])
  res.json(await db.get('SELECT * FROM quiz_questions WHERE id=?', [req.params.qid]))
})

router.delete('/questions/:qid', requireAuth, requireAdmin, async (req, res) => {
  await db.run('DELETE FROM quiz_questions WHERE id=?', [req.params.qid])
  res.json({ success: true })
})

const startAttempt = async (req, res) => {
  const quiz = await db.get('SELECT * FROM quizzes WHERE id=?', [req.params.id])
  if (!quiz) return res.status(404).json({ error: 'Quiz not found' })
  const raw = await db.all('SELECT * FROM quiz_questions WHERE quiz_id=? ORDER BY sort_order ASC', [req.params.id])
  const questions = raw.map(q => ({ ...q, options: q.options ? JSON.parse(q.options) : null, correct_answers: q.correct_answers ? JSON.parse(q.correct_answers) : [] }))
  if (quiz.shuffle_questions) questions.sort(() => Math.random() - 0.5)
  const { lastInsertRowid } = await db.run(
    'INSERT INTO quiz_attempts (quiz_id,user_id,started_at) VALUES (?,?,NOW())', [req.params.id, req.user.id])
  res.json({ attempt_id: lastInsertRowid, questions, quiz })
}
router.post('/:id/attempt', requireAuth, startAttempt)
router.post('/:id/start', requireAuth, startAttempt)

router.post('/:id/submit', requireAuth, async (req, res) => {
  const { answers, time_taken, attempt_id } = req.body
  const [quiz, questions] = await Promise.all([
    db.get('SELECT * FROM quizzes WHERE id=?', [req.params.id]),
    db.all('SELECT * FROM quiz_questions WHERE quiz_id=? ORDER BY sort_order', [req.params.id]),
  ])

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
      isCorrect = JSON.stringify(correct) === JSON.stringify(Array.isArray(userAnswer) ? userAnswer : [])
    } else if (q.question_type === 'numeric') {
      isCorrect = Math.abs(parseFloat(userAnswer) - parseFloat(correct[0])) < 0.01
    } else if (q.question_type === 'short_answer' || q.question_type === 'fill_blank') {
      const ans = String(userAnswer || '').toLowerCase().trim()
      isCorrect = correct.some(c => String(c).toLowerCase().includes(ans) || ans.includes(String(c).toLowerCase()))
    }
    if (isCorrect) earned += q.points
    else if (userAnswer !== undefined && userAnswer !== null && userAnswer !== '') {
      earned -= q.negative_points > 0 ? q.negative_points : (quiz.negative_marking || 0)
    }
    total += q.points
    return { question_id: q.id, user_answer: userAnswer, is_correct: isCorrect, points_earned: isCorrect ? q.points : -(q.negative_points || 0) }
  })

  const score = total > 0 ? Math.round((earned / total) * 100) : 0
  const passed = score >= quiz.pass_score
  await db.run(
    `UPDATE quiz_attempts SET score=?,total_points=?,passed=?,time_taken=?,answers=?,completed_at=NOW() WHERE id=?`,
    [score, total, passed ? 1 : 0, time_taken || 0, JSON.stringify({ results, raw: answers }), attempt_id])

  const xpEarned = Math.round(earned * 2)
  await db.run('UPDATE users SET xp=xp+? WHERE id=?', [xpEarned, req.user.id])
  if (passed) {
    await db.run('INSERT INTO leaderboard_points (user_id,points,action,month) VALUES (?,?,?,?)',
      [req.user.id, 10, 'quiz_pass', new Date().toISOString().slice(0, 7)])
  }
  res.json({ score, passed, earned, total, xp_earned: xpEarned, results, quiz_title: quiz.title })
})

router.get('/:id/my-attempts', requireAuth, async (req, res) => {
  const attempts = await db.all('SELECT * FROM quiz_attempts WHERE quiz_id=? AND user_id=? ORDER BY completed_at DESC', [req.params.id, req.user.id])
  res.json(attempts.map(a => ({ ...a, answers: a.answers ? JSON.parse(a.answers) : null })))
})

router.get('/:id/analytics', requireAuth, requireAdmin, async (req, res) => {
  const [attempts, questions] = await Promise.all([
    db.all('SELECT qa.*, u.username, u.display_name FROM quiz_attempts qa JOIN users u ON qa.user_id=u.id WHERE qa.quiz_id=?', [req.params.id]),
    db.all('SELECT * FROM quiz_questions WHERE quiz_id=?', [req.params.id]),
  ])
  const total = attempts.length
  const passed = attempts.filter(a => a.passed).length
  const avgScore = total ? attempts.reduce((s, a) => s + (a.score || 0), 0) / total : 0
  res.json({ total_attempts: total, pass_count: passed, pass_rate: total ? Math.round(passed / total * 100) : 0, avg_score: Math.round(avgScore), attempts, questions })
})

router.get('/user/progress', requireAuth, async (req, res) => {
  const attempts = await db.all(
    `SELECT qa.*, q.title as quiz_title, q.category FROM quiz_attempts qa JOIN quizzes q ON qa.quiz_id=q.id WHERE qa.user_id=? ORDER BY qa.completed_at DESC`,
    [req.user.id])
  res.json(attempts)
})

module.exports = router
