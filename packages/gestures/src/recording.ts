import type { HandFrame, TrackedHand } from '@aether/shared'
import { GestureEngine } from './engine'
import type { GestureFrame } from './types'

export interface RecordedFrame {
  /** Milliseconds since the first recorded frame. */
  t: number
  hands: TrackedHand[]
}

export interface RecordedSession {
  version: 1
  createdAt: string
  aspect: number
  /** Post-smoothing landmarks, exactly what the gesture engine consumed. */
  frames: RecordedFrame[]
}

const round = (n: number, digits: number) => {
  const f = 10 ** digits
  return Math.round(n * f) / f
}

const strip = (hand: TrackedHand): TrackedHand => ({
  id: hand.id,
  confidence: round(hand.confidence, 3),
  stale: hand.stale,
  worldLandmarks: [],
  landmarks: hand.landmarks.map((p) => ({ x: round(p.x, 4), y: round(p.y, 4), z: round(p.z, 4) })),
})

export class FrameRecorder {
  private frames: RecordedFrame[] = []
  private origin: number | null = null
  private active = false

  get isRecording() {
    return this.active
  }

  get frameCount() {
    return this.frames.length
  }

  start() {
    this.frames = []
    this.origin = null
    this.active = true
  }

  push(frame: HandFrame) {
    if (!this.active) return
    this.origin ??= frame.timestamp
    this.frames.push({ t: round(frame.timestamp - this.origin, 1), hands: frame.hands.map(strip) })
  }

  stop(aspect: number): RecordedSession {
    this.active = false
    const session: RecordedSession = {
      version: 1,
      createdAt: new Date().toISOString(),
      aspect,
      frames: this.frames,
    }
    this.frames = []
    this.origin = null
    return session
  }
}

export function parseSession(text: string): RecordedSession {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('Recorded session is not valid JSON.')
  }
  const s = data as Partial<RecordedSession> | null
  if (!s || s.version !== 1 || !Array.isArray(s.frames) || typeof s.aspect !== 'number') {
    throw new Error('Unsupported or malformed recorded session (expected version 1 with frames and aspect).')
  }
  return s as RecordedSession
}

/** Runs a recorded session through a fresh engine and returns every output frame. */
export function replaySession(
  session: RecordedSession,
  engine: GestureEngine = new GestureEngine({ aspect: session.aspect }),
): GestureFrame[] {
  return session.frames.map((f) => engine.update(f.hands, f.t))
}