import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { recordVisit, type AnalyticsSource } from '../../api/analytics'

const SESSION_KEY = 'moksha-analytics-session'
const SESSION_IDLE_MS = 30 * 60 * 1000
const SOURCES = new Set<AnalyticsSource>([
  'facebook', 'instagram', 'youtube', 'whatsapp', 'tiktok', 'linkedin', 'email', 'google', 'direct', 'other',
])

function getLandingSource(search: string): AnalyticsSource {
  const value = new URLSearchParams(search).get('utm_source')?.trim().toLowerCase()
  return value && SOURCES.has(value as AnalyticsSource) ? value as AnalyticsSource : value ? 'other' : 'direct'
}

export default function WebsiteVisitTracker() {
  const { pathname, search } = useLocation()

  useEffect(() => {
    let stored: { visit_id: string; last_seen: number } | null = null
    try {
      stored = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null')
    } catch {
      stored = null
    }

    const now = Date.now()
    if (stored && now - stored.last_seen < SESSION_IDLE_MS) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...stored, last_seen: now }))
      return
    }

    const visitId = crypto.randomUUID()
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ visit_id: visitId, last_seen: now }))
    void recordVisit(visitId, getLandingSource(search)).catch(() => undefined)
  }, [pathname, search])

  return null
}