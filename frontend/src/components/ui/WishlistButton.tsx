import { Heart } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useWishlist } from '../../context/WishlistContext'
import type { WishlistItemPayload } from '../../types'
import './WishlistButton.css'

export default function WishlistButton({ item }: { item: WishlistItemPayload }) {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const { isSaved, toggle } = useWishlist()
  const saved = isSaved(item.product_id)

  const onClick = async () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: '/wishlist' } })
      return
    }
    await toggle(item)
  }

  return (
    <button
      type="button"
      className={`wishlist-button${saved ? ' is-saved' : ''}`}
      aria-label={saved ? `Remove ${item.product_name} from wishlist` : `Add ${item.product_name} to wishlist`}
      aria-pressed={saved}
      onClick={() => void onClick()}
    >
      <Heart size={18} fill={saved ? 'currentColor' : 'none'} />
    </button>
  )
}
