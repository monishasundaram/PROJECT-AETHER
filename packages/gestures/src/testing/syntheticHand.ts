import type { Handedness, TrackedHand } from '@aether/shared'

interface P {
  x: number
  y: number
}

export type SyntheticPose = 'open' | 'fist' | 'pinch'

export interface SyntheticHandOptions {
  id: Handedness
  pose: SyntheticPose
  /** Wrist position in mirrored screen space (0..1). */
  center?: P
  /** Palm length as a fraction of frame height. */
  scale?: number
  /** Clockwise on screen, radians. */
  rollRad?: number
  aspect?: number
  stale?: boolean
}

const lerp = (a: P, b: P, t: number): P => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })

// Local hand model: palm length 1, wrist at origin, fingers toward -y.
const FINGERS = [
  { base: { x: -0.28, y: -0.95 }, len: 1 }, // index
  { base: { x: 0, y: -1 }, len: 1 }, // middle
  { base: { x: 0.26, y: -0.95 }, len: 0.95 }, // ring
  { base: { x: 0.5, y: -0.85 }, len: 0.8 }, // pinky
]
const SEGMENTS = [0.45, 0.28, 0.22]
const BEND_DEG = [80, 100, 70]
const THUMB_OPEN: P[] = [
  { x: -0.25, y: -0.25 },
  { x: -0.42, y: -0.5 },
  { x: -0.58, y: -0.75 },
  { x: -0.7, y: -0.95 },
]

/** Returns [mcp, pip, dip, tip]. Curl foreshortens segments like a finger folding toward the camera. */
function finger(base: P, len: number, curl: number): P[] {
  const pts: P[] = [base]
  let y = base.y
  let phi = 0
  for (let i = 0; i < 3; i++) {
    phi += (BEND_DEG[i] * curl * Math.PI) / 180
    y -= SEGMENTS[i] * len * Math.cos(phi)
    pts.push({ x: base.x, y })
  }
  return pts
}

export function makeHand(opts: SyntheticHandOptions): TrackedHand {
  const { id, pose, center = { x: 0.5, y: 0.75 }, scale = 0.25, rollRad = 0, aspect = 4 / 3, stale = false } = opts

  const curls = pose === 'fist' ? [1, 1, 1, 1] : pose === 'pinch' ? [0.35, 0, 0, 0] : [0, 0, 0, 0]
  const thumbAmount = pose === 'fist' ? 0.6 : pose === 'pinch' ? 1 : 0

  const fingers = FINGERS.map((f, i) => finger(f.base, f.len, curls[i]))
  const indexTip = fingers[0][3]
  const thumbTip = lerp(THUMB_OPEN[3], indexTip, thumbAmount)
  const thumbIp = lerp(THUMB_OPEN[2], lerp(THUMB_OPEN[1], thumbTip, 0.6), thumbAmount)

  const local: P[] = [{ x: 0, y: 0 }, THUMB_OPEN[0], THUMB_OPEN[1], thumbIp, thumbTip, ...fingers.flat()]

  const cos = Math.cos(rollRad)
  const sin = Math.sin(rollRad)
  const landmarks = local.map((p) => {
    const rx = p.x * cos - p.y * sin
    const ry = p.x * sin + p.y * cos
    const screenX = center.x + (rx * scale) / aspect
    const screenY = center.y + ry * scale
    return { x: 1 - screenX, y: screenY, z: 0 } // raw camera frame is mirrored relative to screen
  })

  return { id, landmarks, worldLandmarks: [], confidence: 0.9, stale }
}