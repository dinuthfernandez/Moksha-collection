import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createAudioContext, startLaunchMusic, type LaunchMusic } from '../utils/launchMusic'
import './Launch.css'

const API = import.meta.env.VITE_API_BASE_URL || '/api'
const COUNTDOWN_SECONDS = 10
const POLL_MS = 600
const RING = 2 * Math.PI * 90

interface LaunchStatus { triggered_at: number | null; server_time: number; countdown_seconds: number }

export default function Launch() {
  const navigate = useNavigate()
  const [started, setStarted] = useState(false)
  const [count, setCount] = useState(COUNTDOWN_SECONDS)
  const startedRef = useRef(false)
  const startAtRef = useRef(0)
  const audioRef = useRef<AudioContext | null>(null)
  const musicRef = useRef<LaunchMusic | null>(null)
  const finishedRef = useRef(false)

  const embers = useMemo(
    () => Array.from({ length: 36 }, () => ({
      left: Math.random() * 100,
      size: 2 + Math.random() * 4,
      delay: Math.random() * 6,
      dur: 4 + Math.random() * 5,
    })),
    [],
  )

  // Browsers only allow audio after a user gesture, so it is armed silently on load
  // and again on the first click, tap or key press anywhere on the page.
  const enableSound = useCallback(() => {
    if (!audioRef.current) audioRef.current = createAudioContext()
    else if (audioRef.current.state !== 'running') void audioRef.current.resume()
  }, [])

  useEffect(() => {
    enableSound()
    const events = ['pointerdown', 'touchstart', 'keydown', 'click'] as const
    events.forEach((ev) => window.addEventListener(ev, enableSound, { passive: true }))
    return () => events.forEach((ev) => window.removeEventListener(ev, enableSound))
  }, [enableSound])

  const begin = useCallback((startAtMs: number) => {
    if (startedRef.current) return
    startedRef.current = true
    startAtRef.current = startAtMs
    const remaining = Math.max(COUNTDOWN_SECONDS - (Date.now() - startAtMs) / 1000, 1)
    musicRef.current = startLaunchMusic(remaining, audioRef.current)
    setStarted(true)
  }, [])

  useEffect(() => () => { if (!finishedRef.current) musicRef.current?.stop() }, [])

  // Space starts it locally (also arms sound); the /launchbutton buzzer starts it remotely.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      e.preventDefault()
      enableSound()
      begin(Date.now())
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [begin, enableSound])

  useEffect(() => {
    if (started) return
    let stopped = false
    const poll = async () => {
      try {
        const t0 = Date.now()
        const res = await fetch(`${API}/launch/status`, { cache: 'no-store' })
        if (!res.ok || stopped) return
        const s = (await res.json()) as LaunchStatus
        if (s.triggered_at == null) return
        // Align to the server clock so every screen counts down together.
        const offset = s.server_time * 1000 - (t0 + Date.now()) / 2
        begin(s.triggered_at * 1000 - offset)
      } catch { /* retry on next poll */ }
    }
    poll()
    const id = window.setInterval(poll, POLL_MS)
    return () => { stopped = true; window.clearInterval(id) }
  }, [started, begin])

  useEffect(() => {
    if (!started) return
    const tick = () => {
      const remaining = COUNTDOWN_SECONDS - (Date.now() - startAtRef.current) / 1000
      setCount(Math.max(Math.ceil(remaining), 0))
    }
    tick()
    const id = window.setInterval(tick, 100)
    return () => window.clearInterval(id)
  }, [started])

  useEffect(() => {
    if (started && count <= 0) {
      finishedRef.current = true
      navigate('/', { replace: true, state: { celebrate: true } })
    }
  }, [started, count, navigate])

  return (
    <main className={`launch${started ? ' launch--live' : ''}`}>
      <div className="launch-glow launch-glow--a" aria-hidden="true" />
      <div className="launch-glow launch-glow--b" aria-hidden="true" />

      {!started ? (
        <div className="launch-idle">
          <span className="launch-eyebrow">The wait is over</span>
          <h1>Moksha Collections</h1>
        </div>
      ) : (
        <>
          <div className="launch-fx" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => <span key={i} className="launch-wave" style={{ animationDelay: `${i * 0.8}s` }} />)}
            {embers.map((e, i) => (
              <span
                key={i}
                className="launch-ember"
                style={{ left: `${e.left}%`, width: e.size, height: e.size, animationDelay: `${e.delay}s`, animationDuration: `${e.dur}s` }}
              />
            ))}
          </div>
          <div className="launch-live">
            <span className="launch-eyebrow">We are officially</span>
            <h1 className="launch-title">LIVE</h1>
            <div className="launch-ring" role="timer" aria-live="off">
              <svg viewBox="0 0 200 200" aria-hidden="true">
                <circle cx="100" cy="100" r="90" className="launch-ring-track" />
                <circle
                  cx="100" cy="100" r="90" className="launch-ring-bar"
                  strokeDasharray={RING}
                  strokeDashoffset={RING * (1 - count / COUNTDOWN_SECONDS)}
                />
              </svg>
              <span key={count} className="launch-count">{count}</span>
            </div>
            <p>Welcome to Moksha Collections</p>
          </div>
        </>
      )}
    </main>
  )
}
