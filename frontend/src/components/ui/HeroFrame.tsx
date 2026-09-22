interface HeroFrameProps {
  src: string
  showLogo: boolean
  priority?: boolean
}

// One tile of the homepage hero grid: shows the full (uncropped) photo over a
// pre-blurred placeholder backdrop, briefly crossfading to the logo mark.
export default function HeroFrame({ src, showLogo, priority = false }: HeroFrameProps) {
  const blurSrc = src.replace(/DSC_(\d+)\.jpg\.jpeg$/i, 'DSC_$1.blur.jpg')

  return (
    <div className="grid-frame-item">
      <img src={blurSrc} alt="" aria-hidden="true" className="grid-frame-blur" loading="lazy" decoding="async" />
      <img
        src={src}
        alt="Moksha Collections"
        className={`slide-layer photo-layer ${showLogo ? '' : 'active'}`}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={priority ? 'high' : 'auto'}
      />
      <div className={`slide-layer logo-layer ${showLogo ? 'active' : ''}`}>
        <div className="logo-card">
          <img src="/assets/logo/logo.png" alt="Moksha Collections" />
        </div>
      </div>
    </div>
  )
}
