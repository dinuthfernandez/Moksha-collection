import { Minus, Plus } from 'lucide-react'
import './ProductQuantitySelector.css'

interface ProductQuantitySelectorProps {
  quantity: number
  max: number
  onChange: (quantity: number) => void
  className?: string
}

export default function ProductQuantitySelector({ quantity, max, onChange, className = '' }: ProductQuantitySelectorProps) {
  const safeMax = Math.max(1, max)
  const setClampedQuantity = (value: number) => {
    if (!Number.isFinite(value)) return
    onChange(Math.min(safeMax, Math.max(1, Math.floor(value))))
  }

  return (
    <div className={`product-quantity-selector ${className}`}>
      <span className="product-quantity-label">Quantity</span>
      <div className="product-quantity-control" role="group" aria-label="Select product quantity">
        <button
          type="button"
          className="product-quantity-step"
          aria-label="Decrease quantity"
          disabled={quantity <= 1 || max <= 0}
          onClick={() => setClampedQuantity(quantity - 1)}
        >
          <Minus size={16} aria-hidden="true" />
        </button>
        <input
          type="number"
          min={1}
          max={safeMax}
          step={1}
          inputMode="numeric"
          aria-label="Quantity"
          value={quantity}
          disabled={max <= 0}
          onChange={(event) => setClampedQuantity(Number(event.target.value))}
          onBlur={() => setClampedQuantity(quantity)}
        />
        <button
          type="button"
          className="product-quantity-step"
          aria-label="Increase quantity"
          disabled={quantity >= max || max <= 0}
          onClick={() => setClampedQuantity(quantity + 1)}
        >
          <Plus size={16} aria-hidden="true" />
        </button>
      </div>
      <span className="product-quantity-stock">{max} available</span>
    </div>
  )
}
