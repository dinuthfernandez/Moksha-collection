/** Procedural "curiosity" soundtrack (no audio files): a rising drone, a mysterious
 *  arpeggio that speeds up, a heartbeat tick each second and a final swell. */
export interface LaunchMusic {
  stop: () => void
}

const NOTES = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25] // A minor pentatonic-ish

export function createAudioContext(): AudioContext | null {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctx) return null
  const ctx = new Ctx()
  void ctx.resume()
  return ctx
}

export function startLaunchMusic(seconds: number, existing?: AudioContext | null): LaunchMusic | null {
  const ctx = existing ?? createAudioContext()
  if (!ctx) return null
  void ctx.resume()
  const t0 = ctx.currentTime + 0.05
  const end = t0 + seconds

  const master = ctx.createGain()
  master.gain.setValueAtTime(0, t0)
  master.gain.linearRampToValueAtTime(0.7, t0 + 1)
  master.gain.setValueAtTime(0.7, end - 0.1)
  master.gain.linearRampToValueAtTime(0, end + 2.5)
  master.connect(ctx.destination)

  const delay = ctx.createDelay(1)
  delay.delayTime.value = 0.28
  const feedback = ctx.createGain()
  feedback.gain.value = 0.38
  const wet = ctx.createGain()
  wet.gain.value = 0.45
  delay.connect(feedback).connect(delay)
  delay.connect(wet).connect(master)

  // Drone: two detuned saws through a filter that opens over the countdown.
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(180, t0)
  filter.frequency.exponentialRampToValueAtTime(2600, end)
  const droneGain = ctx.createGain()
  droneGain.gain.setValueAtTime(0.0001, t0)
  droneGain.gain.exponentialRampToValueAtTime(0.16, end)
  filter.connect(droneGain).connect(master)
  const drones = [55, 55.4, 82.4].map((f, i) => {
    const o = ctx.createOscillator()
    o.type = i === 2 ? 'sine' : 'sawtooth'
    o.frequency.value = f
    o.frequency.linearRampToValueAtTime(f * 1.5, end)
    o.connect(filter)
    o.start(t0)
    o.stop(end + 2.6)
    return o
  })

  const pluck = (time: number, freq: number, vol: number) => {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'triangle'
    o.frequency.value = freq
    g.gain.setValueAtTime(0.0001, time)
    g.gain.exponentialRampToValueAtTime(vol, time + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.5)
    o.connect(g)
    g.connect(master)
    g.connect(delay)
    o.start(time)
    o.stop(time + 0.55)
  }

  // Arpeggio: gets faster and higher as the countdown progresses.
  let t = t0 + 0.5
  let step = 0
  const pattern = [0, 2, 4, 3, 5, 4, 6, 5, 7, 6, 8, 7]
  while (t < end - 0.2) {
    const p = (t - t0) / seconds
    const idx = Math.min(pattern[step % pattern.length] + Math.floor(p * 2), NOTES.length - 1)
    pluck(t, NOTES[idx], 0.12 + p * 0.14)
    t += 0.42 - p * 0.28
    step++
  }

  // Heartbeat tick every second, getting louder.
  for (let s = 0; s < seconds; s++) {
    const time = t0 + s
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(140, time)
    o.frequency.exponentialRampToValueAtTime(45, time + 0.18)
    g.gain.setValueAtTime(0.0001, time)
    g.gain.exponentialRampToValueAtTime(0.35 + (s / seconds) * 0.45, time + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.25)
    o.connect(g).connect(master)
    o.start(time)
    o.stop(time + 0.3)
  }

  // Final bright chord as the countdown hits zero.
  ;[220, 329.63, 440, 659.25, 880].forEach((f) => {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o.frequency.value = f
    g.gain.setValueAtTime(0.0001, end - 0.15)
    g.gain.exponentialRampToValueAtTime(0.14, end)
    g.gain.exponentialRampToValueAtTime(0.0001, end + 2.4)
    o.connect(g).connect(master)
    o.start(end - 0.15)
    o.stop(end + 2.5)
  })

  return {
    stop: () => {
      const now = ctx.currentTime
      master.gain.cancelScheduledValues(now)
      master.gain.setValueAtTime(master.gain.value, now)
      master.gain.linearRampToValueAtTime(0, now + 0.3)
      drones.forEach((o) => { try { o.stop(now + 0.35) } catch { /* already stopped */ } })
      window.setTimeout(() => void ctx.close(), 500)
    },
  }
}
