import { Link } from 'react-router-dom'
import { buildWhatsAppLink } from '../utils/whatsapp'
import './Home.css'

const HERO_IMAGES = [
  '/assets/hero/DSC_5506.jpg.jpeg',
  '/assets/hero/DSC_5529.jpg.jpeg',
  '/assets/hero/DSC_5560.jpg.jpeg',
  '/assets/hero/DSC_5610.jpg.jpeg',
  '/assets/hero/DSC_5657.jpg.jpeg',
  '/assets/hero/DSC_5698.jpg.jpeg',
]

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="hero-grid">
          {HERO_IMAGES.map((src) => (
            <div className="hero-grid-frame" key={src}>
              <img src={src} alt="Moksha Collections" />
            </div>
          ))}
        </div>

        <div className="hero-panel">
          <img src="/assets/logo/logo.png" alt="Moksha Collections" className="hero-logo" />
          <p className="hero-copy">
            A wardrobe should be edited, not accumulated — a considered selection of contemporary dresses and
            accessories, curated in Manama for clients across the Gulf.
          </p>
          <div className="hero-actions">
            <Link to="/clothing" className="btn btn-primary">
              Shop Clothing
            </Link>
            <Link to="/accessories" className="btn btn-outline">
              Shop Accessories
            </Link>
          </div>
        </div>
      </section>

      <section className="container collections-section">
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
      </section>

      <section className="story-section">
        <div className="container story-grid">
          <div className="story-media">
            <img src="/assets/hero/DSC_5642.jpg.jpeg" alt="Moksha Collections styling" />
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
      </section>

      <section className="container size-chart-teaser">
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
      </section>

      <section className="container concierge-section">
        <div className="concierge-card">
          <span className="eyebrow">Private Concierge</span>
          <h2 className="section-title">Styling Guidance, A Message Away</h2>
          <p className="section-subtitle">
            Our concierge is available on WhatsApp for styling advice, order questions, and discreet assistance.
          </p>
          <a
            href={buildWhatsAppLink('Hello! I have an inquiry regarding Moksha Collections.')}
            target="_blank"
            rel="noreferrer"
            className="btn btn-whatsapp"
          >
            Message Us on WhatsApp
          </a>
        </div>
      </section>
    </>
  )
}
