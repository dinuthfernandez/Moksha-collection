import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { getProductReviews } from '../../api/reviews'
import type { ProductReview, ProductReviewList } from '../../types'
import './ProductReviews.css'

const PAGE_SIZE = 3

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(value))
}

export default function ProductReviews({
  productId,
  onSummaryChange,
}: {
  productId: string
  onSummaryChange: (summary: Pick<ProductReviewList, 'total' | 'average_rating'>) => void
}) {
  const [reviews, setReviews] = useState<ProductReview[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(false)

  const loadMoreReviews = async () => {
    if (loadingMore) return
    setLoadingMore(true)
    setError(false)
    try {
      const result = await getProductReviews(productId, reviews.length, PAGE_SIZE)
      setReviews((current) => [...current, ...result.items])
      setTotal(result.total)
      onSummaryChange({ average_rating: result.average_rating, total: result.total })
    } catch {
      setError(true)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    let active = true
    setReviews([])
    setTotal(0)
    setLoading(true)
    setError(false)
    getProductReviews(productId, 0, PAGE_SIZE)
      .then((result) => {
        if (!active) return
        setReviews(result.items)
        setTotal(result.total)
        onSummaryChange({ average_rating: result.average_rating, total: result.total })
      })
      .catch(() => active && setError(true))
      .finally(() => active && setLoading(false))

    return () => {
      active = false
    }
  }, [productId])

  return (
    <section className="product-reviews" aria-labelledby="product-reviews-title">
      <div>
        <span className="eyebrow">Customer Notes</span>
        <h2 id="product-reviews-title">Reviews</h2>
      </div>

      {loading ? (
        <p className="product-reviews-message">Loading reviews…</p>
      ) : error && reviews.length === 0 ? (
        <p className="product-reviews-message product-reviews-error">Reviews could not be loaded. Please try again later.</p>
      ) : reviews.length === 0 ? (
        <p className="product-reviews-message">No reviews yet.</p>
      ) : (
        <div className="product-review-list">
          {reviews.map((review) => (
            <article className="product-review" key={review.id}>
              <div className="product-review-topline">
                <div>
                  <h3>{review.reviewer_name}</h3>
                  <span className="product-review-date">{formatDate(review.created_at)}</span>
                </div>
                <span className="product-review-stars" aria-label={`${review.rating} out of 5 stars`}>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <Star key={value} size={15} fill={value <= review.rating ? 'currentColor' : 'none'} />
                  ))}
                </span>
              </div>
              {review.comment && <p className="product-review-comment">{review.comment}</p>}
            </article>
          ))}
        </div>
      )}

      {error && reviews.length > 0 && <p className="product-reviews-message product-reviews-error">Could not load more reviews.</p>}
      {reviews.length < total && !loading && (
        <button type="button" className="btn btn-outline product-reviews-more" disabled={loadingMore} onClick={() => void loadMoreReviews()}>
          {loadingMore ? 'Loading…' : 'See more reviews'}
        </button>
      )}
    </section>
  )
}
