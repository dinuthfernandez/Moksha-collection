import { useEffect, useState } from 'react'
import { getPublicBanners, type PublicBanners } from '../../api/banners'
import './BannerSlider.css'

export default function BannerSlider() {
  const [data, setData] = useState<PublicBanners | null>(null)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    let mounted = true
    getPublicBanners().then((d) => mounted && setData(d)).catch(() => undefined)
    return () => { mounted = false }
  }, [])

  const count = data?.banners.length ?? 0
  const seconds = data?.interval_seconds || 5

  useEffect(() => {
    if (count < 2) return
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % count), seconds * 1000)
    return () => window.clearInterval(timer)
  }, [count, seconds])

  if (!data?.enabled || count === 0) return null

  return (
    <section className="home-banner" aria-roledescription="carousel" aria-label="Featured banners">
      <div className="home-banner-frame">
        {data.banners.map((banner, i) => (
          <img
            key={banner.id}
            src={banner.image_url}
            alt=""
            className={'home-banner-slide' + (i === index % count ? ' is-active' : '')}
            loading={i === 0 ? 'eager' : 'lazy'}
            decoding="async"
            draggable={false}
          />
        ))}
        {count > 1 && (
          <div className="home-banner-dots" role="tablist" aria-label="Choose banner">
            {data.banners.map((banner, i) => (
              <button
                key={banner.id}
                type="button"
                role="tab"
                aria-selected={i === index % count}
                aria-label={`Banner ${i + 1}`}
                className={i === index % count ? 'is-active' : ''}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
