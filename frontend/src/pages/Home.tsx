import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { buildWhatsAppLink } from '../utils/whatsapp'
import HeroFrame from '../components/ui/HeroFrame'
import PhotoFrame from '../components/ui/PhotoFrame'
import PhotoAutoSlider from '../components/ui/PhotoAutoSlider'
import RoundCategories from '../components/ui/RoundCategories'
import Reveal from '../components/ui/Reveal'
import './Home.css'

const HERO_IMAGES = [
  '/assets/hero/DSC_5506.jpg.jpeg',
  '/assets/hero/DSC_5529.jpg.jpeg',
  '/assets/hero/DSC_5560.jpg.jpeg',
  '/assets/hero/DSC_5610.jpg.jpeg',
  '/assets/hero/DSC_5657.jpg.jpeg',
  '/assets/hero/DSC_5698.jpg.jpeg',
]

// The six tiles are laid out row-major, but the reference animation moves
// clockwise around the outside edge: top-left, across the top, down the right,
// then back along the bottom.
const HERO_ANIMATION_ORDER = [0, 1, 2, 5, 4, 3]
const FRAME_COUNT = HERO_ANIMATION_ORDER.length

export default function Home() {
  // Reproduces the brand's original hero animation: every 2s, exactly one
  // tile takes its turn crossfading to the logo mark, then back to its photo.
  const [step, setStep] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s + 1) % (FRAME_COUNT * 2)), 2000)
    return () => clearInterval(id)
  }, [])

  const activeFrame = HERO_ANIMATION_ORDER[Math.floor(step / 2)]
  const showLogoOnActiveFrame = step % 2 === 0

  return (
    <>
      <section className="moksha-hero-split-wrapper">
        <div className="hero-window-left">
          <div className="luxury-stagger-grid">
            {HERO_IMAGES.map((src, i) => (
              <HeroFrame key={src} src={src} showLogo={i === activeFrame && showLogoOnActiveFrame} priority={i < 2} />
            ))}
          </div>
        </div>

        <a
          href={buildWhatsAppLink("Hello! I'd like to hear about Moksha Collections' exclusive offers.")}
          target="_blank"
          rel="noreferrer"
          className="hero-window-right"
          aria-label="Ask about exclusive offers"
        >
          <div className="promo-image-container">
            <img
              src="/assets/hero/DSC_5598.blur.jpg"
              alt=""
              aria-hidden="true"
              className="promo-image-blur"
            />
            <img src="/assets/hero/DSC_5598.jpg.jpeg" alt="Exclusive Offers - Moksha Collections" loading="eager" className="promo-image-fg" />
            <div className="promo-overlay-content">
              <span className="promo-tag">Limited Access</span>
              <h3 className="promo-title">Exclusive Offers</h3>
              <span className="promo-link-action">Discover Now</span>
            </div>
          </div>
        </a>
      </section>

      {/* 2nd Page: Featured Photo Auto-Slider & Top Round Categories */}
      <section className="container home-second-page-section">
        <Reveal>
          <PhotoAutoSlider />
        </Reveal>
        <Reveal>
          <RoundCategories title="Top Categories" eyebrow="Curated Selections" />
        </Reveal>
      </section>

      <Reveal as="section" className="container collections-section">
        <div className="section-heading">
          <span className="eyebrow">Two Collections</span>
          <h2 className="section-title">Clothing &amp; Accessories, Equal in Every Way</h2>
        </div>
        <div className="collections-grid">
          <Link to="/clothing" className="collection-card collection-card-clothing">
            <div className="collection-card-overlay">
              <h3>Clothing</h3>
              <span>Explore Collection</span>
            </div>
          </Link>
          <Link to="/accessories" className="collection-card collection-card-accessories">
            <div className="collection-card-overlay">
              <h3>Accessories</h3>
              <span>Discover More</span>
            </div>
          </Link>
        </div>
      </Reveal>

      <Reveal as="section" className="story-section">
        <div className="container story-grid">
          <div className="story-media">
            <PhotoFrame src="/assets/hero/DSC_5642.jpg.jpeg" alt="Moksha Collections styling" />
          </div>
          <div className="story-content">
            <span className="eyebrow">Our Story</span>
            <h2 className="section-title">Edited, Not Accumulated</h2>
            <p>
              Moksha Collections was founded on a simple belief: that a wardrobe should be edited, not accumulated. We
              curate a considered selection of contemporary dresses and accessories — each piece chosen for its cut,
              its finish, and the quiet confidence it lends the woman wearing it.
            </p>
            <p>
              From our home in Manama, we serve clients across the Gulf with a personal, unhurried standard of
              service — a private concierge on WhatsApp, styling guidance when it's wanted, and discretion always.
            </p>
            <Link to="/about-us" className="btn btn-outline">
              Read Our Story
            </Link>
          </div>
        </div>
      </Reveal>

      <Reveal as="section" className="container size-chart-teaser">
        <div className="size-chart-teaser-card">
          <div>
            <span className="eyebrow">Fit With Confidence</span>
            <h2 className="section-title">Find Your Perfect Size</h2>
            <p className="section-subtitle">Every silhouette we carry has a dedicated size guide.</p>
          </div>
          <Link to="/size-charts" className="btn btn-primary">
            View Size Charts
          </Link>
        </div>
      </Reveal>

    </>
  )
}
