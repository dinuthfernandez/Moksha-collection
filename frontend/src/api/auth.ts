import { api } from './client'
import type { AuthResponse, Customer, CustomerUpdatePayload, LoginPayload, RegisterPayload } from '../types'

export function registerCustomer(payload: RegisterPayload) {
  return api.post<AuthResponse>('/auth/register', payload)
}

export function loginCustomer(payload: LoginPayload) {
  return api.post<AuthResponse>('/auth/login', payload)
}

export function getMyProfile() {
  return api.get<Customer>('/auth/me')
}

export function updateMyProfile(payload: CustomerUpdatePayload) {
  return api.put<Customer>('/auth/me', payload)
}
