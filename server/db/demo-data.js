// Run: node db/demo-data.js
const bcrypt = require('bcryptjs')
const db = require('./connection')

console.log('Adding demo data...')

// Demo users
const demoUsers = [
  { username: 'elaine3',    email: 'elaine@demo.ca',  display_name: 'Elaine Ho',        role: 'Educator',         location: 'Sault Ste. Marie' },
  { username: 'tester007',  email: 'test7@demo.ca',   display_name: 'Dr. James Rivera', role: 'Researcher',       location: 'Sudbury' },
  { username: 'kiki',       email: 'kiki@demo.ca',    display_name: 'Kiki Makinen',     role: 'Community member', location: 'Sault Ste. Marie' },
  { username: 'tester9',    email: 'test9@demo.ca',   display_name: 'TESTER9',          role: 'Community member', location: 'Elliot Lake' },
  { username: 'waterwatch', email: 'wwatch@demo.ca',  display_name: 'Water Watch',      role: 'Volunteer',        location: 'Blind River' },
]

const hash = bcrypt.hashSync('demo1234', 10)
const insUser = db.prepare(`INSERT OR IGNORE INTO users (username,email,password_hash,display_name,role,location,avatar_emoji,onboarding_completed,is_active) VALUES (?,?,?,?,?,?,?,1,1)`)
const emojis = ['💧','🌊','🐟','🌿','🔬']
demoUsers.forEach((u, i) => insUser.run(u.username, u.email, hash, u.display_name, u.role, u.location, emojis[i]))

// Get IDs
const users = db.prepare(`SELECT id, username FROM users WHERE username IN ('elaine3','tester007','kiki','tester9','waterwatch','admin')`).all()
const uid = {}
users.forEach(u => { uid[u.username] = u.id })

// Demo posts
const demoPosts = [
  { user: 'elaine3',    content: '🌊 Just finished my monthly water sampling at Garden River Site A! pH was 7.3 and dissolved oxygen at 9.1 mg/L — really healthy readings this week. Love seeing the data stay in range! #WaterQuality #NorthernOntario' },
  { user: 'tester007',  content: '📊 Research update: Our team has been analyzing turbidity patterns across 8 sites on Lake Huron. Interesting spike near Thessalon last Tuesday — possibly connected to the recent rainfall. Will publish findings next week.' },
  { user: 'kiki',       content: '🎮 Just beat my high score in the Watershed Cleanup game! 2,340 points! Anyone else playing? Great way to learn about Northern Ontario water systems while having fun 💙' },
  { user: 'waterwatch', content: '⚠️ Heads up to the Blind River community — slight increase in turbidity at Mississagi River Monitor this morning (12 NTU vs usual 3–4 NTU). Likely from upstream activity. Monitoring closely.' },
  { user: 'elaine3',    content: '📚 Reminder: next Water Rangers training session this Saturday at the Sault Ste. Marie Community Centre. We\'ll cover field sampling protocols and the SOURCE Water app. All welcome! 💧' },
  { user: 'tester007',  content: '🔬 Did you know? Lake Superior contains ~10% of the world\'s surface fresh water, yet less than 1% of its watershed is monitored regularly. Community science programs like this one are SO critical.' },
  { user: 'admin',      content: '🌿 Platform update: 3 new monitoring sites added near Chapleau. If you\'re in the area, consider joining as a volunteer sampler! Every data point helps protect our watershed. Visit the Map page to get started.' },
]

const insPost = db.prepare(`INSERT OR IGNORE INTO posts (user_id, content, created_at) VALUES (?,?,datetime('now',?))`)
demoPosts.forEach((p, i) => {
  const id = uid[p.user]
  if (id) insPost.run(id, p.content, `-${i * 3 + 1} hours`)
})

// Leaderboard points for demo users
const insPoints = db.prepare(`INSERT OR IGNORE INTO leaderboard_points (user_id, points, action) VALUES (?,?,?)`)
users.forEach(u => {
  if (u.username === 'admin') return
  const pts = Math.floor(Math.random() * 600) + 100
  insPoints.run(u.id, pts, 'demo')
})

// Demo observations
const sites = db.prepare(`SELECT id FROM sites LIMIT 5`).all()
const insObs = db.prepare(`INSERT OR IGNORE INTO observations (site_id, observer_id, ph, dissolved_oxygen, turbidity, water_temp, conductivity, notes, observed_at) VALUES (?,?,?,?,?,?,?,?,datetime('now',?))`)
users.forEach((u, i) => {
  if (!sites.length) return
  const site = sites[i % sites.length]
  insObs.run(
    site.id, u.id,
    (6.8 + Math.random() * 1.4).toFixed(2),
    (7 + Math.random() * 3).toFixed(2),
    (1 + Math.random() * 5).toFixed(2),
    (12 + Math.random() * 8).toFixed(1),
    (300 + Math.random() * 200).toFixed(0),
    'Demo observation entry',
    `-${i * 6 + 1} hours`
  )
})

console.log('✅ Demo data added!')
console.log('   Users: elaine3, tester007, kiki, tester9, waterwatch (password: demo1234)')
