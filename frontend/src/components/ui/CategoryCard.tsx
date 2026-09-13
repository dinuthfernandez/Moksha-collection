import { Link } from 'react-router-dom'
import type { Category } from '../../types'
import './CategoryCard.css'

export default function CategoryCard({ category, basePath }: { category: Category; basePath: string }) {
  return (
    <Link to={`${basePath}/${category.slug}`} className="category-card">
      <div className="category-card-media">
        {category.image_url ? (
          <img src={category.image_url} alt={category.name} />
        ) : (
          <div className="category-card-placeholder" />
        )}
      </div>
      <div className="category-card-meta">
        <h3>{category.name}</h3>
        <span>Explore</span>
      </div>
    </Link>
  )
}
