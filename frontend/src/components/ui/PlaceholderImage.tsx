import { useState, type CSSProperties } from 'react'
import { ImageIcon } from 'lucide-react'
import './PlaceholderImage.css'

interface PlaceholderImageProps {
  src?: string | null
  alt: string
  label?: string
  ratio?: string
  className?: string
}

// Tries to render the real photo at `src`; if it's missing (asset not
// dropped in yet) or fails to load, falls back to a clean labelled
// placeholder instead of a broken-image icon.
export default function PlaceholderImage({ src, alt, label, ratio, className = '' }: PlaceholderImageProps) {
  const [failed, setFailed] = useState(!src)
  const style = ratio ? ({ '--ph-ratio': ratio } as CSSProperties) : undefined

  if (failed) {
    return (
      <div className={`placeholder-image is-empty ${className}`} style={style}>
        <ImageIcon size={26} strokeWidth={1.2} />
        {label && <span>{label}</span>}
      </div>
    )
  }

  return (
    <div className={`placeholder-image ${className}`} style={style}>
      <img src={src ?? undefined} alt={alt} onError={() => setFailed(true)} />
    </div>
  )
}
