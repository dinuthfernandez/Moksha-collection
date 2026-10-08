import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { setCartReservation } from '../api/cart'
import { ApiError } from '../api/client'
import type { CartItem } from '../types'

const STORAGE_KEY = 'moksha-cart'
const RESERVATION_ID_KEY = 'moksha-cart-reservation-id'

interface CartContextValue {
  items: CartItem[]
  reservationToken: string
  reservationBusy: boolean
  reservationError: string | null
  addItem: (item: CartItem) => Promise<boolean>
  removeItem: (id: string) => Promise<boolean>
  updateQuantity: (id: string, quantity: number) => Promise<boolean>
  retryReservations: () => Promise<boolean>
  clear: () => void
  itemCount: number
  subtotal: number
}

const CartContext = createContext<CartContextValue | undefined>(undefined)

function createReservationToken(): string {
  const saved = localStorage.getItem(RESERVATION_ID_KEY)
  if (saved) return saved
  const token = crypto.randomUUID()
  localStorage.setItem(RESERVATION_ID_KEY, token)
  return token
}

function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const items = raw ? (JSON.parse(raw) as CartItem[]) : []
    return items.filter((item) => !item.hold_expires_at || Date.parse(item.hold_expires_at) > Date.now())
  } catch {
    return []
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(loadCart)
  const [reservationToken] = useState(createReservationToken)
  const [reservationBusy, setReservationBusy] = useState(false)
  const [reservationError, setReservationError] = useState<string | null>(null)
  const itemsRef = useRef(items)
  const mutationQueue = useRef<Promise<void>>(Promise.resolve())
  const pendingMutations = useRef(0)

  const commitItems = (nextItems: CartItem[]) => {
    itemsRef.current = nextItems
    setItems(nextItems)
  }

  const reserveProductQuantity = async (cartItems: CartItem[], productId: string) => {
    const quantity = cartItems
      .filter((item) => item.id === productId)
      .reduce((total, item) => total + item.quantity, 0)
    const reservation = await setCartReservation(reservationToken, productId, quantity)
    return cartItems.map((item) => item.id === productId
      ? { ...item, hold_expires_at: reservation.expires_at ?? undefined }
      : item)
  }

  const enqueueMutation = (operation: () => Promise<void>): Promise<boolean> => {
    pendingMutations.current += 1
    setReservationBusy(true)
    const result = mutationQueue.current.then(operation).then(() => {
      setReservationError(null)
      return true
    }).catch((error: unknown) => {
      setReservationError(error instanceof ApiError ? error.message : 'Could not reserve cart stock. Please retry.')
      return false
    }).finally(() => {
      pendingMutations.current -= 1
      setReservationBusy(pendingMutations.current > 0)
    })
    mutationQueue.current = result.then(() => undefined)
    return result
  }

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items])

  const applyOptimistically = (productId: string, change: (current: CartItem[]) => CartItem[]) => {
    const before = itemsRef.current
    commitItems(change(before))
    const previousLines = before.filter((item) => item.id === productId)
    return enqueueMutation(async () => {
      try {
        commitItems(await reserveProductQuantity(itemsRef.current, productId))
      } catch (error) {
        commitItems([...itemsRef.current.filter((item) => item.id !== productId), ...previousLines])
        throw error
      }
    })
  }

  const addItem = (item: CartItem) => applyOptimistically(item.id, (current) => {
    const existing = current.find((entry) => entry.id === item.id && entry.size === item.size && entry.color === item.color)
    return existing
      ? current.map((entry) => entry === existing ? { ...entry, quantity: entry.quantity + item.quantity } : entry)
      : [...current, item]
  })

  const removeItem = (id: string) => applyOptimistically(id, (current) => current.filter((item) => item.id !== id))

  const updateQuantity = (id: string, quantity: number) => applyOptimistically(id, (current) =>
    current.map((item) => item.id === id ? { ...item, quantity: Math.max(1, quantity) } : item))

  const retryReservations = () => enqueueMutation(async () => {
    let next = itemsRef.current
    const productIds = [...new Set(next.map((item) => item.id))]
    for (const productId of productIds) {
      next = await reserveProductQuantity(next, productId)
    }
    commitItems(next)
  })

  useEffect(() => {
    if (itemsRef.current.length > 0) void retryReservations()
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now()
      const current = itemsRef.current
      const expired = current.some((item) => item.hold_expires_at && Date.parse(item.hold_expires_at) <= now)
      if (expired) {
        commitItems(current.filter((item) => !item.hold_expires_at || Date.parse(item.hold_expires_at) > now))
        setReservationError('A cart hold expired and the item was removed. Add it again to reserve current stock.')
      }
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  const clear = () => {
    commitItems([])
    setReservationError(null)
  }

  const itemCount = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items])
  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.quantity * item.price, 0), [items])

  return (
    <CartContext.Provider value={{
      items,
      reservationToken,
      reservationBusy,
      reservationError,
      addItem,
      removeItem,
      updateQuantity,
      retryReservations,
      clear,
      itemCount,
      subtotal,
    }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within a CartProvider')
  return ctx
}
