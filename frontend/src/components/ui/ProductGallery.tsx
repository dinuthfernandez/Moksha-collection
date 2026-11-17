import { useEffect, useLayoutEffect, useRef, useState, type TouchEvent } from 'react'
import { ChevronLeft, ChevronRight, Minus, Plus, X } from 'lucide-react'
import type { Product } from '../../types'
import { formatVariant } from '../../utils/variant'
import './ProductGallery.css'

interface Photo {
  src: string
  label: string
}

function photosForProduct(product: Product): Photo[] {
  const seen = new Set<string>()
  const photos: Photo[] = []
  for (const variant of [product, ...(product.variants ?? [])]) {
    if (!variant.image_url) continue
    const hash = variant.image_url.match(/\/([a-f0-9]{64})\.jpg(?:\?.*)?$/i)?.[1]
    const key = hash ? `sha256:${hash.toLowerCase()}` : variant.image_url
    if (seen.has(key)) continue
    seen.add(key)
    photos.push({ src: variant.image_url, label: formatVariant(variant) || variant.name })
  }
  return photos
}

function PhotoViewer({ photo, index, total, onClose, onMove }: {
  photo: Photo
  index: number
  total: number
  onClose: () => void
  onMove: (direction: number) => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const zoomRef = useRef(1)
  const previousZoom = useRef(1)
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    const dialog = dialogRef.current
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog?.showModal()
    return () => {
      dialog?.close()
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [])

  useEffect(() => {
    zoomRef.current = 1
    setZoom(1)
  }, [photo.src])

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const ratio = zoom / previousZoom.current
    viewport.scrollLeft = (viewport.scrollLeft + viewport.clientWidth / 2) * ratio - viewport.clientWidth / 2
    viewport.scrollTop = (viewport.scrollTop + viewport.clientHeight / 2) * ratio - viewport.clientHeight / 2
    previousZoom.current = zoom
    zoomRef.current = zoom
  }, [zoom])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    let startDistance = 0
    let startZoom = 1
    const distance = (event: globalThis.TouchEvent) => Math.hypot(
      event.touches[0].clientX - event.touches[1].clientX,
      event.touches[0].clientY - event.touches[1].clientY,
    )
    const start = (event: globalThis.TouchEvent) => {
      if (event.touches.length !== 2) return
      startDistance = distance(event)
      startZoom = zoomRef.current
    }
    const move = (event: globalThis.TouchEvent) => {
      if (event.touches.length !== 2 || !startDistance) return
      event.preventDefault()
      setZoom(Math.min(4, Math.max(1, startZoom * distance(event) / startDistance)))
    }
    const end = (event: globalThis.TouchEvent) => {
      if (event.touches.length < 2) startDistance = 0
    }
    viewport.addEventListener('touchstart', start, { passive: true })
    viewport.addEventListener('touchmove', move, { passive: false })
    viewport.addEventListener('touchend', end)
    viewport.addEventListener('touchcancel', end)
    return () => {
      viewport.removeEventListener('touchstart', start)
      viewport.removeEventListener('touchmove', move)
      viewport.removeEventListener('touchend', end)
      viewport.removeEventListener('touchcancel', end)
    }
  }, [])

  const changeZoom = (change: number) => setZoom((value) => Math.min(4, Math.max(1, value + change)))

  return (
    <dialog
      ref={dialogRef}
      className="product-photo-viewer"
      aria-label="Product photo viewer"
      onCancel={(event) => { event.preventDefault(); onClose() }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') { event.preventDefault(); onClose(); return }
        if (zoom !== 1 || total < 2) return
        if (event.key === 'ArrowLeft') { event.preventDefault(); onMove(-1) }
        if (event.key === 'ArrowRight') { event.preventDefault(); onMove(1) }
      }}
    >
      <div className="product-photo-viewer-toolbar">
        <span>{index + 1} / {total} · {photo.label}</span>
        <div className="product-photo-viewer-controls">
          <button type="button" aria-label="Zoom out" disabled={zoom <= 1} onClick={() => changeZoom(-0.5)}><Minus size={20} /></button>
          <span aria-live="polite">{Math.round(zoom * 100)}%</span>
          <button type="button" aria-label="Zoom in" disabled={zoom >= 4} onClick={() => changeZoom(0.5)}><Plus size={20} /></button>
          <button type="button" aria-label="Close photo viewer" onClick={onClose}><X size={22} /></button>
        </div>
      </div>
      <div className="product-photo-viewer-viewport" ref={viewportRef}>
        <div className="product-photo-viewer-image-area" style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}>
          <img src={photo.src} alt={photo.label} draggable={false} />
        </div>
      </div>
      {total > 1 && <div className="product-photo-viewer-navigation">
        <button type="button" aria-label="Previous photo" onClick={() => onMove(-1)}><ChevronLeft /></button>
        <button type="button" aria-label="Next photo" onClick={() => onMove(1)}><ChevronRight /></button>
      </div>}
    </dialog>
  )
}

