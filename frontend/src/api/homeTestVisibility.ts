import { api } from './client'
import { adminApi } from './adminClient'

export interface HomeTestVisibility {
  under_5: boolean
  clearance: boolean
  discounts: boolean
}

export const getHomeTestVisibility = () => api.get<HomeTestVisibility>('/home-test-visibility')
export const saveHomeTestVisibility = (settings: HomeTestVisibility) =>
  adminApi.put<HomeTestVisibility>('/admin/home-test-visibility', settings)
