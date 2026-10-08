interface BrandLoaderProps {
  fullScreen?: boolean
  label?: string
}

export default function BrandLoader({ fullScreen = true, label = 'Loading' }: BrandLoaderProps) {
  return (
    <div className={`brand-loader${fullScreen ? ' brand-loader--full' : ''}`} role="status" aria-live="polite">
      <div className="brand-loader__mark">
        <span className="brand-loader__ring" />
        <span className="brand-loader__ring brand-loader__ring--2" />
        <img src="/assets/logo/logo.png" alt="Moksha Collections" />
      </div>
      <div className="brand-loader__bar"><span /></div>
      <p className="brand-loader__label">{label}</p>
    </div>
  )
}

export function ProductDetailSkeleton() {
  return (
    <div className="container product-detail-page skeleton-detail" aria-busy="true">
      <div className="skeleton-block skeleton-detail__image" />
      <div className="skeleton-detail__info">
        <div className="skeleton-block" style={{ height: 32, width: '70%' }} />
        <div className="skeleton-block" style={{ height: 24, width: '30%' }} />
        <div className="skeleton-block" style={{ height: 90 }} />
        <div className="skeleton-block" style={{ height: 48, width: '60%' }} />
        <div className="skeleton-block" style={{ height: 52 }} />
      </div>
    </div>
  )
}
