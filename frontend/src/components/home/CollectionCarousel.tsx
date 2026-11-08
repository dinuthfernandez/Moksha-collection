import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const GROUPS = [
  [
    { name: 'Kurti', type: 'clothing', slug: 'kurti' },
    { name: 'Earrings', type: 'accessories', slug: 'earrings' },
    { name: 'Saree', type: 'saree', slug: 'saree' },
  ],
  [
    { name: 'Co-ord Set', type: 'clothing', slug: 'co-ord-set' },
    { name: 'Bangles', type: 'accessories', slug: 'bangles' },
    { name: 'Set Saree', type: 'saree', slug: 'set-saree' },
  ],
] as const

const SLIDES = [GROUPS[1], GROUPS[0], GROUPS[1], GROUPS[0]]

export default function CollectionCarousel() {
  const [compact, setCompact] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [slide, setSlide] = useState(1)
  const [animated, setAnimated] = useState(true)
  const [interacting, setInteracting] = useState(false)
  const [inView, setInView] = useState(false)
  const [pageVisible, setPageVisible] = useState(!document.hidden)
  const sectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const compactQuery = window.matchMedia('(max-width: 1023px)')
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updateCompact = () => {
      setCompact(compactQuery.matches)
      setSlide(1)
      setAnimated(true)
    }
    const updateMotion = () => setReducedMotion(motionQuery.matches)
    const updateVisibility = () => setPageVisible(!document.hidden)
    updateCompact()
    updateMotion()
    compactQuery.addEventListener('change', updateCompact)
    motionQuery.addEventListener('change', updateMotion)
    document.addEventListener('visibilitychange', updateVisibility)
    return () => {
      compactQuery.removeEventListener('change', updateCompact)
      motionQuery.removeEventListener('change', updateMotion)
      document.removeEventListener('visibilitychange', updateVisibility)
    }
  }, [])

  useEffect(() => {
    const element = sectionRef.current
    if (!element) return
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.25 })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!compact || reducedMotion || interacting || !inView || !pageVisible || !animated) return
    const timer = window.setInterval(() => setSlide((current) => (current === 1 || current === 2 ? current + 1 : current)), 4000)
    return () => window.clearInterval(timer)
  }, [compact, reducedMotion, interacting, inView, pageVisible, animated])

  useEffect(() => {
    if (animated) return
    let secondFrame = 0
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => setAnimated(true))
    })
    return () => {
      window.cancelAnimationFrame(firstFrame)
      window.cancelAnimationFrame(secondFrame)
    }
  }, [animated])

  const go = (direction: -1 | 1) => {
    if (!animated || slide === 0 || slide === 3) return
    setSlide((current) => current + direction)
  }

  const settle = () => {
    if (slide !== 0 && slide !== 3) return
    setAnimated(false)
    setSlide(slide === 0 ? 2 : 1)
  }

  const activeGroup = slide === 0 ? 1 : slide === 3 ? 0 : slide - 1

  return (
    <div
      ref={sectionRef}
      className="collection-carousel"
      role="region"
      aria-roledescription="carousel"
      aria-label="Shop the collections"
      onMouseEnter={() => setInteracting(true)}
      onMouseLeave={() => setInteracting(false)}
      onFocus={() => setInteracting(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setInteracting(false)
      }}
    >
      <div className="collection-carousel-viewport">
        <div
          className={`collection-carousel-track${animated ? '' : ' is-resetting'}`}
          style={{ transform: compact ? `translateX(-${slide * 100}%)` : undefined }}
          onTransitionEnd={(event) => {
            if (event.target === event.currentTarget && event.propertyName === 'transform') settle()
          }}
        >
          {SLIDES.map((items, index) => {
            const clone = index === 0 || index === 3
            const hidden = clone || (compact && index - 1 !== activeGroup)
            return (
              <div key={index} className={`collection-carousel-slide${clone ? ' is-clone' : ''}`} aria-hidden={hidden || undefined}>
                {items.map((item) => (
                  <Link key={item.slug} className="mh-category-card" to={`/${item.type}/${item.slug}`} tabIndex={hidden ? -1 : undefined}>
                    <img src={`/assets/category-tiles/${item.slug}.jpg`} alt="" loading="lazy" decoding="async" />
                    <span className="mh-category-copy"><strong>{item.name}</strong><span>Shop Now</span></span>
                  </Link>
                ))}
              </div>
            )
          })}
        </div>
      </div>
      <div className="collection-carousel-controls">
        <button type="button" onClick={() => go(-1)} aria-label="Previous collections"><ChevronLeft size={18} /></button>
        <span aria-live="polite">{activeGroup + 1} / 2</span>
        <button type="button" onClick={() => go(1)} aria-label="Next collections"><ChevronRight size={18} /></button>
      </div>
    </div>
  )
}
