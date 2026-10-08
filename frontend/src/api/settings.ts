import { cachedGet } from './client'
import type { PublicSettings } from '../types'

export const getPublicSettings = () => cachedGet<PublicSettings>('/settings', 120_000)
