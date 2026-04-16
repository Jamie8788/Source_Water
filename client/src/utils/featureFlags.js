/**
 * Feature Flags — Controls GLB mascot rollout
 * Phase 1: GLB mascot on /ask-water only with feature flag control
 */

export const isGLBMascotEnabled = () => {
  return import.meta.env.VITE_GLB_MASCOT_ENABLED === 'true'
}

export const getGLBTargetPages = () => {
  const targets = import.meta.env.VITE_GLB_TARGET_PAGES || '/ask-water'
  return targets.split(',').map(p => p.trim())
}

export const isGLBTargetPage = (pathname) => {
  return getGLBTargetPages().includes(pathname)
}

