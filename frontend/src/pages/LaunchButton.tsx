import { useEffect, useRef, useState } from 'react'
import './LaunchButton.css'

const API = import.meta.env.VITE_API_BASE_URL || '/api'
const LOCK_MS = 20_000

type Phase = 'ready' | 'sending' | 'launched' | 'error'

export default function LaunchButton() {
  const [phase, setPhase] = useState<Phase>('ready')
  const [pressed, setPressed] = useState(false)
  const [message, setMessage] = useState('')
  const unlockTimer = useRef<number>()

  useEffect(() => () => window.clearTimeout(unlockTimer.current), [])

  const fire = async () => {
    if (phase === 'sending' || phase === 'launched') return
    setPressed(true)
    navigator.vibrate?.(80)
    setPhase('sending')
    try {
      const res = await fetch(`${API}/launch/trigger`, { method: 'POST' })
      if (!res.ok) throw new Error('Launch failed')
      setPhase('launched')
      setMessage('Launch started')
      unlockTimer.current = window.setTimeout(() => { setPhase('ready'); setMessage('') }, LOCK_MS)
    } catch {
      setPhase('error')
      setMessage('Could not reach the server')
      unlockTimer.current = window.setTimeout(() => { setPhase('ready'); setMessage('') }, 3000)
    }
  }

  const release = () => setPressed(false)
  const locked = phase === 'sending' || phase === 'launched'
  const down = pressed || locked

  return (
    <div className={`lb-root lb-${phase}`}>
      <header className="lb-top">
        <span>Moksha Collections · Launch control</span>
      </header>

      <div className="lb-stage">
        <div className="lb-halo" aria-hidden="true" />
        <div className="lb-base">
          <div className="lb-ring">
            <button
              type="button"
              className={`lb-button${down ? ' down' : ''}`}
              onPointerDown={fire}
              onPointerUp={release}
              onPointerLeave={release}
              onPointerCancel={release}
              onKeyDown={(e) => { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); void fire() } }}
              aria-label="Launch the website"
              disabled={locked}
            >
              <span className="lb-gloss" aria-hidden="true" />
              <span className="lb-label">{phase === 'launched' ? 'LIVE' : phase === 'sending' ? '…' : 'LAUNCH'}</span>
            </button>
          </div>
        </div>
      </div>

      <p className="lb-status" role="status">
        {message || (phase === 'ready' ? 'Press the buzzer to launch the website' : '')}
      </p>
    </div>
  )
}
