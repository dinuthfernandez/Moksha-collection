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

  const value = useMemo<WishlistContextValue>(
    () => ({
      items,
      itemCount: items.length,
      isLoading,
      isSaved: (productId) => items.some((item) => item.product_id === productId),
      add: async (item) => {
        const saved = await addWishlistItem(item)
        setItems((current) => current.some((existing) => existing.product_id === saved.product_id)
          ? current
          : [saved, ...current])
      },
      remove: async (productId) => {
        await removeWishlistItem(productId)
        setItems((current) => current.filter((item) => item.product_id !== productId))
      },
      toggle: async (item) => {
        if (items.some((existing) => existing.product_id === item.product_id)) {
          await removeWishlistItem(item.product_id)
          setItems((current) => current.filter((existing) => existing.product_id !== item.product_id))
        } else {
          const saved = await addWishlistItem(item)
          setItems((current) => current.some((existing) => existing.product_id === saved.product_id)
            ? current
            : [saved, ...current])
        }
      },
    }),
    [isLoading, items],
  )

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>
}

export function useWishlist() {
  const context = useContext(WishlistContext)
  if (!context) throw new Error('useWishlist must be used within WishlistProvider')
  return context
}
