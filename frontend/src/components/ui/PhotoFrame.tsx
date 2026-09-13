import './PhotoFrame.css'

interface PhotoFrameProps {
  src: string
  alt: string
  className?: string
  priority?: boolean
}

// Shows the FULL photo (never cropped) by "containing" it over a soft, pre-blurred
// placeholder of itself, so there's no awkward letterboxing on portrait shots.
export default function PhotoFrame({ src, alt, className = '', priority = false }: PhotoFrameProps) {
  const webp = src.replace(/\.jpeg$/i, '.webp')
  const blurSrc = src.replace(/DSC_(\d+)\.jpg\.jpeg$/i, 'DSC_$1.blur.jpg')

  return (
    <div className={`photo-frame ${className}`}>
      <img src={blurSrc} alt="" aria-hidden="true" className="photo-frame-blur" loading="lazy" decoding="async" />
      <picture>
        <source srcSet={webp} type="image/webp" />
        <img
          src={src}
          alt={alt}
          className="photo-frame-fg"
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={priority ? 'high' : 'auto'}
        />
      </picture>
    </div>
  )
}
