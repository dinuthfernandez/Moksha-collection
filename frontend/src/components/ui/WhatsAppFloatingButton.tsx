import { useState } from 'react'
import { buildWhatsAppLink } from '../../utils/whatsapp'
import './WhatsAppFloatingButton.css'

export default function WhatsAppFloatingButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button className="wa-float-btn" aria-label="Chat on WhatsApp" onClick={() => setOpen(true)}>
        <img src="/assets/icons/png/icons8-whatsapp-50.png" alt="" />
      </button>

      {open && (
        <div className="wa-modal-overlay" onClick={() => setOpen(false)}>
          <div className="wa-modal-card" onClick={(e) => e.stopPropagation()}>
            <button className="wa-modal-close" aria-label="Close" onClick={() => setOpen(false)}>
              &times;
            </button>
            <div className="wa-modal-header">
              <img src="/assets/icons/png/icons8-whatsapp-50.png" alt="" />
              <h3>Chat with Moksha Collections</h3>
            </div>
            <p>Say hello for styling guidance, order questions, or anything else — our concierge replies personally.</p>
            <a
              href={buildWhatsAppLink('Hello! I have an inquiry regarding Moksha Collections.')}
              target="_blank"
              rel="noreferrer"
              className="btn btn-whatsapp wa-modal-cta"
            >
              Open WhatsApp
            </a>
          </div>
        </div>
      )}
    </>
  )
}
