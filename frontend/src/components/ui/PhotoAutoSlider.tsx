import { useEffect, useRef, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import './PhotoAutoSlider.css'

export interface SlideItem {
  id: string
  imageWebp: string
  imageJpg: string
  blurPlaceholder: string
  title: string
  subtitle: string
  tag: string
  linkTo: string
  ctaText: string
}

export const DEFAULT_SLIDES: SlideItem[] = [
  {
    id: 'slide-1',
    imageWebp: '/assets/slider/DSC_5537.webp',
    imageJpg: '/assets/slider/DSC_5537.jpg',
    blurPlaceholder: '/assets/slider/DSC_5537.blur.jpg',
    title: 'The New Season Edit',
    subtitle: 'Silhouettes crafted for grace, comfort, and effortless presence.',
    tag: 'New Collection',
    linkTo: '/clothing',
    ctaText: 'Explore Clothing',
  },
  {
    id: 'slide-2',
    imageWebp: '/assets/slider/DSC_5574.webp',
    imageJpg: '/assets/slider/DSC_5574.jpg',
    blurPlaceholder: '/assets/slider/DSC_5574.blur.jpg',
    title: 'Contemporary Elegance',
    subtitle: 'From relaxed silhouettes to elevated evening wear.',
    tag: 'Signature Styles',
    linkTo: '/clothing',
    ctaText: 'Shop Collection',
  },
  {
    id: 'slide-3',
    imageWebp: '/assets/slider/DSC_5620.webp',
    imageJpg: '/assets/slider/DSC_5620.jpg',
    blurPlaceholder: '/assets/slider/DSC_5620.blur.jpg',
    title: 'Refined Accents & Details',
    subtitle: 'Statement finishing pieces chosen to complete every look.',
    tag: 'Accessories',
    linkTo: '/accessories',
    ctaText: 'Discover Accessories',
  },
  {
    id: 'slide-4',
    imageWebp: '/assets/slider/DSC_5634.webp',
    imageJpg: '/assets/slider/DSC_5634.jpg',
    blurPlaceholder: '/assets/slider/DSC_5634.blur.jpg',
    title: 'Bespoke Gulf Delivery',
    subtitle: 'Discreet door-to-door shipping across Bahrain, GCC, and worldwide.',
    tag: 'Worldwide Shipping',
    linkTo: '/about-us',
    ctaText: 'Our Service',
  },
  {
    id: 'slide-5',
    imageWebp: '/assets/slider/DSC_5683.webp',
    imageJpg: '/assets/slider/DSC_5683.jpg',
    blurPlaceholder: '/assets/slider/DSC_5683.blur.jpg',
    title: 'Timeless Handcrafted Grace',
    subtitle: 'Exacting standards in fabric selection, cut, and finish.',
    tag: 'Craftsmanship',
    linkTo: '/clothing',
    ctaText: 'Explore Styles',
  },
  {
    id: 'slide-6',
    imageWebp: '/assets/slider/DSC_5775.webp',
    imageJpg: '/assets/slider/DSC_5775.jpg',
    blurPlaceholder: '/assets/slider/DSC_5775.blur.jpg',
    title: 'Find Your Signature Fit',
    subtitle: 'Every cut has a dedicated measurement guide for total confidence.',
    tag: 'Fit Guide',
    linkTo: '/size-charts',
    ctaText: 'View Size Charts',
  },
]

interface PhotoAutoSliderProps {
  slides?: SlideItem[]
  intervalMs?: number
}

export default function PhotoAutoSlider({ slides = DEFAULT_SLIDES, intervalMs = 5000 }: PhotoAutoSliderProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const touchStartX = useRef<number | null>(null)
  const timerRef = useRef<number | null>(null)

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % slides.length)
  }, [slides.length])

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length)
  }, [slides.length])

  // Auto-slide effect
  useEffect(() => {
    if (isPaused) return
    timerRef.current = window.setInterval(goToNext, intervalMs)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [goToNext, intervalMs, isPaused])

  // Touch gesture handlers for mobile swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const diffX = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(diffX) > 40) {
      if (diffX < 0) goToNext()
      else goToPrev()
    }
    touchStartX.current = null
  }

  return (
    <div
      className="photo-auto-slider"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      aria-roledescription="carousel"
      aria-label="Featured Collections Slider"
    >
      <div className="slider-track-container">
        {slides.map((slide, idx) => {
          const isActive = idx === currentIndex
          return (
            <div
              key={slide.id}
              className={`slider-slide ${isActive ? 'is-active' : ''}`}
              aria-hidden={!isActive}
            >
              {/* Blurred backdrop LQIP for instant zero-lag loading */}
              <div
                className="slider-slide-backdrop"
                style={{ backgroundImage: `url(${slide.blurPlaceholder})` }}
              />

              <picture>
                <source srcSet={slide.imageWebp} type="image/webp" />
                <img
                  src={slide.imageJpg}
                  alt={slide.title}
                  className="slider-slide-img"
                  loading={idx === 0 ? 'eager' : 'lazy'}
                />
              </picture>

              {/* Editorial Gradient Overlay */}
              <div className="slider-slide-overlay" />

              {/* Caption & Content */}
              <div className="slider-content-wrapper">
                <div className="slider-content">
                  <span className="slider-tag">{slide.tag}</span>
                  <h2 className="slider-title">{slide.title}</h2>
                  <p className="slider-subtitle">{slide.subtitle}</p>
                  <Link to={slide.linkTo} className="btn btn-primary slider-cta">
                    {slide.ctaText}
                  </Link>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Navigation Arrows */}
      <button
        type="button"
        className="slider-nav-btn slider-nav-prev"
        onClick={goToPrev}
        aria-label="Previous Slide"
      >
        <ChevronLeft size={22} />
      </button>

      <button
        type="button"
        className="slider-nav-btn slider-nav-next"
        onClick={goToNext}
        aria-label="Next Slide"
      >
        <ChevronRight size={22} />
      </button>

      {/* Pagination Dash Indicators */}
      <div className="slider-pagination">
        {slides.map((slide, idx) => (
          <button
            key={slide.id}
            type="button"
            className={`slider-dot ${idx === currentIndex ? 'is-active' : ''}`}
            onClick={() => setCurrentIndex(idx)}
            aria-label={`Go to slide ${idx + 1}`}
          >
            <span className="slider-dot-fill" />
          </button>
        ))}
      </div>
    </div>
  )
}
