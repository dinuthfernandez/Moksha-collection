import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, Sparkles, Tag, Timer } from 'lucide-react'
import Confetti from '../components/ui/Confetti'
import BannerSlider from '../components/home/BannerSlider'
import CollectionCarousel from '../components/home/CollectionCarousel'
import './Home.css'
import './HomeModern.css'

type Shelf = 'clothing' | 'accessories' | 'saree'
type Offer = 'under5' | 'clearance' | 'discounts'

const SHELVES: { type: Shelf; label: string }[] = [
  { type: 'clothing', label: 'Clothing' },
  { type: 'saree', label: 'Saree' },
  { type: 'accessories', label: 'Accessories' },
]

const BRAND_COLLECTIONS = [
  {
    type: 'clothing',
    title: 'Clothing',
    eyebrow: 'Dresses & ethnic wear',
    description: 'Discover thoughtfully chosen styles for every day and every celebration.',
    logo: '/assets/logo/logo.png',
    logoAlt: 'Moksha Collections',
    tiles: [
      { name: 'Kurti', image: 'kurti.jpg' },
      { name: 'Co-ord Set', image: 'co-ord-set.jpg' },
      { name: 'Frock', image: 'frock.jpg' },
    ],
  },
  {
    type: 'accessories',
    title: 'Accessories',
    eyebrow: 'The finishing touch',
    description: 'Find jewellery and accessories to complete your look, from everyday to occasion.',
    logo: '/assets/logo/azhak-logo.png',
    logoAlt: 'Azhak by Moksha Collections',
    tiles: [
      { name: 'Necklaces', image: 'necklace.jpg' },
      { name: 'Earrings', image: 'earrings.jpg' },
      { name: 'Bangles', image: 'bangles.jpg' },
    ],
  },
  {
    type: 'saree',
    title: 'Saree',
    eyebrow: 'Timeless drapes',
    description: 'Explore sarees and set sarees selected for special moments and everyday elegance.',
    logo: '/assets/logo/saree.png',
    logoAlt: 'Pallu & Pleats',
    tiles: [
      { name: 'Saree', image: 'saree.jpg' },
      { name: 'Set Saree', image: 'set-saree.jpg' },
    ],
  },
] as const

const OFFERS: {
  id: Offer
  anchor: string
  kicker: string
  title: string
  intro: string
  icon: typeof Tag
  image: string
}[] = [
  {
    id: 'under5',
    anchor: 'modern-under5-title',
    kicker: 'Small price, big style',
    title: 'Under 5 BHD',
    intro: 'Easy, wearable finds that fit any budget.',
    icon: Tag,
    image: '/assets/home/offers/under5bhd.jpg',
  },
  {
    id: 'clearance',
    anchor: 'modern-clearance-title',
    kicker: 'Final prices',
    title: 'Clearance Sale',
    intro: 'Last pieces, marked down for good. Once they are gone, they are gone.',
    icon: Timer,
    image: '/assets/home/offers/clearancesale.jpg',
  },
  {
    id: 'discounts',
    anchor: 'modern-discounts-title',
    kicker: 'For a limited time',
    title: 'Discounts',
    intro: 'Special offers running right now. See the saving on every piece.',
    icon: Sparkles,
    image: '/assets/home/offers/discount.jpg',
  },
]

