import { useEffect, useState } from 'react'
import { getSizeCharts } from '../api/sizeCharts'
import type { SizeChart } from '../types'
import SizeChartCard from '../components/ui/SizeChartCard'
import './SizeCharts.css'

const FALLBACK_CHARTS: SizeChart[] = [
  { id: 'common', name: 'Common Size Chart', slug: 'common', icon_url: '/assets/size-charts/commonsize.png', chart_image_urls: ['/assets/size-charts/Common.jpg'], display_order: 1 },
  { id: 'bottom', name: 'Pencil Bottom Size Chart', slug: 'pencil-bottom', icon_url: '/assets/size-charts/pencilbottom.png', chart_image_urls: ['/assets/size-charts/Bottom.jpg'], display_order: 2 },
  { id: 'kurthi', name: 'Kurti Size Chart', slug: 'kurti', icon_url: '/assets/size-charts/kurthi.png', chart_image_urls: ['/assets/size-charts/Kurthi.jpg'], display_order: 3 },
  { id: 'anarkali', name: 'Anarkali Size Chart', slug: 'anarkali', icon_url: '/assets/size-charts/anarkali.png', chart_image_urls: ['/assets/size-charts/anarkali1.jpg', '/assets/size-charts/anarkali2.jpg'], display_order: 4 },
  { id: 'aline', name: 'Aline Size Chart', slug: 'aline', icon_url: '/assets/size-charts/aline.png', chart_image_urls: ['/assets/size-charts/aline1.jpg', '/assets/size-charts/aline2.jpg'], display_order: 5 },
  { id: 'gown', name: 'Gown Size Chart', slug: 'gown', icon_url: '/assets/size-charts/gown.png', chart_image_urls: ['/assets/size-charts/gown1.jpg', '/assets/size-charts/gown2.jpg'], display_order: 6 },
  { id: 'blouse', name: 'Blouse Size Chart', slug: 'blouse', icon_url: '/assets/size-charts/blouse.png', chart_image_urls: ['/assets/size-charts/blouse.jpg'], display_order: 7 },
  { id: 'fishcut', name: 'Fishcut Size Chart', slug: 'fishcut', icon_url: '/assets/size-charts/fishcut.png', chart_image_urls: ['/assets/size-charts/fishcut.jpg'], display_order: 8 },
  { id: 'saree', name: 'Saree Size Chart', slug: 'saree', icon_url: '/assets/size-charts/saree.png', chart_image_urls: ['/assets/size-charts/saree.jpg'], display_order: 9 },
]

export default function SizeCharts() {
  const [charts, setCharts] = useState<SizeChart[]>(FALLBACK_CHARTS)

  useEffect(() => {
    let mounted = true
    getSizeCharts()
      .then((data) => mounted && data.length > 0 && setCharts(data))
      .catch(() => {
        /* keep fallback charts if the API/DB isn't seeded yet */
      })
    return () => {
      mounted = false
    }
  }, [])

  return (
    <div className="container size-charts-page">
      <div className="section-heading">
        <span className="eyebrow">Fit Guide</span>
        <h1 className="section-title">Size Charts</h1>
        <p className="section-subtitle">Find the perfect fit for every silhouette we carry.</p>
      </div>

      <div className="size-charts-grid">
        {charts
          .slice()
          .sort((a, b) => a.display_order - b.display_order)
          .map((chart) => (
            <SizeChartCard key={chart.id} chart={chart} />
          ))}
      </div>
    </div>
  )
}
