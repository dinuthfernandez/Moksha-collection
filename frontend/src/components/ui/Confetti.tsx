import { useEffect, useRef } from 'react'

const COLORS = ['#E10A8C', '#FAF7F2', '#C8CAD0', '#FFD166', '#B80873', '#7BDFF2']

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  rot: number
  vr: number
  shape: 0 | 1 | 2
  age: number
  ttl: number
}

interface Props {
  durationMs: number
  /** rain: confetti falling from the top. celebrate: cannons + bursts. */
  mode?: 'rain' | 'celebrate'
  onDone?: () => void
}

const rand = (min: number, max: number) => min + Math.random() * (max - min)
const pick = () => COLORS[Math.floor(Math.random() * COLORS.length)]

function make(x: number, y: number, vx: number, vy: number, ttl = 4): Particle {
  return {
    x, y, vx, vy, size: rand(6, 12), color: pick(), rot: rand(0, Math.PI * 2),
    vr: rand(-8, 8), shape: Math.floor(Math.random() * 3) as 0 | 1 | 2, age: 0, ttl,
  }
}

export default function Confetti({ durationMs, mode = 'rain', onDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let w = 0, h = 0
    const resize = () => {
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const particles: Particle[] = []
    const start = performance.now()
    let last = start
    let sinceBurst = 0
    let raf = 0
    let finished = false

    const burst = (cx: number, cy: number, count: number) => {
      for (let i = 0; i < count; i++) {
        const a = rand(0, Math.PI * 2)
        const s = rand(120, 420)
        particles.push(make(cx, cy, Math.cos(a) * s, Math.sin(a) * s, rand(1.5, 2.6)))
      }
    }
    const cannon = (fromLeft: boolean) => {
      for (let i = 0; i < 14; i++) {
        const a = fromLeft ? rand(-1.25, -0.75) : rand(-Math.PI + 0.75, -Math.PI + 1.25)
        const s = rand(500, 950)
        particles.push(make(fromLeft ? 0 : w, h, Math.cos(a) * s, Math.sin(a) * s, 4))
      }
    }

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      const elapsed = now - start
      const spawning = elapsed < durationMs

      if (spawning) {
        if (mode === 'rain') {
          const n = Math.round(dt * 160)
          for (let i = 0; i < n; i++) particles.push(make(rand(0, w), -20, rand(-40, 40), rand(120, 320), 8))
        } else {
          sinceBurst += dt
          if (sinceBurst > 0.35) {
            sinceBurst = 0
            cannon(true)
            cannon(false)
            burst(rand(w * 0.15, w * 0.85), rand(h * 0.12, h * 0.5), 60)
          }
        }
      }

      ctx.clearRect(0, 0, w, h)
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.age += dt
        p.vy += 520 * dt
        p.vx *= 1 - 0.9 * dt
        p.vy *= 1 - 0.35 * dt
        p.x += p.vx * dt + Math.sin(p.age * 6 + p.rot) * 0.6
        p.y += p.vy * dt
        p.rot += p.vr * dt
        if (p.y > h + 30 || p.age > p.ttl) {
          particles.splice(i, 1)
          continue
        }
        ctx.save()
        ctx.globalAlpha = Math.min(1, (p.ttl - p.age) * 1.5)
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.fillStyle = p.color
        if (p.shape === 0) ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
        else if (p.shape === 1) {
          ctx.beginPath()
          ctx.arc(0, 0, p.size / 3, 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.beginPath()
          ctx.moveTo(0, -p.size / 2)
          ctx.lineTo(p.size / 2, p.size / 2)
          ctx.lineTo(-p.size / 2, p.size / 2)
          ctx.closePath()
          ctx.fill()
        }
        ctx.restore()
      }

      if (!spawning && particles.length === 0) {
        if (!finished) {
          finished = true
          doneRef.current?.()
        }
        return
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [durationMs, mode])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 9999 }}
    />
  )
}