export default function HomeModern() {
  const location = useLocation()
  const navigate = useNavigate()
  const [celebrating, setCelebrating] = useState(
    () => (location.state as { celebrate?: boolean } | null)?.celebrate === true,
  )

  // Clear the flag so a refresh or later visit doesn't replay the confetti.
  useEffect(() => {
    if ((location.state as { celebrate?: boolean } | null)?.celebrate) {
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [location.state, location.pathname, navigate])

  return (
    <div className="moksha-home home-modern">
      {celebrating && <Confetti mode="rain" durationMs={5000} onDone={() => setCelebrating(false)} />}
      <section className="mh-hero" aria-labelledby="mh-hero-title">
        <img className="mh-hero-photo" src="/assets/hero/DSC_5738.jpg.webp" alt="Moksha Collections clothing look" />
        <div className="mh-hero-scrim" aria-hidden="true" />
        <div className="mh-hero-copy">
          <span className="mh-eyebrow">The considered clothing edit</span>
          <h1 id="mh-hero-title">Moksha Collections</h1>
          <p>Contemporary clothing chosen for its cut, finish, and the quiet confidence it brings to the everyday.</p>
          <div className="mh-hero-actions">
            <Link className="mh-button-primary" to="/clothing">
              Explore clothing <ArrowRight size={16} />
            </Link>
            <a className="mh-text-link" href="#mh-story">
              Our approach <ArrowRight size={16} />
            </a>
          </div>
        </div>
      </section>

      <BannerSlider />

      <section className="mh-section mh-container" id="mh-categories" aria-labelledby="mh-categories-title">
        <div className="mh-section-head">
          <div>
            <p className="mh-section-kicker">A considered wardrobe</p>
            <h2 id="mh-categories-title">Shop the collections</h2>
          </div>
          <p>Distinct edits, thoughtfully selected. Find the pieces that feel like you.</p>
        </div>
        <CollectionCarousel />
      </section>

      <section className="mh-container hm-brands" aria-label="Explore our collections">
        {BRAND_COLLECTIONS.map((brand) => (
          <article key={brand.type} className={`hm-brand hm-brand--${brand.type}`}>
            <div className="hm-brand-visuals" aria-hidden="true">
              {brand.tiles.map((tile) => (
                <div className="hm-brand-tile" key={tile.name}>
                  <img src={`/assets/category-tiles/${tile.image}`} alt="" loading="lazy" decoding="async" />
                  <span>{tile.name}</span>
                </div>
              ))}
            </div>
            <div className="hm-brand-content">
              <div className="hm-brand-logo">
                <img src={brand.logo} alt={brand.logoAlt} loading="lazy" decoding="async" />
              </div>
              <p className="hm-brand-eyebrow">{brand.eyebrow}</p>
              <h2>{brand.title}</h2>
              <p className="hm-brand-description">{brand.description}</p>
              <Link className="hm-brand-link" to={`/${brand.type}`}>
                Shop {brand.title} <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </article>
        ))}
      </section>

      {OFFERS.map((offer) => {
        const Icon = offer.icon
        return (
          <section key={offer.id} className={`mh-section mh-container hm-offer hm-${offer.id}`} aria-labelledby={`hm-${offer.id}-title`}>
            <div className="mh-section-head">
              <div>
                <p className="mh-section-kicker">{offer.kicker}</p>
                <h2 id={`hm-${offer.id}-title`}><Icon size={26} className="hm-title-icon" aria-hidden="true" />{offer.title}</h2>
              </div>
              <p>{offer.intro}</p>
            </div>
            <div className="hm-offer-grid">
              {SHELVES.map(({ type, label }) => (
                <Link key={type} className="hm-card" to={`/${type}#${offer.anchor}`} aria-label={`${offer.title}: ${label}`}>
                  <img className="hm-card-image" src={offer.image} alt="" loading="lazy" decoding="async" />
                  <span className="hm-card-label" aria-hidden="true">{label}</span>
                </Link>
              ))}
            </div>
          </section>
        )
      })}

      <section className="mh-story mh-container" id="mh-story" aria-labelledby="mh-story-title">
        <div className="mh-story-copy">
          <p className="mh-section-kicker">Our approach</p>
          <h2 id="mh-story-title">A wardrobe edited with intention.</h2>
          <p>We believe a wardrobe should be edited, not accumulated. Each piece is chosen for its shape, finish, and the way it moves with real life.</p>
          <p>From our home in Manama, we serve clients across the Gulf with personal styling guidance and an unhurried standard of service.</p>
        </div>
        <div className="mh-story-image">
          <img src="/assets/category/DSC_5696.jpg.webp" alt="A considered Moksha Collections look" />
        </div>
      </section>
    </div>
  )
}
