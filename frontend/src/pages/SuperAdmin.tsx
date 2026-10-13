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
  uptime_seconds: number
  python: string
  platform: string
  shell_enabled: boolean
  zoho_configured: boolean
  counts: Record<string, number>
}
interface ShellResult { stdout: string; stderr: string; exit_code: number; cwd: string; seconds: number }
interface ShellLine { kind: 'cmd' | 'out' | 'err' | 'meta'; text: string }

const TABS = ['Overview', 'Shell', 'Logs', 'Data', 'Audit'] as const
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
              <button onClick={() => runAction('zoho-sync')}>Run Zoho sync now</button>
              <button className="sa-ghost" onClick={loadOverview}>Refresh</button>
            </div>
          </div>
        </section>
      )}

      {tab === 'Shell' && <ShellTab token={token} enabled={overview?.shell_enabled ?? true} guard={guard} />}
      {tab === 'Logs' && <LogsTab token={token} guard={guard} />}
      {tab === 'Data' && <DataTab token={token} guard={guard} />}
      {tab === 'Audit' && <AuditTab token={token} guard={guard} />}
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
