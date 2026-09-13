import { api } from './client'
import type { Announcement } from '../types'

export function getAnnouncements() {
  return api.get<Announcement[]>('/announcements')
}
