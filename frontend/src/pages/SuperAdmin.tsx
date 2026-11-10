import { useCallback, useEffect, useRef, useState } from 'react'
import './SuperAdmin.css'

const API = import.meta.env.VITE_API_BASE_URL || '/api'
const TOKEN_KEY = 'moksha-superadmin-token'

async function call<T>(path: string, token: string | null, body?: unknown): Promise<T> {
  const res = await fetch(`${API}/superadmin${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) {
    let detail = res.statusText
    try { detail = (await res.json())?.detail || detail } catch { /* ignore */ }
    const err = new Error(typeof detail === 'string' ? detail : 'Request failed') as Error & { status: number }
    err.status = res.status
    throw err
  }
  return res.json() as Promise<T>
}

interface Overview {
  maintenance: { enabled: boolean; message: string; eta: string; since: string | null }
  has_bypass_password: boolean
  uptime_seconds: number
  python: string
  platform: string
  shell_enabled: boolean
  zoho_configured: boolean
  counts: Record<string, number>
}
interface ShellResult { stdout: string; stderr: string; exit_code: number; cwd: string; seconds: number }
interface ShellLine { kind: 'cmd' | 'out' | 'err' | 'meta'; text: string }

const TABS = ['Overview', 'Customers', 'Shell', 'Logs', 'Data', 'Audit'] as const
type Tab = (typeof TABS)[number]
const TABLES = ['orders', 'order_items', 'customers', 'products', 'categories', 'campaigns', 'coupons', 'cart_reservations']

function formatUptime(s: number) {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60)
  return `${d ? `${d}d ` : ''}${h}h ${m}m`
}

export default function SuperAdmin() {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(TOKEN_KEY))
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState<Tab>('Overview')
  const [overview, setOverview] = useState<Overview | null>(null)
  const [notice, setNotice] = useState('')
  const [mtMessage, setMtMessage] = useState('')
  const [mtEta, setMtEta] = useState('')
  const [bypassPw, setBypassPw] = useState('')

  const logout = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY)
    setToken(null)
  }, [])

  const guard = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    try {
      return await fn()
    } catch (e) {
      const err = e as Error & { status?: number }
      if (err.status === 401) logout()
      setNotice(err.message)
      return undefined
    }
  }, [logout])

  const loadOverview = useCallback(async () => {
    const data = await guard(() => call<Overview>('/overview', token))
    if (data) {
      setOverview(data)
      setMtMessage((m) => m || data.maintenance.message)
      setMtEta((m) => m || data.maintenance.eta)
    }
  }, [guard, token])

  useEffect(() => {
    if (token) loadOverview()
  }, [token, loadOverview])

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setLoginError('')
    try {
      const res = await call<{ access_token: string }>('/login', null, { password })
      sessionStorage.setItem(TOKEN_KEY, res.access_token)
      setToken(res.access_token)
      setPassword('')
    } catch (err) {
      setLoginError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const toggleMaintenance = async (enabled: boolean) => {
    if (enabled && !window.confirm('Turn ON maintenance? The whole website (including the admin panel) will show only the maintenance page.')) return
    const res = await guard(() => call('/maintenance', token, { enabled, message: mtMessage, eta: mtEta }))
    if (res) {
      setNotice(enabled ? 'Maintenance is ON — the site is now closed to visitors.' : 'Maintenance is OFF — the site is live.')
      loadOverview()
    }
  }

  const saveBypass = async (value: string) => {
    const res = await guard(() => call('/bypass-password', token, { password: value }))
    if (res) {
      setBypassPw('')
      setNotice(value ? 'Bypass password saved.' : 'Bypass password removed.')
      loadOverview()
    }
  }

  const runAction = async (action: 'clear-cache' | 'zoho-sync') => {
    setNotice('Working…')
    const res = await guard(() => call<{ message: string }>(`/actions/${action}`, token, {}))
    if (res) { setNotice(res.message); loadOverview() }
  }

  if (!token) {
    return (
      <div className="sa-login">
        <form className="sa-login-card" onSubmit={onLogin} autoComplete="off">
          <h1>Restricted</h1>
          <input type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Access key" />
          {loginError && <p className="sa-error">{loginError}</p>}
          <button type="submit" disabled={busy || !password}>{busy ? 'Checking…' : 'Enter'}</button>
        </form>
      </div>
    )
  }

  return (
    <div className="sa-app">
      <header className="sa-header">
        <div>
          <span className="sa-badge">SUPER ADMIN</span>
          <h1>Moksha Control Room</h1>
        </div>
        <button className="sa-ghost" onClick={logout}>Lock</button>
      </header>

      <nav className="sa-tabs">
        {TABS.map((t) => (
          <button key={t} className={t === tab ? 'active' : ''} onClick={() => setTab(t)}>{t}</button>
        ))}
      </nav>

      {notice && <div className="sa-notice" onClick={() => setNotice('')}>{notice}</div>}

      {tab === 'Overview' && overview && (
        <section className="sa-grid">
          <div className={`sa-card sa-maint ${overview.maintenance.enabled ? 'on' : ''}`}>
            <h2>Maintenance mode</h2>
            <p className="sa-status">{overview.maintenance.enabled ? '● Site is CLOSED (maintenance page showing)' : '● Site is LIVE'}</p>
            <label>Message shown to visitors
              <textarea rows={3} value={mtMessage} onChange={(e) => setMtMessage(e.target.value)} placeholder="We're upgrading our store…" />
            </label>
            <label>Expected back (optional)
              <input value={mtEta} onChange={(e) => setMtEta(e.target.value)} placeholder="Today 6:00 PM" />
            </label>
            <div className="sa-row">
              {overview.maintenance.enabled ? (
                <>
                  <button className="sa-go" onClick={() => toggleMaintenance(false)}>Bring site back online</button>
                  <button className="sa-ghost" onClick={() => toggleMaintenance(true)}>Update message</button>
                </>
              ) : (
                <button className="sa-danger" onClick={() => toggleMaintenance(true)}>Turn on maintenance</button>
              )}
            </div>
          </div>

          <div className="sa-card">
            <h2>Developer bypass password</h2>
            <p className="sa-status">
              {overview.has_bypass_password ? '● A bypass password is set' : '● No bypass password — nobody can get past maintenance'}
            </p>
            <label>New bypass password (min 8 characters)
              <input type="password" autoComplete="new-password" value={bypassPw} onChange={(e) => setBypassPw(e.target.value)} placeholder="Leave empty & press Remove to disable" />
            </label>
            <div className="sa-row">
              <button className="sa-go" disabled={bypassPw.length < 8} onClick={() => saveBypass(bypassPw)}>Save password</button>
              {overview.has_bypass_password && <button className="sa-ghost" onClick={() => saveBypass('')}>Remove</button>}
            </div>
            <p className="sa-status" style={{ fontSize: 12 }}>
              While maintenance is ON, developers open the site, tap “Developer access” on the maintenance page and enter this password. Changing or removing it instantly logs out every developer.
            </p>
          </div>

          <MetricsCard token={token} />

          <div className="sa-card">
            <h2>Live numbers</h2>
            <ul className="sa-stats">
              {Object.entries(overview.counts).map(([k, v]) => (
                <li key={k}><strong>{v < 0 ? '—' : v}</strong><span>{k.replace('_', ' ')}</span></li>
              ))}
            </ul>
          </div>

          <div className="sa-card">
            <h2>Server</h2>
            <ul className="sa-kv">
              <li><span>Uptime</span><b>{formatUptime(overview.uptime_seconds)}</b></li>
              <li><span>Python</span><b>{overview.python}</b></li>
              <li><span>Platform</span><b>{overview.platform}</b></li>
              <li><span>Zoho</span><b>{overview.zoho_configured ? 'connected' : 'not configured'}</b></li>
              <li><span>Shell</span><b>{overview.shell_enabled ? 'enabled' : 'disabled'}</b></li>
            </ul>
          </div>

          <div className="sa-card">
            <h2>Quick actions</h2>
            <div className="sa-row">
              <button onClick={() => runAction('clear-cache')}>Clear catalog cache</button>
              <button className="sa-ghost" onClick={loadOverview}>Refresh</button>
            </div>
          </div>

          <ZohoSyncCard token={token} onDone={loadOverview} />
        </section>
      )}

      {tab === 'Customers' && <CustomerImpersonationTab token={token} />}
      {tab === 'Shell' && <ShellTab token={token} enabled={overview?.shell_enabled ?? true} guard={guard} />}
      {tab === 'Logs' && <LogsTab token={token} guard={guard} />}
      {tab === 'Data' && <DataTab token={token} guard={guard} />}
      {tab === 'Audit' && <AuditTab token={token} guard={guard} />}
    </div>
  )
}

interface SupportCustomer {
  id: string
  first_name: string
  last_name: string
  email: string
  phone_country_code: string
  phone: string
  is_active: boolean
  is_banned: boolean
}

function CustomerImpersonationTab({ token }: { token: string }) {
  const [query, setQuery] = useState('')
  const [customers, setCustomers] = useState<SupportCustomer[]>([])
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<SupportCustomer | null>(null)
  const [passwordStep, setPasswordStep] = useState<1 | 2>(1)
  const [password1, setPassword1] = useState('')
  const [password2, setPassword2] = useState('')

  const cancelUnlock = () => {
    setSelected(null)
    setPassword1('')
    setPassword2('')
    setPasswordStep(1)
  }

  const search = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    setSearched(false)
    setCustomers([])
    try {
      const data = await call<{ customers: SupportCustomer[] }>(`/customers/search?q=${encodeURIComponent(query.trim())}`, token)
      setCustomers(data.customers)
      setSearched(true)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const openCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) return
    if (passwordStep === 1) {
      setPasswordStep(2)
      return
    }
    const child = window.open('', '_blank')
    if (!child) {
      setError('The browser blocked the new window. Allow pop-ups and try again.')
      return
    }
    setError('')
    setBusy(true)
    try {
      const result = await call<{ access_token: string }>(`/customers/${selected.id}/impersonate`, token, {
        password_1: password1,
        password_2: password2,
      })
      child.sessionStorage.clear()
      child.sessionStorage.setItem('moksha-impersonation', 'true')
      child.sessionStorage.setItem('moksha-auth-token', result.access_token)
      child.opener = null
      child.location.replace('/account')
      cancelUnlock()
    } catch (e) {
      child.close()
      setError((e as Error).message)
      cancelUnlock()
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="sa-card">
      <h2>Customer support session</h2>
      <p>Search by name, email or phone. Sessions expire after 30 minutes and have full customer access, including orders and payments. Actions are logged.</p>
      <form className="sa-row" onSubmit={search}>
        <input aria-label="Customer name, email or phone" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, email or phone" required minLength={2} maxLength={100} />
        <button type="submit" disabled={busy}>{busy ? 'Searching…' : 'Search'}</button>
      </form>
      {error && <p className="sa-error" role="alert">{error}</p>}
      {selected && (
        <form className="sa-card" onSubmit={openCustomer}>
          <h2>Unlock session for {selected.first_name} {selected.last_name}</h2>
          <label>Impersonation password {passwordStep} of 2
            <input
              key={passwordStep}
              type="password"
              autoComplete="off"
              autoFocus
              required
              maxLength={200}
              value={passwordStep === 1 ? password1 : password2}
              onChange={(e) => passwordStep === 1 ? setPassword1(e.target.value) : setPassword2(e.target.value)}
            />
          </label>
          <div className="sa-row">
            <button type="submit" disabled={busy}>{passwordStep === 1 ? 'Next' : busy ? 'Opening…' : 'Open session'}</button>
            <button type="button" className="sa-ghost" disabled={busy} onClick={cancelUnlock}>Cancel</button>
          </div>
          <small>Both passwords are checked together when opening the session.</small>
        </form>
      )}
      {searched && customers.length === 0 && <p>No customers found.</p>}
      <div className="sa-customer-results">
        {customers.map((customer) => (
          <div className="sa-customer" key={customer.id}>
            <div><strong>{customer.first_name} {customer.last_name}</strong><br />{customer.email}<br />{customer.phone_country_code} {customer.phone}</div>
            <button type="button" disabled={!customer.is_active || customer.is_banned || busy} onClick={() => { cancelUnlock(); setError(''); setSelected(customer) }}>
              {!customer.is_active || customer.is_banned ? 'Unavailable' : 'Open customer'}
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

interface SyncStatus {
  running: boolean
  status: 'idle' | 'running' | 'done' | 'failed'
  percent: number
  message: string
  elapsed_seconds?: number
  log_total: number
  logs: string[]
}

function ZohoSyncCard({ token, onDone }: { token: string | null; onDone: () => void }) {
  const [sync, setSync] = useState<SyncStatus | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [error, setError] = useState('')
  const seen = useRef(0)
  const logBox = useRef<HTMLPreElement>(null)
  const wasRunning = useRef(false)

  const poll = useCallback(async () => {
    try {
      const s = await call<SyncStatus>(`/zoho-sync/status?since=${seen.current}`, token)
      seen.current = s.log_total
      if (s.logs.length) setLogs((l) => [...l, ...s.logs].slice(-500))
      setSync(s)
      setError('')
      if (wasRunning.current && !s.running) onDone()
      wasRunning.current = s.running
    } catch (e) {
      setError((e as Error).message)
    }
  }, [token, onDone])

  useEffect(() => {
    poll()
    const id = setInterval(poll, 1500)
    return () => clearInterval(id)
  }, [poll])

  useEffect(() => {
    if (logBox.current) logBox.current.scrollTop = logBox.current.scrollHeight
  }, [logs])

  const start = async () => {
    if (!window.confirm('Run a full sync from Zoho to the website now? This can take several minutes.')) return
    try {
      seen.current = 0
      setLogs([])
      await call('/zoho-sync/start', token, {})
      wasRunning.current = true
      poll()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const running = !!sync?.running
  const percent = Math.round(sync?.percent ?? 0)
  return (
    <div className="sa-card sa-sync">
      <h2>Zoho → Supabase sync</h2>
      <p className="sa-status">
        {running ? `● Running (${sync?.elapsed_seconds ?? 0}s)` : sync?.status === 'done' ? '● Last run finished' : sync?.status === 'failed' ? '● Last run failed' : '● Idle'}
      </p>
      <div className="sa-progress" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <div className={`sa-progress-bar ${sync?.status === 'failed' ? 'failed' : ''}`} style={{ width: `${percent}%` }} />
        <span>{percent}%</span>
      </div>
      <p className="sa-status" style={{ fontSize: 12 }}>{sync?.message ?? '—'}</p>
      {error && <p className="sa-error">{error}</p>}
      <div className="sa-row">
        <button className="sa-go" disabled={running} onClick={start}>{running ? 'Syncing…' : 'Run full sync now'}</button>
      </div>
      <p className="sa-status" style={{ fontSize: 12 }}>Syncs names, descriptions, prices, stock, images, categories, colors and sizes.</p>
      <pre className="sa-sync-log" ref={logBox}>{logs.length ? logs.join('\n') : 'Live log will appear here when a sync runs.'}</pre>
    </div>
  )
}

interface Metrics {
  source: 'container' | 'host'
  cpu_percent: number
  cpu_cores: number
  memory_percent: number
  memory_used_mb: number
  memory_total_mb: number
  process_cpu_percent: number
  process_memory_mb: number
}

const METRIC_POINTS = 60
const METRIC_INTERVAL_MS = 2000

function LineChart({ data, color }: { data: number[]; color: string }) {
  const w = 300, h = 90
  const step = w / (METRIC_POINTS - 1)
  const pts = data.map((v, i) => `${(w - (data.length - 1 - i) * step).toFixed(1)},${(h - (Math.min(v, 100) / 100) * h).toFixed(1)}`)
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="sa-chart">
      {[25, 50, 75].map((g) => <line key={g} x1="0" x2={w} y1={h - (g / 100) * h} y2={h - (g / 100) * h} stroke="#2a2038" strokeWidth="1" />)}
      {pts.length > 1 && (
        <>
          <polygon points={`${pts[0].split(',')[0]},${h} ${pts.join(' ')} ${w},${h}`} fill={color} opacity="0.15" />
          <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </>
      )}
    </svg>
  )
}

function MetricsCard({ token }: { token: string | null }) {
  const [cpu, setCpu] = useState<number[]>([])
  const [ram, setRam] = useState<number[]>([])
  const [latest, setLatest] = useState<Metrics | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let stopped = false
    const tick = async () => {
      if (document.hidden) return
      try {
        const m = await call<Metrics>('/metrics', token)
        if (stopped) return
        setLatest(m)
        setCpu((a) => [...a, m.cpu_percent].slice(-METRIC_POINTS))
        setRam((a) => [...a, m.memory_percent].slice(-METRIC_POINTS))
        setError('')
      } catch (e) {
        if (!stopped) setError((e as Error).message)
      }
    }
    tick()
    const id = setInterval(tick, METRIC_INTERVAL_MS)
    return () => { stopped = true; clearInterval(id) }
  }, [token])

  return (
    <div className="sa-card sa-metrics">
      <h2>Live CPU &amp; RAM {latest && <small>({latest.source === 'container' ? 'container limits' : 'this machine'})</small>}</h2>
      {error && <p className="sa-error">{error}</p>}
      <div className="sa-metric">
        <div className="sa-metric-head">
          <span>CPU</span>
          <b>{latest ? `${latest.cpu_percent}%` : '…'}</b>
          {latest && <small>{latest.cpu_cores} core(s) · app {latest.process_cpu_percent}%</small>}
        </div>
        <LineChart data={cpu} color="#E10A8C" />
      </div>
      <div className="sa-metric">
        <div className="sa-metric-head">
          <span>RAM</span>
          <b>{latest ? `${latest.memory_percent}%` : '…'}</b>
          {latest && <small>{latest.memory_used_mb} / {latest.memory_total_mb} MB · app {latest.process_memory_mb} MB</small>}
        </div>
        <LineChart data={ram} color="#4ac2ff" />
      </div>
    </div>
  )
}

type Guard = <T>(fn: () => Promise<T>) => Promise<T | undefined>

function ShellTab({ token, enabled, guard }: { token: string; enabled: boolean; guard: Guard }) {
  const [lines, setLines] = useState<ShellLine[]>([{ kind: 'meta', text: 'Real server shell. Every command is audited. Use with care.' }])
  const [cmd, setCmd] = useState('')
  const [cwd, setCwd] = useState('')
  const [running, setRunning] = useState(false)
  const history = useRef<string[]>([])
  const histIdx = useRef(-1)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView() }, [lines])

  const run = async () => {
    const command = cmd.trim()
    if (!command || running) return
    history.current.unshift(command)
    histIdx.current = -1
    setCmd('')
    setRunning(true)
    setLines((l) => [...l, { kind: 'cmd', text: `${cwd ? cwd + ' ' : ''}> ${command}` }])
    const res = await guard(() => call<ShellResult>('/shell', token, { command }))
    setRunning(false)
    if (!res) return
    setCwd(res.cwd)
    setLines((l) => [
      ...l,
      ...(res.stdout ? [{ kind: 'out' as const, text: res.stdout }] : []),
      ...(res.stderr ? [{ kind: 'err' as const, text: res.stderr }] : []),
      { kind: 'meta' as const, text: `exit ${res.exit_code} · ${res.seconds}s` },
    ])
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') run()
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      histIdx.current = Math.min(histIdx.current + 1, history.current.length - 1)
      setCmd(history.current[histIdx.current] ?? '')
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      histIdx.current = Math.max(histIdx.current - 1, -1)
      setCmd(histIdx.current < 0 ? '' : history.current[histIdx.current])
    }
  }

  if (!enabled) return <div className="sa-card"><p>Shell is disabled. Set <code>SUPERADMIN_SHELL_ENABLED=true</code> in the server environment to use it.</p></div>

  return (
    <div className="sa-terminal">
      <div className="sa-term-out">
        {lines.map((l, i) => <pre key={i} className={`sa-${l.kind}`}>{l.text}</pre>)}
        {running && <pre className="sa-meta">running…</pre>}
        <div ref={endRef} />
      </div>
      <div className="sa-term-in">
        <span>{cwd ? `${cwd} >` : '>'}</span>
        <input value={cmd} onChange={(e) => setCmd(e.target.value)} onKeyDown={onKey} autoFocus spellCheck={false} placeholder="type a command and press Enter" />
      </div>
    </div>
  )
}

function LogsTab({ token, guard }: { token: string; guard: Guard }) {
  const [lines, setLines] = useState<string[]>([])
  const load = useCallback(async () => {
    const res = await guard(() => call<{ lines: string[] }>('/logs?limit=300', token))
    if (res) setLines(res.lines)
  }, [guard, token])
  useEffect(() => {
    load()
    const id = window.setInterval(load, 4000)
    return () => window.clearInterval(id)
  }, [load])
  return <pre className="sa-logs">{lines.length ? lines.join('\n') : 'No log lines yet.'}</pre>
}

function DataTab({ token, guard }: { token: string; guard: Guard }) {
  const [table, setTable] = useState(TABLES[0])
  const [rows, setRows] = useState<unknown[]>([])
  useEffect(() => {
    guard(() => call<{ rows: unknown[] }>(`/tables/${table}?limit=50`, token)).then((r) => r && setRows(r.rows))
  }, [table, token, guard])
  return (
    <div className="sa-card">
      <label>Table (read-only, latest 50, secrets hidden)
        <select value={table} onChange={(e) => setTable(e.target.value)}>{TABLES.map((t) => <option key={t}>{t}</option>)}</select>
      </label>
      <pre className="sa-logs">{JSON.stringify(rows, null, 2)}</pre>
    </div>
  )
}

function AuditTab({ token, guard }: { token: string; guard: Guard }) {
  const [entries, setEntries] = useState<{ at: string; ip: string; action: string; detail: string }[]>([])
  useEffect(() => {
    guard(() => call<{ entries: typeof entries }>('/audit', token)).then((r) => r && setEntries(r.entries))
  }, [token, guard])
  return (
    <div className="sa-card">
      <h2>Security audit (since last server start)</h2>
      <table className="sa-table">
        <thead><tr><th>Time</th><th>IP</th><th>Action</th><th>Detail</th></tr></thead>
        <tbody>
          {entries.map((e, i) => (
            <tr key={i}><td>{new Date(e.at).toLocaleString()}</td><td>{e.ip}</td><td>{e.action}</td><td>{e.detail}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
