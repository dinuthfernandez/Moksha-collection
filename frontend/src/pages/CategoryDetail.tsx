import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getCategoryBySlug } from '../api/categories'
import type { Category } from '../types'
import EmptyState from '../components/ui/EmptyState'
import './CategoryDetail.css'

export default function CategoryDetail() {
  const { slug } = useParams<{ slug: string }>()
  const [category, setCategory] = useState<Category | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!slug) return
    let mounted = true
    setLoading(true)
    getCategoryBySlug(slug)
      .then((data) => mounted && setCategory(data))
      .catch(() => mounted && setCategory(null))
      .finally(() => mounted && setLoading(false))
    return () => {
      mounted = false
    }
  }, [slug])

  if (loading) return <div className="container category-detail" />

  return (
    <div className="container category-detail">
      <div className="section-heading">
        <span className="eyebrow">{category?.type === 'accessories' ? 'Accessories' : 'Clothing'}</span>
        <h1 className="section-title">{category?.name ?? 'Collection'}</h1>
      </div>

      <EmptyState
        title="Products Coming Soon"
        message="This edit is being finalised. Message us on WhatsApp and we'll notify you the moment it launches."
      />

      <div className="category-detail-back">
        <Link to={category?.type ? `/${category.type}` : '/'} className="btn btn-outline">
          Back to {category?.type === 'accessories' ? 'Accessories' : 'Clothing'}
        </Link>
      </div>
    </div>
  )
}
