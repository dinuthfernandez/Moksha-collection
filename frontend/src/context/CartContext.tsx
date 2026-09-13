import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { CartItem } from '../types'

const STORAGE_KEY = 'moksha-cart'

interface CartContextValue {
  items: CartItem[]
  addItem: (item: CartItem) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, quantity: number) => void
  clear: () => void
  itemCount: number
  subtotal: number
}

const CartContext = createContext<CartContextValue | undefined>(undefined)

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? (JSON.parse(raw) as CartItem[]) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items])

  const addItem = (item: CartItem) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.id === item.id && i.size === item.size && i.color === item.color)
      if (existing) {
        return prev.map((i) => (i === existing ? { ...i, quantity: i.quantity + item.quantity } : i))
      }
      return [...prev, item]
    })
  }

  const removeItem = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id))

  const updateQuantity = (id: string, quantity: number) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, quantity: Math.max(1, quantity) } : i)))

  const clear = () => setItems([])

  const itemCount = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items])
  const subtotal = useMemo(() => items.reduce((sum, i) => sum + i.quantity * i.price, 0), [items])

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clear, itemCount, subtotal }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within a CartProvider')
  return ctx
}
