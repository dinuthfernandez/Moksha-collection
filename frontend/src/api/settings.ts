import { api } from './client'
import type { PublicSettings } from '../types'

export const getPublicSettings = () => api.get<PublicSettings>('/settings')
