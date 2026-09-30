import { useEffect, useMemo, useState } from 'react'
import {
  Check,
  Copy,
  ExternalLink,
  Facebook,
  Globe2,
  Instagram,
  Linkedin,
  Mail,
  MessageCircle,
  Music2,
  RefreshCw,
  Search,
  Trash2,
  Youtube,
} from 'lucide-react'
import {
  clearWebsiteAnalytics,
  getWebsiteAnalytics,
  type AnalyticsChannel,
  type AnalyticsSource,
} from '../../api/analytics'
import { AdminApiError } from '../../api/adminClient'
import './AdminAnalytics.css'

const CHANNELS: Array<{
  source: AnalyticsSource
  label: string
  medium: string
  icon: typeof Facebook
  color: string
}> = [
  { source: 'facebook', label: 'Facebook', medium: 'social', icon: Facebook, color: '#1877f2' },
  { source: 'instagram', label: 'Instagram', medium: 'social', icon: Instagram, color: '#e4405f' },
  { source: 'youtube', label: 'YouTube', medium: 'video', icon: Youtube, color: '#ff0033' },
  { source: 'whatsapp', label: 'WhatsApp', medium: 'messaging', icon: MessageCircle, color: '#25d366' },
  { source: 'tiktok', label: 'TikTok', medium: 'social', icon: Music2, color: '#ff4267' },
  { source: 'linkedin', label: 'LinkedIn', medium: 'social', icon: Linkedin, color: '#0a66c2' },
  { source: 'email', label: 'Email', medium: 'email', icon: Mail, color: '#d99000' },
  { source: 'google', label: 'Google / Web', medium: 'search', icon: Search, color: '#4aa373' },
  { source: 'direct', label: 'Direct / Untagged', medium: 'direct', icon: Globe2, color: '#c8cad0' },
  { source: 'other', label: 'Other tagged links', medium: 'referral', icon: ExternalLink, color: '#e10a8c' },
]

const CLEAR_PHRASE = 'CLEAR ANALYTICS'

function makeTrackedHomepage(source: AnalyticsSource, medium: string) {
  const url = new URL('/', window.location.origin)
  url.searchParams.set('utm_source', source)
  url.searchParams.set('utm_medium', medium)
  url.searchParams.set('utm_campaign', 'website_visits')
  return url.toString()
}

function formatVisitDate(value: string | null) {
  if (!value) return 'No visits yet'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'No visits yet' : `Last visit ${date.toLocaleString()}`
}

export default function AdminAnalytics() {
  const [channels, setChannels] = useState<AnalyticsChannel[]>([])
  const [totalVisits, setTotalVisits] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [copiedSource, setCopiedSource] = useState<AnalyticsSource | null>(null)
  const [confirmation, setConfirmation] = useState('')
  const [clearing, setClearing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadAnalytics = async (quiet = false) => {
    if (quiet) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const result = await getWebsiteAnalytics()
      setChannels(result.channels)
      setTotalVisits(result.total_visits)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load analytics')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void loadAnalytics()
    const timer = window.setInterval(() => void loadAnalytics(true), 10_000)
    return () => window.clearInterval(timer)
  }, [])

  const visitsBySource = useMemo(() => new Map(channels.map((channel) => [channel.source, channel])), [channels])

  const copyLink = async (source: AnalyticsSource, medium: string) => {
    try {
      await navigator.clipboard.writeText(makeTrackedHomepage(source, medium))
      setCopiedSource(source)
      setMessage(`${CHANNELS.find((channel) => channel.source === source)?.label} link copied`)
      window.setTimeout(() => setCopiedSource(null), 1800)
    } catch {
      setError('Clipboard access failed. Select and copy the link manually.')
    }
  }

  const handleClear = async () => {
    if (confirmation !== CLEAR_PHRASE) return
    setClearing(true)
    setError(null)
    setMessage(null)
    try {
      const result = await clearWebsiteAnalytics(confirmation)
      setChannels(CHANNELS.map(({ source }) => ({ source, visits: 0, last_visit: null })))
      setTotalVisits(0)
      setConfirmation('')
      setMessage(`${result.deleted} analytics visits cleared`)
    } catch (reason) {
      setError(reason instanceof AdminApiError ? reason.message : 'Could not clear analytics')
    } finally {
      setClearing(false)
    }
  }

  return (
    <div className="admin-analytics">
      <header className="admin-analytics-header">
        <div>
          <span className="eyebrow">Traffic Sources</span>
          <h1 className="section-title">Analytics</h1>
          <p>Visits are counted once per browser session from tagged links.</p>
        </div>
        <button type="button" className="btn btn-outline" onClick={() => void loadAnalytics(true)} disabled={refreshing || loading}>
          <RefreshCw size={16} className={refreshing ? 'is-spinning' : ''} /> Refresh
        </button>
      </header>

      {error && <p className="admin-analytics-message is-error" role="alert">{error}</p>}
      {message && <p className="admin-analytics-message" role="status">{message}</p>}

      <section className="admin-analytics-total" aria-label="Total website visits">
        <span>Total tracked visits</span>
        <strong>{loading ? '—' : totalVisits.toLocaleString()}</strong>
        <small>All tracked sources</small>
      </section>

      <div className="admin-analytics-grid">
        {CHANNELS.map(({ source, label, medium, icon: Icon, color }) => {
          const channel = visitsBySource.get(source)
          const copied = copiedSource === source
          return (
            <article className="admin-analytics-card" key={source}>
              <div className="admin-analytics-card-top">
                <span className="admin-analytics-icon" style={{ color }}><Icon size={20} strokeWidth={1.8} /></span>
                <span className="admin-analytics-count">{loading ? '—' : (channel?.visits ?? 0).toLocaleString()}</span>
              </div>
              <h2>{label}</h2>
              <p>{formatVisitDate(channel?.last_visit ?? null)}</p>
              <label className="admin-analytics-link-label" htmlFor={`analytics-link-${source}`}>Homepage tracking link</label>
              <input id={`analytics-link-${source}`} readOnly value={makeTrackedHomepage(source, medium)} onFocus={(event) => event.currentTarget.select()} />
              <button type="button" className="btn btn-outline admin-analytics-copy" onClick={() => void copyLink(source, medium)}>
                {copied ? <Check size={15} /> : <Copy size={15} />}
                {copied ? 'Copied' : 'Copy link'}
              </button>
            </article>
          )
        })}
      </div>

      <section className="admin-analytics-clear" aria-labelledby="analytics-clear-title">
        <div>
          <h2 id="analytics-clear-title">Clear visit history</h2>
          <p>This permanently resets all channel counters. New visits will start counting immediately afterward.</p>
        </div>
        <div className="admin-analytics-clear-controls">
          <label htmlFor="analytics-clear-confirmation">Type {CLEAR_PHRASE} to confirm</label>
          <input
            id="analytics-clear-confirmation"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <button type="button" className="btn btn-outline admin-analytics-clear-button" onClick={() => void handleClear()} disabled={clearing || confirmation !== CLEAR_PHRASE}>
            <Trash2 size={16} /> {clearing ? 'Clearing…' : 'Clear analytics'}
          </button>
        </div>
      </section>
    </div>
  )
}