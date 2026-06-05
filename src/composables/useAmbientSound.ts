import { ref, type Ref } from 'vue'

// Ambient focus noise, synthesized in the browser with the Web Audio API — no
// audio files to host, works offline, nothing to license. Three "colors":
//   white — flat/hissy
//   pink  — balanced (Paul Kellet's filter)
//   brown — deep rumble (the calm default)
export type NoiseType = 'white' | 'pink' | 'brown'

const STORAGE_KEY = 'my-todo-ambient'

const playing = ref(false)
const type = ref<NoiseType>('brown')
const volume = ref(0.5)

// Restore the last color + volume (not the on/off state — sound never
// auto-starts without a click).
try {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw) {
    const p = JSON.parse(raw) as { type?: NoiseType; volume?: number }
    if (p.type === 'white' || p.type === 'pink' || p.type === 'brown') type.value = p.type
    if (typeof p.volume === 'number') volume.value = Math.min(1, Math.max(0, p.volume))
  }
} catch {
  // ignore malformed storage
}

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ type: type.value, volume: volume.value }))
  } catch {
    // ignore
  }
}

let ctx: AudioContext | null = null
let gain: GainNode | null = null
let source: AudioBufferSourceNode | null = null

function ensureContext(): void {
  if (ctx) return
  ctx = new AudioContext()
  gain = ctx.createGain()
  gain.gain.value = volume.value
  gain.connect(ctx.destination)
}

// A few seconds of looped noise — long enough that the loop isn't audible.
function makeBuffer(c: AudioContext, kind: NoiseType): AudioBuffer {
  const len = Math.floor(c.sampleRate * 4)
  // Generate a little extra so we can crossfade the loop seam (see below).
  const fade = Math.floor(c.sampleRate * 0.05) // 50ms
  const total = len + fade
  const out = new Float32Array(total)

  if (kind === 'white') {
    for (let i = 0; i < total; i++) out[i] = (Math.random() * 2 - 1) * 0.5
  } else if (kind === 'brown') {
    let last = 0
    for (let i = 0; i < total; i++) {
      const w = Math.random() * 2 - 1
      last = (last + 0.02 * w) / 1.02
      out[i] = last * 3.5
    }
  } else {
    let b0 = 0,
      b1 = 0,
      b2 = 0,
      b3 = 0,
      b4 = 0,
      b5 = 0,
      b6 = 0
    for (let i = 0; i < total; i++) {
      const w = Math.random() * 2 - 1
      b0 = 0.99886 * b0 + w * 0.0555179
      b1 = 0.99332 * b1 + w * 0.0750759
      b2 = 0.969 * b2 + w * 0.153852
      b3 = 0.8665 * b3 + w * 0.3104856
      b4 = 0.55 * b4 + w * 0.5329522
      b5 = -0.7616 * b5 - w * 0.016898
      out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11
      b6 = w * 0.115926
    }
  }

  // Seamless loop: equal-overlap crossfade so the wrap from out[len-1] → out[0]
  // has no click. White noise is already seamless (memoryless), but pink/brown
  // carry state, so without this they'd tick once per loop. We blend the head
  // with the would-be continuation past the loop point.
  for (let i = 0; i < fade; i++) {
    const t = i / fade
    out[i] = out[len + i] * (1 - t) + out[i] * t
  }

  const buf = c.createBuffer(1, len, c.sampleRate)
  buf.getChannelData(0).set(out.subarray(0, len))
  return buf
}

function startSource(): void {
  stopSource()
  const c = ctx as AudioContext
  source = c.createBufferSource()
  source.buffer = makeBuffer(c, type.value)
  source.loop = true
  source.connect(gain as GainNode)
  source.start()
}

function stopSource(): void {
  if (!source) return
  try {
    source.stop()
  } catch {
    // already stopped
  }
  source.disconnect()
  source = null
}

function play(): void {
  ensureContext()
  const c = ctx as AudioContext
  if (c.state === 'suspended') void c.resume()
  startSource()
  playing.value = true
}

function stop(): void {
  stopSource()
  playing.value = false
}

function toggle(): void {
  if (playing.value) stop()
  else play()
}

function setType(t: NoiseType): void {
  type.value = t
  persist()
  if (playing.value) startSource()
}

function setVolume(v: number): void {
  volume.value = v
  if (gain) gain.gain.value = v
  persist()
}

export function useAmbientSound(): {
  playing: Ref<boolean>
  type: Ref<NoiseType>
  volume: Ref<number>
  play: () => void
  stop: () => void
  toggle: () => void
  setType: (t: NoiseType) => void
  setVolume: (v: number) => void
} {
  return { playing, type, volume, play, stop, toggle, setType, setVolume }
}
