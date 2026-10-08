import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { addWishlistItem, getWishlist, removeWishlistItem } from '../api/wishlist'
import { useAuth } from './AuthContext'
import type { WishlistItem, WishlistItemPayload } from '../types'

interface WishlistContextValue {
  items: WishlistItem[]
  itemCount: number
  isLoading: boolean
  isSaved: (productId: string) => boolean
  add: (item: WishlistItemPayload) => Promise<void>
  remove: (productId: string) => Promise<void>
  toggle: (item: WishlistItemPayload) => Promise<void>
}

const WishlistContext = createContext<WishlistContextValue | undefined>(undefined)

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { customer } = useAuth()
  const [items, setItems] = useState<WishlistItem[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!customer) {
      setItems([])
      return
    }
    let mounted = true
    setIsLoading(true)
    getWishlist()
      .then((data) => mounted && setItems(data))
      .finally(() => mounted && setIsLoading(false))
    return () => {
      mounted = false
    }
  }, [customer])

  const value = useMemo<WishlistContextValue>(() => {
    const addOptimistic = async (item: WishlistItemPayload) => {
      if (items.some((existing) => existing.product_id === item.product_id)) return
      const temp: WishlistItem = {
        ...item,
        id: `temp-${item.product_id}`,
        customer_id: customer?.id ?? '',
        created_at: new Date().toISOString(),
      }
      setItems((current) => [temp, ...current])
      try {
        const saved = await addWishlistItem(item)
        setItems((current) => current.map((existing) => existing.id === temp.id ? saved : existing))
      } catch (error) {
        setItems((current) => current.filter((existing) => existing.id !== temp.id))
        throw error
      }
    }
    const removeOptimistic = async (productId: string) => {
      const previous = items.find((item) => item.product_id === productId)
      setItems((current) => current.filter((item) => item.product_id !== productId))
      try {
        await removeWishlistItem(productId)
      } catch (error) {
        if (previous) setItems((current) => [previous, ...current])
        throw error
      }
    }
    return {
      items,
      itemCount: items.length,
      isLoading,
      isSaved: (productId) => items.some((item) => item.product_id === productId),
      add: addOptimistic,
      remove: removeOptimistic,
      toggle: (item) =>
        items.some((existing) => existing.product_id === item.product_id)
          ? removeOptimistic(item.product_id)
          : addOptimistic(item),
    }
  }, [isLoading, items, customer])

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>
}

export function useWishlist() {
  const context = useContext(WishlistContext)
  if (!context) throw new Error('useWishlist must be used within WishlistProvider')
  return context
}
