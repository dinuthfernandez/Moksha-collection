import { useState } from 'react'
import type { SizeChart } from '../../types'
import './SizeChartCard.css'

export default function SizeChartCard({ chart }: { chart: SizeChart }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div className="size-chart-card">
        <img src={chart.icon_url} alt={chart.name} className="size-chart-icon" />
        <h3>{chart.name}</h3>
        <button className="btn btn-outline" onClick={() => setOpen(true)}>
          View Size Chart
        </button>
      </div>

      {open && (
        <div className="size-chart-modal" onClick={() => setOpen(false)}>
          <div className="size-chart-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="size-chart-modal-close" aria-label="Close" onClick={() => setOpen(false)}>
              &times;
            </button>
            {chart.chart_image_urls.map((src) => (
              <img key={src} src={src} alt={`${chart.name} size chart`} />
            ))}
          </div>
        </div>
      )}
    </>
  )
}
