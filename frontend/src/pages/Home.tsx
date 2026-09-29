import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import './Home.css'

export default function Home() {
  return (
    <div className="moksha-home">
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
            <Link className="mh-text-link" to="/about-us">
              Our approach <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

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
            <img src="/assets/category/DSC_5516.jpg.webp" alt="Kurti collection" />
            <span className="mh-category-copy"><span>01 · Everyday</span><strong>Kurtis</strong><ArrowRight size={17} /></span>
          </Link>
          <Link className="mh-category-card" to="/clothing/saree">
            <img src="/assets/category/DSC_5685.jpg.webp" alt="Saree collection" />
            <span className="mh-category-copy"><span>02 · Occasion</span><strong>Sarees</strong><ArrowRight size={17} /></span>
          </Link>
          <Link className="mh-category-card" to="/clothing/co-ord-sets">
            <img src="/assets/category/DSC_5742.jpg.webp" alt="Co-ord sets collection" />
            <span className="mh-category-copy"><span>03 · Matching sets</span><strong>Co-ord sets</strong><ArrowRight size={17} /></span>
          </Link>
          <Link className="mh-category-card" to="/clothing/western-outfits">
            <img src="/assets/category/DSC_5704.jpg.webp" alt="Western clothing collection" />
            <span className="mh-category-copy"><span>04 · Modern silhouettes</span><strong>Western wear</strong><ArrowRight size={17} /></span>
          </Link>
        </div>
      </section>

      <section className="mh-section mh-arrivals" id="mh-new-arrivals" aria-labelledby="mh-arrivals-title">
        <div className="mh-container">
          <div className="mh-section-head">
            <div>
              <p className="mh-section-kicker">Just added</p>
              <h2 id="mh-arrivals-title">The latest edit</h2>
            </div>
            <p>Fresh silhouettes, familiar ease. A first look at the pieces we’re wearing now.</p>
          </div>
          <div className="mh-arrival-grid">
            <Link className="mh-arrival-card" to="/clothing/kurti">
              <div><img src="/assets/category/DSC_5679.jpg.webp" alt="Kurti in the new edit" /></div>
              <span><strong>Soft structure</strong><small>Explore kurtis</small></span>
            </Link>
            <Link className="mh-arrival-card" to="/clothing/saree">
              <div><img src="/assets/category/DSC_5696.jpg.webp" alt="Saree in the new edit" /></div>
              <span><strong>Fluid drape</strong><small>Explore sarees</small></span>
            </Link>
            <Link className="mh-arrival-card" to="/clothing/kaftan-collection">
              <div><img src="/assets/category/DSC_5650.jpg.webp" alt="Kaftan in the new edit" /></div>
              <span><strong>Unhurried ease</strong><small>Explore kaftans</small></span>
            </Link>
            <Link className="mh-arrival-card" to="/clothing/frock">
              <div><img src="/assets/category/DSC_5607.jpg.webp" alt="Dress in the new edit" /></div>
              <span><strong>Everyday detail</strong><small>Explore dresses</small></span>
            </Link>
          </div>
        </div>
      </section>

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

      <section className="mh-concierge" aria-labelledby="mh-concierge-title">
        <p className="mh-section-kicker">Personal service</p>
        <h2 id="mh-concierge-title">A little help finding your fit?</h2>
        <p>Our WhatsApp concierge can help with styling, availability, and your order.</p>
        <a href="https://wa.me/97335521619">Message our concierge <ArrowRight size={16} /></a>
      </section>
    </div>
  )
}
