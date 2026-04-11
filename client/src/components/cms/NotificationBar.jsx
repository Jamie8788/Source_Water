/**
 * NotificationBar — Site-wide alert banner.
 * Reads notification settings from CMSContext (loaded from Supabase cms_site_settings).
 * Visible to ALL users when enabled. Real-time updates via Supabase subscription.
 * Dismissible per session via sessionStorage.
 */
import { useState, useEffect } from 'react'
import { useCMS } from '../../context/CMSContext'
import { X, AlertTriangle, Info, CheckCircle, AlertCircle, Bell } from 'lucide-react'

const STYLES = {
  warning:  { bg: '#fef3c7', border: '#f59e0b', text: '#92400e', icon: <AlertTriangle size={16}/> },
  alert:    { bg: '#fee2e2', border: '#ef4444', text: '#991b1b', icon: <AlertCircle size={16}/> },
  info:     { bg: 'linear-gradient(90deg,#1e1b4b,#312e81)', border: '#6366f1', text: '#e0e7ff', icon: <Info size={16}/> },
  success:  { bg: '#d1fae5', border: '#10b981', text: '#065f46', icon: <CheckCircle size={16}/> },
  announce: { bg: 'linear-gradient(90deg,#0f172a,#1e293b)', border: '#14b8a6', text: '#ccfbf1', icon: <Bell size={16}/> },
}

const ICONS = {
  warning: <AlertTriangle size={16}/>,
  alert: <AlertCircle size={16}/>,
  info: <Info size={16}/>,
  success: <CheckCircle size={16}/>,
  bell: <Bell size={16}/>,
  none: null,
}

export default function NotificationBar() {
  const { notification } = useCMS()
  const [dismissed, setDismissed] = useState(false)

  // Check sessionStorage on mount and when notification changes
  useEffect(() => {
    if (!notification?.message) return
    const key = `sw_notif_dismissed_${btoa(notification.message).slice(0, 20)}`
    setDismissed(sessionStorage.getItem(key) === '1')
  }, [notification?.message])

  if (!notification?.enabled || !notification?.message || dismissed) return null

  const style = STYLES[notification.style] || STYLES.info
  const icon = ICONS[notification.icon] ?? style.icon

  const dismiss = () => {
    const key = `sw_notif_dismissed_${btoa(notification.message).slice(0, 20)}`
    sessionStorage.setItem(key, '1')
    setDismissed(true)
  }

  const isGradient = typeof style.bg === 'string' && style.bg.startsWith('linear')

  return (
    <div
      data-cms-ui="true"
      style={{
        position: 'relative',
        zIndex: 10000,
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        padding: '9px 48px 9px 16px',
        background: style.bg,
        borderBottom: `2px solid ${style.border}`,
        color: style.text,
        fontSize: 13,
        fontWeight: 600,
        fontFamily: 'system-ui, sans-serif',
        lineHeight: '1.4',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      }}
    >
      {icon && <span style={{ flexShrink: 0, opacity: 0.9 }}>{icon}</span>}
      <span dangerouslySetInnerHTML={{ __html: notification.message }} />
      <button
        onClick={dismiss}
        title="Dismiss"
        style={{
          position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
          background: 'none', border: 'none', cursor: 'pointer',
          color: style.text, opacity: 0.7, padding: 4, display: 'flex',
        }}
      >
        <X size={14}/>
      </button>
    </div>
  )
}
