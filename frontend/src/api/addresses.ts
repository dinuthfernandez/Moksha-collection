import { api } from './client'
import type { Address, AddressPayload } from '../types'

export function getAddresses() {
  return api.get<Address[]>('/addresses')
}

export function createAddress(payload: AddressPayload) {
  return api.post<Address>('/addresses', payload)
}

export function updateAddress(id: string, payload: AddressPayload) {
  return api.put<Address>(`/addresses/${id}`, payload)
}

export function deleteAddress(id: string) {
  return api.delete<void>(`/addresses/${id}`)
}
