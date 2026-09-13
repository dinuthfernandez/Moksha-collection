import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Sparkles } from 'lucide-react'
import { getCategories } from '../../api/categories'
import type { Category, CategoryType } from '../../types'
import './RoundCategories.css'

interface RoundCategoriesProps {
  title?: string
  eyebrow?: string
}

export default function RoundCategories({
  title = 'Top Categories',
  eyebrow = 'Curated Selections',
}: RoundCategoriesProps) {
  const [activeTab, setActiveTab] = useState<'all' | CategoryType>('all')
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    getCategories()
      .then((data) => {
        if (mounted) setCategories(data)
      })
      .catch(() => {
        if (mounted) setCategories([])
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  const filteredCategories = categories.filter((cat) => {
    if (activeTab === 'all') return true
    return cat.type === activeTab
  })

  // When database has 0 categories (kept empty per instructions),
  // we show the complete round category UI structure with elegant ready placeholders
  const placeholderSlots = [
    { label: 'Dresses', sublabel: 'Silhouettes' },
    { label: 'Kurti Sets', sublabel: 'Contemporary' },
    { label: 'Co-Ord Sets', sublabel: 'Matching Pairs' },
    { label: 'Jewellery', sublabel: 'Statement Sets' },
    { label: 'Earrings', sublabel: 'Artisan Finish' },
    { label: 'Necklaces', sublabel: 'Finishing Touches' },
    { label: 'Bespoke', sublabel: 'Limited Edition' },
  ]

  return (
    <section className="round-categories-section">
      <div className="round-categories-header">
        <div className="round-categories-heading">
          <span className="eyebrow">{eyebrow}</span>
          <h2 className="round-categories-title">{title}</h2>
        </div>

        {/* Tab Filters */}
        <div className="round-categories-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'all'}
            className={`category-tab-btn ${activeTab === 'all' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'clothing'}
            className={`category-tab-btn ${activeTab === 'clothing' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('clothing')}
          >
            Clothing
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'accessories'}
            className={`category-tab-btn ${activeTab === 'accessories' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('accessories')}
          >
            Accessories
          </button>
        </div>

        {/* View All Link */}
        <Link
          to={activeTab === 'accessories' ? '/accessories' : '/clothing'}
          className="round-categories-view-all"
        >
          <span>View all</span>
          <ArrowRight size={16} />
        </Link>
      </div>

      {/* Round Categories Carousel / Row */}
      <div className="round-categories-scroll-wrapper">
        <div className="round-categories-track">
          {!loading && filteredCategories.length > 0 ? (
            // Live Categories from Supabase moksha_collection.categories
            filteredCategories.map((cat) => (
              <Link
                key={cat.id}
                to={`/${cat.type}/${cat.slug}`}
                className="round-category-item"
              >
                <div className="round-category-circle">
                  {cat.image_url ? (
                    <img src={cat.image_url} alt={cat.name} className="round-category-img" />
                  ) : (
                    <div className="round-category-fallback">
                      <span>{cat.name.charAt(0)}</span>
                    </div>
                  )}
                  <div className="round-category-glow" />
                </div>
                <span className="round-category-label">{cat.name}</span>
                <span className="round-category-tag">{cat.type}</span>
              </Link>
            ))
          ) : (
            // Empty State UI: Elegant Round Category Shells ready for launch
            placeholderSlots.map((slot, index) => (
              <Link
                key={index}
                to={index < 3 ? '/clothing' : '/accessories'}
                className="round-category-item is-placeholder"
              >
                <div className="round-category-circle">
                  <div className="round-category-placeholder-content">
                    <Sparkles size={20} className="round-category-sparkle" />
                    <span className="round-category-monogram">MC</span>
                  </div>
                  <div className="round-category-glow" />
                </div>
                <span className="round-category-label">{slot.label}</span>
                <span className="round-category-tag">{slot.sublabel}</span>
              </Link>
            ))
          )}
        </div>
      </div>
    </section>
  )
}
