import { api } from './client'
import { adminApi } from './adminClient'

export interface HomeBanner {
  id: string
  image_url: string
}

export interface PublicBanners {
  enabled: boolean
  interval_seconds: number
  banners: HomeBanner[]
}

export interface AdminBanner extends HomeBanner {
  is_active: boolean
  display_order: number
}

export interface AdminBanners {
  section_enabled: boolean
  interval_seconds: number
  banners: AdminBanner[]
}

export const getPublicBanners = () => api.get<PublicBanners>('/banners')

export const getAdminBanners = () => adminApi.get<AdminBanners>('/admin/banners')
export const uploadBanner = (dataUrl: string) => adminApi.post<AdminBanners>('/admin/banners', { data_url: dataUrl })
export const updateBannerSettings = (section_enabled: boolean, interval_seconds: number) =>
  adminApi.put<AdminBanners>('/admin/banners/settings', { section_enabled, interval_seconds })
export const setBannerActive = (id: string, is_active: boolean) =>
  adminApi.put<AdminBanners>(`/admin/banners/${id}`, { is_active })
export const reorderBanners = (ids: string[]) => adminApi.put<AdminBanners>('/admin/banners/order/save', { ids })
export const deleteBanner = (id: string) => adminApi.delete<AdminBanners>(`/admin/banners/${id}`)