export default function ProductGallery({ product }: { product: Product }) {
  const photos = photosForProduct(product)
  const [index, setIndex] = useState(0)
  const [viewerOpen, setViewerOpen] = useState(false)
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const lastSwipe = useRef(0)
  const photo = photos[index]
  const move = (direction: number) => setIndex((current) => (current + direction + photos.length) % photos.length)

  const onTouchStart = (event: TouchEvent) => {
    lastSwipe.current = 0
    touchStart.current = event.touches.length === 1
      ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
      : null
  }
  const onTouchEnd = (event: TouchEvent) => {
    if (!touchStart.current || photos.length < 2) return
    const dx = event.changedTouches[0].clientX - touchStart.current.x
    const dy = event.changedTouches[0].clientY - touchStart.current.y
    touchStart.current = null
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      lastSwipe.current = Date.now()
      move(dx < 0 ? 1 : -1)
    }
  }

  return (
    <div className="product-gallery" aria-label="Product photos">
      <div className="product-detail-image-wrap" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {photo ? (
          <button type="button" className="product-gallery-image-button" aria-label={`Open photo ${index + 1} of ${photos.length} full screen`} onClick={() => {
            if (lastSwipe.current && Date.now() - lastSwipe.current < 500) { lastSwipe.current = 0; return }
            setViewerOpen(true)
          }}>
            <img src={photo.src} alt={photo.label} className="product-detail-image" />
          </button>
        ) : (
          <div className="product-detail-image placeholder" role="img" aria-label="Moksha Collections"><span className="mc-mark">mc</span></div>
        )}
        {photos.length > 1 && <>
          <button type="button" className="product-gallery-arrow is-previous" aria-label="Previous photo" onClick={() => move(-1)}><ChevronLeft /></button>
          <button type="button" className="product-gallery-arrow is-next" aria-label="Next photo" onClick={() => move(1)}><ChevronRight /></button>
        </>}
      </div>
      {photos.length > 1 && <>
        <div className="product-gallery-dots" role="group" aria-label="Choose a product photo">
          {photos.map((item, photoIndex) => (
            <button type="button" key={item.src} aria-label={`Show photo ${photoIndex + 1}: ${item.label}`} aria-pressed={index === photoIndex} onClick={() => setIndex(photoIndex)} />
          ))}
        </div>
      </>}
      {photo && (photos.length > 1 || !product.image_url) && (
        <p className="product-gallery-caption">
          Photo: {photo.label}. {photos.length > 1
            ? 'Browsing photos does not change your selected size or colour.'
            : 'This photo belongs to another size or colour.'}
        </p>
      )}
      {viewerOpen && photo && <PhotoViewer photo={photo} index={index} total={photos.length} onClose={() => setViewerOpen(false)} onMove={move} />}
    </div>
  )
}
