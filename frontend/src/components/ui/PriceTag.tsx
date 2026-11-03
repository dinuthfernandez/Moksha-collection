import './PriceTag.css'

interface PriceTagProps {
  price: number | null | undefined
  originalPrice?: number | null
  className?: string
}

const bhd = (value: number | null | undefined) => `BHD ${Number(value || 0).toFixed(3)}`

/** Normal price, or — when a discount is running — the old price struck through and the new one highlighted. */
export default function PriceTag({ price, originalPrice, className = '' }: PriceTagProps) {
  if (originalPrice == null || originalPrice <= Number(price || 0)) {
    return <span className={className}>{bhd(price)}</span>
  }
  const percentOff = Math.max(1, Math.round((1 - Number(price || 0) / originalPrice) * 100))
  return (
    <span className={`price-tag ${className}`}>
      <s className="price-tag-was" aria-label={`Original price ${bhd(originalPrice)}`}>{bhd(originalPrice)}</s>
      <strong className="price-tag-now">{bhd(price)}</strong>
      <span className="price-tag-off" aria-label={`${percentOff} percent off`}>{percentOff}% OFF</span>
    </span>
  )
}
