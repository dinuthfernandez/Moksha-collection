import { api } from './client'
import { adminApi } from './adminClient'

export type AnalyticsSource = 'facebook' | 'instagram' | 'youtube' | 'whatsapp' | 'tiktok' | 'linkedin' | 'email' | 'google' | 'direct' | 'other'

export interface AnalyticsChannel {
  source: AnalyticsSource
  visits: number
  last_visit: string | null
}

export interface WebsiteAnalytics {
  total_visits: number
  channels: AnalyticsChannel[]
}

export function recordVisit(visitId: string, source: AnalyticsSource) {
  return api.post<{ recorded: boolean }>('/analytics/visit', { visit_id: visitId, source })
}

export function getWebsiteAnalytics() {
  return adminApi.get<WebsiteAnalytics>('/admin/analytics')
}

export function clearWebsiteAnalytics(confirmation: string) {
  return adminApi.post<{ deleted: number }>('/admin/analytics/clear', { confirmation })
}