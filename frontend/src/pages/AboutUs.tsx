import { buildWhatsAppLink } from '../utils/whatsapp'
import PhotoFrame from '../components/ui/PhotoFrame'
import './AboutUs.css'

export default function AboutUs() {
  return (
    <div className="container about-page">
      <div className="section-heading">
        <span className="eyebrow">Our Story</span>
        <h1 className="section-title">About Moksha Collections</h1>
      </div>

      <div className="about-grid">
        <div className="about-media">
          <PhotoFrame src="/assets/hero/DSC_5738.jpg.jpeg" alt="Moksha Collections" priority />
        </div>
        <div className="about-content">
          <p>
            Moksha Collections was founded on a simple belief: that a wardrobe should be edited, not accumulated. We
            curate a considered selection of contemporary dresses and accessories — each piece chosen for its cut,
            its finish, and the quiet confidence it lends the woman wearing it.
          </p>
          <p>Ours is a smaller collection by design. Every arrival earns its place.</p>
          <p>
            From our home in Manama, we serve clients across the Gulf with a personal, unhurried standard of
            service — a private concierge on WhatsApp, styling guidance when it's wanted, and discretion always.
          </p>
          <a
            href={buildWhatsAppLink('Hello! I have an inquiry regarding Moksha Collections.')}
            target="_blank"
            rel="noreferrer"
            className="btn btn-whatsapp"
          >
            Chat With Our Concierge
          </a>
        </div>
      </div>
    </div>
  )
}
