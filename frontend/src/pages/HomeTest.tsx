import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Sparkles, Tag, Timer } from 'lucide-react'
import { getHomeTestVisibility, type HomeTestVisibility } from '../api/homeTestVisibility'
import { buildWhatsAppLink } from '../utils/whatsapp'
import HomeTestCategories from './HomeTestCategories'
import './HomeTest.css'

const houses = [
  {
    id: 'clothing',
    title: 'Dresses',
    logo: '/assets/logo/logo.png',
    brand: 'Moksha',
    description: 'Easy, elegant Indian dress for every day and every occasion, for women and girls.',
    links: [
      ['Kurtis and tops', '/clothing/kurti'],
      ['Kaftans', '/clothing/kaftan'],
      ['Co-ord sets', '/clothing/co-ord-set'],
      ['Girls', '/clothing'],
    ],
    housePhoto: '/assets/category-tiles/DSC_5662.jpg.jpeg',
    housePhotoAlt: 'Women wearing dresses from Moksha',
    arrivalTitle: 'Made for every day',
    arrivalDescription: "Kurtis, kaftans, sets and girls’ wear",
  },
  {
    id: 'accessories',
    title: 'Accessories',
    logo: '/assets/logo/azhak-logo.png',
    brand: 'Azhaku',
    description: 'Azhaku means beauty. Earrings, bangles and nettichutti chosen to finish the look.',
    links: [
      ['Earrings', '/accessories/earrings'],
      ['Bangles', '/accessories/bangles'],
      ['Necklaces', '/accessories/necklace'],
      ['Hair accessories', '/accessories/hair-clip'],
    ],
    housePhoto: '/assets/category-tiles/nose-pin.jpg',
    housePhotoAlt: 'Nose pin jewellery',
    arrivalTitle: 'Complete your look',
    arrivalDescription: 'Earrings, bangles and nettichutti',
  },
  {
    id: 'saree',
    title: 'Sarees',
    logo: '/assets/logo/saree.png',
    brand: 'Pallu & Pleats',
    description: 'Celebrating our heritage saree culture, from daily handloom cottons to Kanjeevaram silk.',
    links: [
      ['Traditional & Heritage Silk Sarees', '/saree/traditional-heritage-silk-sarees'],
      ['Set Saree', '/saree/set-saree'],
      ['Georgette', '/saree/georgette'],
      ['Mul Cotton', '/saree/mul-cotton'],
    ],
    housePhoto: '/assets/category-tiles/DSC_5537.jpg.jpeg',
    housePhotoAlt: 'Woman wearing a red saree',
    arrivalTitle: 'The art of drapery',
    arrivalDescription: 'Traditional and modern sarees',
  },
] as const

const offers = [
  { key: 'under_5', title: 'Under 5 BHD', kicker: 'Small price, big style', description: 'Easy, wearable finds that fit any budget.', anchor: 'modern-under5-title', label: 'UNDER 5 BHD', icon: Tag },
  { key: 'clearance', title: 'Clearance Sale', kicker: 'Final prices', description: 'Last pieces, marked down for good. Once they are gone, they are gone.', anchor: 'modern-clearance-title', label: 'CLEARANCE SALE', icon: Timer },
  { key: 'discounts', title: 'Discounts', kicker: 'For a limited time', description: 'Special offers running right now. See the saving on every piece.', anchor: 'modern-discounts-title', label: 'DISCOUNT', icon: Sparkles },
] as const

const whatsapp = buildWhatsAppLink('Hello! I would like to book a styling chat.')

function Logo({ house }: { house: (typeof houses)[number] }) {
  return <img className={`test-home-logo test-home-logo--${house.id}`} src={house.logo} alt={house.brand} />
}

