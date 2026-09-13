import { api } from './client'
import type { SizeChart } from '../types'

export function getSizeCharts() {
  return api.get<SizeChart[]>('/size-charts')
}
