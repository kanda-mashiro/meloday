import { ref, type Ref } from 'vue'

// Ambient focus sound, picked by SCENE rather than noise "color" (ordinary users
// think "rain"/"ocean", not "pink/brown"). Each scene is a looping audio file
// under public/sounds/<id>.mp3, lazily fetched on first use. Decoded buffers are
// cached and made seamlessly loopable with a 50ms equal-overlap crossfade.

export type SceneId =
  | 'rain' | 'thunder' | 'ocean' | 'stream' | 'wind'
  | 'forest' | 'birds' | 'night' | 'fire' | 'cafe'

export interface Scene {
  id: SceneId
  label: string
  /** Source file under /sounds. */
  file: string
}

// Order = display order.
export const SCENES: readonly Scene[] = [
  { id: 'rain', label: '雨声', file: '/sounds/rain.mp3' },
  { id: 'thunder', label: '雷雨', file: '/sounds/thunder.mp3' },
  { id: 'ocean', label: '海浪', file: '/sounds/ocean.mp3' },
  { id: 'stream', label: '溪流', file: '/sounds/stream.mp3' },
  { id: 'wind', label: '微风', file: '/sounds/wind.mp3' },
  { id: 'forest', label: '森林', file: '/sounds/forest.mp3' },
  { id: 'birds', label: '鸟鸣', file: '/sounds/birds.mp3' },
  { id: 'night', label: '虫鸣', file: '/sounds/night.mp3' },
  { id: 'fire', label: '篝火', file: '/sounds/fire.mp3' },
  { id: 'cafe', label: '咖啡馆', file: '/sounds/cafe.mp3' },
] as const

const SCENE_IDS = SCENES.map((s) => s.id) as SceneId[]
function isSceneId(v: unknown): v is SceneId {
  return typeof v === 'string' && (SCENE_IDS as string[]).includes(v)
}

const STORAGE_KEY = 'meloday-ambient'
const DEFAULT_SCENE: SceneId = 'rain'

const playing = ref(false)
const scene = ref<SceneId>(DEFAULT_SCENE)
const volume = ref(0.5)

// Restore the last scene + volume (not the on/off state — sound never
// auto-starts without a click).
try {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw) {
    const p = JSON.parse(raw) as { scene?: unknown; volume?: unknown }
    if (isSceneId(p.scene)) scene.value = p.scene
    if (typeof p.volume === 'number') volume.value = Math.min(1, Math.max(0, p.volume))
  }
} catch {
  // ignore malformed storage
}

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ scene: scene.value, volume: volume.value }))
  } catch {
    // ignore
  }
}

let ctx: AudioContext | null = null
let gain: GainNode | null = null
let source: AudioBufferSourceNode | null = null

// Bumped every time the desired sound changes (toggle off / scene switch). A
// buffer that finishes decoding for an out-of-date token is discarded instead
// of being played, so a slow fetch can't resurrect a scene the user left.
let playToken = 0

// Decoded-and-loopable buffers, keyed by scene id.
const bufferCache = new Map<SceneId, AudioBuffer>()

function ensureContext(): void {
  if (ctx) return
  ctx = new AudioContext()
  gain = ctx.createGain()
  gain.gain.value = volume.value
  gain.connect(ctx.destination)
}

const FADE_SECONDS = 0.05 // 50ms loop crossfade

// Seamless loop: equal-overlap crossfade so the wrap from the last sample back
// to the first has no click. The buffer must carry `fade` samples of extra tail
// (the would-be continuation past the loop point) which we blend into the head;
// the returned buffer is exactly `len` long. Multi-channel buffers are handled
// per channel.
function makeLoopable(c: AudioContext, channels: Float32Array[], len: number, fade: number): AudioBuffer {
  const buf = c.createBuffer(channels.length, len, c.sampleRate)
  for (let ch = 0; ch < channels.length; ch++) {
    const src = channels[ch]
    const out = buf.getChannelData(ch)
    out.set(src.subarray(0, len))
    for (let i = 0; i < fade; i++) {
      const t = i / fade
      out[i] = src[len + i] * (1 - t) + src[i] * t
    }
  }
  return buf
}

// Turn a decoded file buffer into a seamless loop. We need `fade` samples of
// tail past the loop point to crossfade into the head, so the loop length is
// (decoded length − fade); the tail samples are the blend partners. Files
// shorter than a couple of fade-widths are returned as-is (can't meaningfully
// crossfade) — still loop, just without the seam smoothing.
function makeFileLoopable(c: AudioContext, decoded: AudioBuffer): AudioBuffer {
  const fade = Math.floor(c.sampleRate * FADE_SECONDS)
  const len = decoded.length - fade
  if (len <= fade * 2) return decoded
  const channels: Float32Array[] = []
  for (let ch = 0; ch < decoded.numberOfChannels; ch++) channels.push(decoded.getChannelData(ch))
  return makeLoopable(c, channels, len, fade)
}

// Fetch + decode a scene's file once, cache the loopable result. Returns null on
// any failure (missing file / 404 / decode error) so callers degrade quietly.
async function loadSceneBuffer(c: AudioContext, s: Scene): Promise<AudioBuffer | null> {
  const cached = bufferCache.get(s.id)
  if (cached) return cached
  try {
    const res = await fetch(s.file)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.arrayBuffer()
    const decoded = await c.decodeAudioData(data)
    const loopable = makeFileLoopable(c, decoded)
    bufferCache.set(s.id, loopable)
    return loopable
  } catch (err) {
    console.warn(`[ambient] failed to load ${s.file}:`, err)
    return null
  }
}

function playBuffer(buffer: AudioBuffer): void {
  stopSource()
  const c = ctx as AudioContext
  source = c.createBufferSource()
  source.buffer = buffer
  source.loop = true
  source.connect(gain as GainNode)
  source.start()
}

// (Re)start playback for the current scene. Scenes load asynchronously; the
// captured token guards against a stale resolution (a slow fetch resolving after
// the user switched scene or stopped). If the file can't load, stay silent
// rather than substitute noise.
function startScene(): void {
  const c = ctx as AudioContext
  const token = ++playToken
  const current = SCENES.find((s) => s.id === scene.value)
  if (!current) return
  void loadSceneBuffer(c, current).then((buf) => {
    if (token !== playToken || !playing.value) return // user moved on
    if (buf) playBuffer(buf)
  })
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
  playing.value = true
  // resume() must run inside the click gesture, and we must wait for it to
  // actually resolve before starting playback: Safari keeps a freshly-created
  // context 'suspended', and a source started against a suspended context is
  // silent (this was the "no sound in Safari" bug).
  if (c.state === 'suspended') {
    void c.resume().then(() => {
      if (playing.value) startScene()
    })
  } else {
    startScene()
  }
}

function stop(): void {
  playToken++ // cancel any in-flight load
  stopSource()
  playing.value = false
}

function toggle(): void {
  if (playing.value) stop()
  else play()
}

function setScene(id: SceneId): void {
  scene.value = id
  persist()
  if (playing.value) startScene()
}

function setVolume(v: number): void {
  volume.value = v
  if (gain) gain.gain.value = v
  persist()
}

export function useAmbientSound(): {
  playing: Ref<boolean>
  scene: Ref<SceneId>
  scenes: readonly Scene[]
  volume: Ref<number>
  play: () => void
  stop: () => void
  toggle: () => void
  setScene: (id: SceneId) => void
  setVolume: (v: number) => void
} {
  return { playing, scene, scenes: SCENES, volume, play, stop, toggle, setScene, setVolume }
}
