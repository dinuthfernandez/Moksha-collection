import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import Reveal from '../components/ui/Reveal'
import './Categories.css'

interface Category {
  id: string
  name: string
  image: string
  route: string
  description?: string
}

const CATEGORIES: Category[] = [
  {
    id: 'clothing',
    name: 'Clothing',
    image: '/assets/categories/clothing.jpg',
    route: '/clothing',
    description: 'Explore our exquisite clothing collection',
  },
  {
    id: 'clearance-sale',
    name: 'Clearance Sale',
    image: '/assets/categories/clearance-sale.jpg',
    route: '/clearance-sale',
    description: 'Amazing deals on selected items',
  },
  {
    id: 'materials',
    name: 'Materials',
    image: '/assets/categories/materials.jpg',
    route: '/materials',
    description: 'Discover premium fabric options',
  },
  {
    id: 'discounts',
    name: 'Discounts',
    image: '/assets/categories/discounts.jpg',
    route: '/discounts',
    description: 'Special offers and promotions',
  },
  {
    id: 'new-arrivals',
    name: 'New Arrivals',
    image: '/assets/categories/new-arrivals.jpg',
    route: '/new-arrivals',
    description: 'Latest additions to our collection',
  },
  {
    id: 'under-5bhd',
    name: 'Under 5 BHD',
    image: '/assets/categories/under-5bhd.jpg',
    route: '/under-5bhd',
    description: 'Affordable luxury within budget',
  },
  {
    id: 'accessories',
    name: 'Accessories',
    image: '/assets/categories/accessories.jpg',
    route: '/accessories',
    description: 'Complete your look with our accessories',
  },
]

export default function Categories() {
  return (
    <div className="page categories-page">
      <section className="categories-hero">
        <Reveal as="div" className="categories-hero-content">
          <span className="eyebrow">Shop by Category</span>
          <h1 className="page-title">Discover Collections</h1>
          <p className="page-subtitle">
            Browse through our carefully curated categories to find exactly what you're looking for
          </p>
        </Reveal>
      </section>

      <section className="container categories-grid-section">
        <div className="categories-grid">
          {CATEGORIES.map((category) => (
            <Reveal key={category.id} as="div">
              <Link to={category.route} className="category-card">
                <div className="category-card-image-wrapper">
                  <img src={category.image} alt={category.name} className="category-card-image" />
                  <div className="category-card-overlay" />
                </div>
                <div className="category-card-content">
                  <h3 className="category-card-title">{category.name}</h3>
                  {category.description && <p className="category-card-description">{category.description}</p>}
                  <div className="category-card-action">
                    <span>Explore</span>
                    <ArrowRight size={16} />
                  </div>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>
    </div>
  )
}