export default function HomeTest() {
  const [visibility, setVisibility] = useState<HomeTestVisibility | null>(null)
  const [visibilityError, setVisibilityError] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    setVisibilityError(false)
    getHomeTestVisibility()
      .then((data) => { if (active) setVisibility(data) })
      .catch((error: unknown) => {
        console.error('Could not load homepage visibility', error)
        if (active) setVisibilityError(true)
      })
    return () => { active = false }
  }, [attempt])

  const visibleOffers = visibility ? offers.filter((offer) => visibility[offer.key]) : []
  return (
    <div className="test-home">
      <div className="test-home-wrap">
        <section className="test-hero" aria-labelledby="test-hero-title">
          <div className="test-hero-inner">
            <h1 id="test-hero-title">Three houses. One heritage.<br />Delivered to your door.</h1>
            <p>Dresses, sarees and jewellery from India, chosen in<br className="test-desktop-break" /> Bahrain for women across the Gulf and beyond.</p>
            <div className="test-hero-actions">
              <a className="test-button" href="#test-houses">Explore the houses</a>
              <a className="test-text-link" href={whatsapp} target="_blank" rel="noreferrer">Book a styling chat</a>
            </div>
          </div>
        </section>

        <section id="test-houses" className="test-houses" aria-label="Explore the houses">
          {houses.map((house) => (
            <article key={house.id} className={`test-house test-house--${house.id}`}>
              <div className="test-house-photo">
                <img src={house.housePhoto} alt={house.housePhotoAlt} loading="lazy" />
              </div>
              <div className="test-house-content">
                <div className="test-house-logo"><Logo house={house} /></div>
                <h2>{house.title}</h2>
                <p>{house.description}</p>
                <ul>{house.links.map(([label, url]) => <li key={label}><Link to={url}>{label}</Link></li>)}</ul>
                <Link className="test-button" to={`/${house.id}`}>Shop {house.brand}</Link>
              </div>
            </article>
          ))}
        </section>

        <section className="test-arrivals" aria-labelledby="test-arrivals-title">
          <div className="test-arrivals-heading">
            <h2 id="test-arrivals-title">New arrivals</h2>
            <Link className="test-text-link" to="/clothing">See everything new</Link>
          </div>
          <div className="test-arrival-list">
            {houses.map((house) => (
              <article className="test-arrival" key={house.id}>
                <div className="test-arrival-content">
                  <Logo house={house} />
                  <h3>{house.arrivalTitle}</h3>
                  <p>{house.arrivalDescription}</p>
                  <Link className="test-button" to={`/${house.id}`}>Shop {house.brand}</Link>
                </div>
                <HomeTestCategories type={house.id} title={house.title} />
              </article>
            ))}
          </div>
        </section>
      </div>

      {visibilityError && <div className="test-home-wrap test-visibility-error" role="alert">Could not load offer sections. <button type="button" onClick={() => setAttempt((value) => value + 1)}>Try again</button></div>}
      {visibleOffers.length > 0 && <div className="test-offers">
        <div className="test-home-wrap">
          {visibleOffers.map((offer) => {
            const Icon = offer.icon
            return (
              <section className="test-offer" key={offer.title} aria-label={offer.title}>
                <div className="test-offer-header">
                  <div><p>{offer.kicker}</p><h2><Icon aria-hidden="true" size={23} />{offer.title}</h2></div>
                  <p>{offer.description}</p>
                </div>
                <div className="test-offer-grid">
                  {houses.map((house) => (
                    <Link className="test-offer-card" key={house.id} to={`/${house.id}#${offer.anchor}`} aria-label={`${offer.title}: ${house.title}`}>
                      <div className="test-offer-art">
                        <Logo house={house} />
                        <span className="test-offer-art-label"><Tag aria-hidden="true" size={16} />{offer.label}</span>
                      </div>
                      <span className="test-offer-category">{house.title}</span>
                    </Link>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      </div>}

      <div className="test-home-wrap test-service-wrap">
        <section className="test-services" aria-label="Shopping with Moksha">
          <article><h2>Order on WhatsApp</h2><p>Send a photo, an occasion or a budget. We suggest pieces from all three houses and confirm stock before you pay.</p><a className="test-button" href={whatsapp} target="_blank" rel="noreferrer">Message +973 3552 1619</a></article>
          <article><h2>Visit the boutique</h2><p>Shop No 55, Building 106, Sugaya Avenue, Saqiyyaah 0328, Manama, Bahrain. Try sarees and dresses in person.</p></article>
          <article><h2>Delivered to your door</h2><p>Across the GCC and worldwide. <Link className="test-text-link" to="/policies">See our delivery and returns policies.</Link></p></article>
        </section>
        <section className="test-delivery" aria-label="Delivery destinations">
          <h2>We deliver to</h2>
          <ul>{['Bahrain', 'Saudi Arabia', 'UAE', 'Kuwait', 'Qatar', 'Oman', 'Worldwide'].map((country) => <li key={country}>{country}</li>)}</ul>
        </section>
      </div>
    </div>
  )
}
