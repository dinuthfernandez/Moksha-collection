import { api } from './client'
import type { OrderCreatePayload, OrderCreateResult, OrderDetail } from '../types'

export const createOrder = (payload: OrderCreatePayload) => api.post<OrderCreateResult>('/orders', payload)
export const getMyOrders = () => api.get<OrderDetail[]>('/orders/mine')
export const requestOrderReturn = (orderId: string) => api.post<OrderDetail>(`/orders/${orderId}/return`, {})
