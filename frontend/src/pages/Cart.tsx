import { Link } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import EmptyState from '../components/ui/EmptyState'
import './Cart.css'

export default function Cart() {
  const { items, removeItem, updateQuantity, subtotal } = useCart()

  return (
    <div className="container cart-page">
      <div className="section-heading">
        <span className="eyebrow">Your Bag</span>
        <h1 className="section-title">Shopping Cart</h1>
      </div>

      {items.length === 0 ? (
        <EmptyState title="Your Cart Is Empty" message="Browse Clothing or Accessories to find something you'll love." />
      ) : (
        <div className="cart-layout">
          <ul className="cart-items">
            {items.map((item) => (
              <li key={`${item.id}-${item.size}-${item.color}`} className="cart-item">
                {item.image_url && <img src={item.image_url} alt={item.name} />}
                <div className="cart-item-info">
                  <h3>{item.name}</h3>
                  {item.size && <span>Size: {item.size}</span>}
                  {item.color && <span>Color: {item.color}</span>}
                  <div className="cart-item-qty">
                    <button onClick={() => updateQuantity(item.id, item.quantity - 1)}>-</button>
                    <span>{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</button>
                  </div>
                </div>
                <div className="cart-item-price">{(item.price * item.quantity).toFixed(2)} BHD</div>
                <button className="cart-item-remove" onClick={() => removeItem(item.id)} aria-label="Remove">
                  &times;
                </button>
              </li>
            ))}
          </ul>

          <div className="cart-summary">
            <div className="cart-summary-row">
              <span>Subtotal</span>
              <strong>{subtotal.toFixed(2)} BHD</strong>
            </div>
            <Link to="/checkout" className="btn btn-primary">
              Proceed to Purchase
            </Link>
            <Link to="/clothing" className="btn btn-outline">
              Continue Shopping
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
