import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, Sparkles, Tag, Timer } from 'lucide-react'
import Confetti from '../components/ui/Confetti'
import BannerSlider from '../components/home/BannerSlider'
import './Home.css'
import './HomeModern.css'

type Shelf = 'clothing' | 'accessories' | 'saree'
type Offer = 'under5' | 'clearance' | 'discounts'

const SHELVES: { type: Shelf; label: string }[] = [
  { type: 'clothing', label: 'Clothing' },
  { type: 'saree', label: 'Saree' },
  { type: 'accessories', label: 'Accessories' },
]

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
        <div className="mh-category-grid">
          <Link className="mh-category-card" to="/clothing/kurti">
            <img src="/assets/category-tiles/kurti.jpg" alt="Kurti collection" />
            <span className="mh-category-copy"><strong>Kurti</strong><span>Shop Now</span></span>
          </Link>
          <Link className="mh-category-card" to="/clothing/co-ord-set">
            <img src="/assets/category-tiles/co-ord-set.jpg" alt="Co-ord set collection" />
            <span className="mh-category-copy"><strong>Co-ord Set</strong><span>Shop Now</span></span>
          </Link>
          <Link className="mh-category-card" to="/clothing/saree">
            <img src="/assets/category-tiles/saree.jpg" alt="Saree collection" />
            <span className="mh-category-copy"><strong>Saree</strong><span>Shop Now</span></span>
          </Link>
          <Link className="mh-category-card" to="/clothing/frock">
            <img src="/assets/category-tiles/frock.jpg" alt="Frock collection" />
            <span className="mh-category-copy"><strong>Frock</strong><span>Shop Now</span></span>
          </Link>
        </div>
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
