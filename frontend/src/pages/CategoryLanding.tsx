import { useEffect, useState } from 'react'
import { getCategoryTree } from '../api/categories'
import type { Category, CategoryType } from '../types'
import CategoryCard from '../components/ui/CategoryCard'
import EmptyState from '../components/ui/EmptyState'
import './CategoryLanding.css'

interface CategoryLandingProps {
  type: CategoryType
  title: string
  description: string
}

export default function CategoryLanding({ type, title, description }: CategoryLandingProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    getCategoryTree(type)
      .then((data) => mounted && setCategories(data))
      .catch(() => mounted && setCategories([]))
      .finally(() => mounted && setLoading(false))
    return () => {
      mounted = false
    }
  }, [type])

  return (
    <div className="container category-landing">
      <div className="section-heading">
        <span className="eyebrow">{type === 'clothing' ? 'Clothing' : 'Accessories'}</span>
        <h1 className="section-title">{title}</h1>
        <p className="section-subtitle">{description}</p>
      </div>

      {!loading && categories.length === 0 && (
        <EmptyState
          title="New Arrivals Launching Soon"
          message="We're curating this collection with care. Follow our WhatsApp and Instagram for the first look."
        />
      )}

      {categories.length > 0 && (
        <div className="category-landing-grid">
          {categories.map((c) => (
            <CategoryCard key={c.id} category={c} basePath={`/${type}`} />
          ))}
        </div>
      )}
    </div>
  )
}
