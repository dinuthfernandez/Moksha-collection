import { api } from './client'
import type { ContactPayload } from '../types'

export function sendContactMessage(payload: ContactPayload) {
  return api.post<{ id: string }>('/contact', payload)
}
