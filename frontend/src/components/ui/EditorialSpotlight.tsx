import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import './EditorialSpotlight.css'

interface EditorialSpotlightProps {
  eyebrow: string
  title: string
  highlight: string
  caption: string
  images: string[]
}

// A single large framed portrait carousel — an editorial "look book" moment
// that elevates the page even while the product catalogue is still empty.
export default function EditorialSpotlight({ eyebrow, title, highlight, caption, images }: EditorialSpotlightProps) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % images.length), 4500)
    return () => clearInterval(id)
  }, [images.length])

  const go = (dir: 1 | -1) => setIndex((i) => (i + dir + images.length) % images.length)
  const blurOf = (src: string) => src.replace(/\.jpg\.jpeg$/i, '.blur.jpg')

  return (
    <section className="editorial-spotlight">
      <div className="editorial-spotlight-heading">
        <span className="eyebrow">{eyebrow}</span>
        <h2 className="editorial-spotlight-title">
          {title} <span className="editorial-spotlight-highlight">{highlight}</span>
        </h2>
      </div>

      <div className="editorial-spotlight-frame">
        <button type="button" className="editorial-spotlight-arrow is-left" onClick={() => go(-1)} aria-label="Previous look">
          <ChevronLeft size={18} />
        </button>

        <div className="editorial-spotlight-media">
          <img src={blurOf(images[index])} alt="" aria-hidden="true" className="editorial-spotlight-blur" />
          <img key={images[index]} src={images[index]} alt={caption} className="editorial-spotlight-photo" loading="lazy" />
        </div>

        <button type="button" className="editorial-spotlight-arrow is-right" onClick={() => go(1)} aria-label="Next look">
          <ChevronRight size={18} />
        </button>
      </div>

      <p className="editorial-spotlight-caption">{caption}</p>

      <div className="editorial-spotlight-dots">
        {images.map((_, i) => (
          <button
            key={i}
            type="button"
            className={`editorial-spotlight-dot ${i === index ? 'is-active' : ''}`}
            aria-label={`Show look ${i + 1}`}
            onClick={() => setIndex(i)}
          />
        ))}
      </div>
    </section>
  )
}
