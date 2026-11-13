import { api } from './client'

export interface HomeBanner {
  id: string
  image_url: string
}

export interface PublicBanners {
  enabled: boolean
  interval_seconds: number
  banners: HomeBanner[]
}

export const getPublicBanners = () => api.get<PublicBanners>('/banners')
