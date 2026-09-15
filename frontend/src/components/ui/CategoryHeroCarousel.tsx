import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import './CategoryHeroCarousel.css'

interface HeroSet {
  large: string
  smallTop: string
  smallBottom: string
}

interface CategoryHeroCarouselProps {
  eyebrow: string
  title: string
  highlight: string
  subtitle: string
  sets: HeroSet[]
}

// Asymmetric 1-large + 2-stacked-small image arrangement, cycling through
// multiple curated sets via the side arrows — a richer, more editorial take
// on the brand's original single-row category banner.
export default function CategoryHeroCarousel({ eyebrow, title, highlight, subtitle, sets }: CategoryHeroCarouselProps) {
  const [index, setIndex] = useState(0)
  const set = sets[index]

  const go = (dir: 1 | -1) => setIndex((i) => (i + dir + sets.length) % sets.length)

  const blurOf = (src: string) => src.replace(/\.jpg\.jpeg$/i, '.blur.jpg')

  return (
    <section className="category-hero-carousel">
      <div className="category-hero-heading">
        <h1 className="category-hero-title">
          {title} <span className="category-hero-highlight">{highlight}</span>
        </h1>
        <p className="category-hero-subtitle">{subtitle}</p>
      </div>

      <div className="category-hero-panels">
        <button type="button" className="category-hero-arrow is-left" onClick={() => go(-1)} aria-label="Previous">
          <ChevronLeft size={20} />
        </button>

        <div className="category-hero-panel-large">
          <img src={blurOf(set.large)} alt="" aria-hidden="true" className="category-hero-blur" />
          <img key={set.large} src={set.large} alt={eyebrow} className="category-hero-photo is-fading-in" loading="eager" />
        </div>

        <div className="category-hero-panel-stack">
          <div className="category-hero-panel-small">
            <img src={blurOf(set.smallTop)} alt="" aria-hidden="true" className="category-hero-blur" />
            <img key={set.smallTop} src={set.smallTop} alt={eyebrow} className="category-hero-photo is-fading-in" loading="eager" />
          </div>
          <div className="category-hero-panel-small">
            <img src={blurOf(set.smallBottom)} alt="" aria-hidden="true" className="category-hero-blur" />
            <img
              key={set.smallBottom}
              src={set.smallBottom}
              alt={eyebrow}
              className="category-hero-photo is-fading-in"
              loading="eager"
            />
          </div>
        </div>

        <button type="button" className="category-hero-arrow is-right" onClick={() => go(1)} aria-label="Next">
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="category-hero-dots">
        {sets.map((_, i) => (
          <button
            key={i}
            type="button"
            className={`category-hero-dot ${i === index ? 'is-active' : ''}`}
            aria-label={`Show set ${i + 1}`}
            onClick={() => setIndex(i)}
          />
        ))}
      </div>
    </section>
  )
}
