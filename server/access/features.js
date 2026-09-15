// ── Access control: the canonical list of user-facing features (tabs) that
// an admin can turn on/off per role or per user. Admin Panel and Quiz Manager
// are intentionally NOT here — those stay on their own privilege gates
// (is_admin / quiz-creator role) and can't be handed out by a toggle.
// `key` is the stable id stored in the DB; `path` matches the client route.
const FEATURES = [
  { key: 'dashboard',   label: 'Dashboard',        path: '/dashboard' },
  { key: 'quick',       label: 'Quick Actions',    path: '/quick-actions' },
  { key: 'ask-water',   label: 'Ask Water (AI)',   path: '/ask-water' },
  { key: 'monitoring',  label: 'Site Map',         path: '/monitoring' },
  { key: 'alerts',      label: 'Alerts',           path: '/alerts' },
  { key: 'social',      label: 'Community',        path: '/social' },
  { key: 'resources',   label: 'Resources',        path: '/resources' },
  { key: 'quiz',        label: 'Quiz Yourself',    path: '/quiz' },
  { key: 'games',       label: 'Games',            path: '/games' },
  { key: 'explorer',    label: 'Dive into Data',   path: '/explorer' },
  { key: 'ai-lab',      label: 'Wet Lab',          path: '/ai-lab' },
  { key: 'weather',     label: 'World Environment', path: '/weather' },
  { key: 'reports',     label: 'Reports',          path: '/reports' },
  { key: 'analysis',    label: 'Analysis',         path: '/analysis' },
  { key: 'projects',    label: 'Projects',         path: '/projects' },
  { key: 'research',    label: 'Research Hub',     path: '/research' },
]

const FEATURE_KEYS = new Set(FEATURES.map(f => f.key))

// The roles an admin can set defaults for (must match the app's role names).
const ROLES = ['Community member', 'Teacher', 'Professor', 'Researcher', 'SOURCE Water team member']

module.exports = { FEATURES, FEATURE_KEYS, ROLES }
