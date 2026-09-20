import { adminApi } from './adminClient'
import type {
  AdminCustomer,
  AdminCustomerDetail,
  AdminSettings,
  Campaign,
  DashboardStats,
  DeliveryRate,
  OrderDetail,
  OrderStatus,
  ReturnOrder,
} from '../types'

export const adminLogin = (password: string) => adminApi.post<{ access_token: string }>('/admin/login', { password })

export const getDashboardStats = () => adminApi.get<DashboardStats>('/admin/dashboard')

export const getAdminSettings = () => adminApi.get<AdminSettings>('/admin/settings')
export const updateAdminSettings = (payload: AdminSettings) => adminApi.put<AdminSettings>('/admin/settings', payload)

export const getDeliveryRates = () => adminApi.get<DeliveryRate[]>('/admin/delivery-rates')
export const updateDeliveryRate = (deliveryType: string, payload: { rate_bhd: number; description?: string | null }) =>
  adminApi.put<DeliveryRate>(`/admin/delivery-rates/${deliveryType}`, payload)

export const getAdminOrders = (status?: OrderStatus) =>
  adminApi.get<OrderDetail[]>(`/admin/orders${status ? `?status=${status}` : ''}`)
export const updateOrderStatus = (orderId: string, status: OrderStatus, cancelReason?: string) =>
  adminApi.put<OrderDetail>(`/admin/orders/${orderId}/status`, { status, cancel_reason: cancelReason })

export const getReturns = () => adminApi.get<ReturnOrder[]>('/admin/returns')
export const completeReturn = (orderId: string) => adminApi.put<OrderDetail>(`/admin/returns/${orderId}/complete`, {})

export const getAdminCustomers = (search?: string) =>
  adminApi.get<AdminCustomer[]>(`/admin/customers${search ? `?search=${encodeURIComponent(search)}` : ''}`)
export const getAdminCustomerDetail = (customerId: string) =>
  adminApi.get<AdminCustomerDetail>(`/admin/customers/${customerId}`)
export const setCustomerBan = (customerId: string, isBanned: boolean) =>
  adminApi.put<AdminCustomer>(`/admin/customers/${customerId}/ban?is_banned=${isBanned}`)

export const getCampaigns = () => adminApi.get<Campaign[]>('/admin/campaigns')
export const sendCampaign = (subject: string, body: string) =>
  adminApi.post<Campaign>('/admin/campaigns', { subject, body })
