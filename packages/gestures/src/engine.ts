import type { Handedness, TrackedHand } from '@aether/shared'
import { classifyPose } from './classifier'
import { DEFAULT_GESTURE_CONFIG, type GestureConfig } from './config'
import { extractFeatures, type HandFeatures } from './features'
import { EngageGate } from './gate'
import { angleDiff, mid, sub } from './geometry'
import { PoseStabilizer } from './stabilizer'
import type {
  GestureEvent,
  GestureEventType,
  GestureFrame,
  GestureMotion,
  HandDebug,
  HandPose,
  InteractionState,
  Vec2,
} from './types'

interface HandInfo {
  features: HandFeatures
  raw: HandPose
  stable: HandPose
  stale: boolean
}

interface Sample {
  cursor: Vec2
  scale: number
  angle: number
  span: number
}

const isPinchFamily = (s: InteractionState) => s === 'pinching' || s === 'grabbing'
const zeroMotion = (): GestureMotion => ({ move: { x: 0, y: 0 }, depth: 0, rotate: 0, zoom: 0 })

export class GestureEngine {
  private cfg: GestureConfig
  private readonly stabilizers = new Map<Handedness, PoseStabilizer>()
  private state: InteractionState = 'idle'
  private stateSince = 0
  private primary: Handedness | null = null
  private pinchLatched = false
  private pinchOpen = false
  private lastTapEnd = Number.NEGATIVE_INFINITY
  private prev: Sample | null = null
  private readonly rotateGate = new EngageGate()
  private readonly depthGate = new EngageGate()

  constructor(config: Partial<GestureConfig> = {}) {
    this.cfg = { ...DEFAULT_GESTURE_CONFIG, ...config }
  }

  get config(): GestureConfig {
    return this.cfg
  }

  setConfig(patch: Partial<GestureConfig>) {
    this.cfg = { ...this.cfg, ...patch }
  }

  reset() {
    this.stabilizers.clear()
    this.state = 'idle'
    this.stateSince = 0
    this.primary = null
    this.pinchLatched = false
    this.pinchOpen = false
    this.lastTapEnd = Number.NEGATIVE_INFINITY
    this.prev = null
    this.rotateGate.reset()
    this.depthGate.reset()
  }

  update(hands: TrackedHand[], t: number): GestureFrame {
    const events: GestureEvent[] = []
    const infos = this.analyze(hands, t)

    const primary = this.pickPrimary([...infos.keys()])
    if (primary !== this.primary) {
      this.primary = primary
      this.prev = null
    }

    const primaryInfo = primary ? infos.get(primary) : undefined
    const left = infos.get('Left')
    const right = infos.get('Right')
    const bothPinching = left?.stable === 'pinch' && right?.stable === 'pinch'

    // After a two-hand gesture, a hand that keeps pinching must not become a new select.
    if (this.state === 'two_hand' && !bothPinching) this.pinchLatched = true
    if (primaryInfo?.stable !== 'pinch') this.pinchLatched = false

    const target = this.resolveTarget(bothPinching, primaryInfo, t)
    const cursor =
      target === 'two_hand' && left && right
        ? mid(left.features.pinchPoint, right.features.pinchPoint)
        : (primaryInfo?.features.anchor ?? null)

    this.transition(target, t, cursor, events)
    const motion = this.computeMotion(primaryInfo, left, right)

    const debug: GestureFrame['hands'] = {}
    for (const [id, info] of infos) {
      const d: HandDebug = {
        raw: info.raw,
        stable: info.stable,
        pinchRatio: info.features.pinchRatio,
        extension: info.features.extension,
        stale: info.stale,
      }
      debug[id] = d
    }

    return { t, state: this.state, primary, cursor, motion, events, hands: debug }
  }

  // ---- internals ----

  private analyze(hands: TrackedHand[], t: number): Map<Handedness, HandInfo> {
    const infos = new Map<Handedness, HandInfo>()

    for (const hand of hands) {
      if (hand.landmarks.length < 21) continue
      const features = extractFeatures(hand, this.cfg.aspect)

      let stabilizer = this.stabilizers.get(hand.id)
      if (!stabilizer) {
        stabilizer = new PoseStabilizer()
        this.stabilizers.set(hand.id, stabilizer)
      }

      const raw = classifyPose(features, stabilizer.pose, this.cfg)
      // Stale = tracking dropped and the vision layer is holding the last pose. Don't learn from it.
      if (!hand.stale) stabilizer.update(raw, t, this.cfg)

      infos.set(hand.id, { features, raw, stable: stabilizer.pose, stale: hand.stale })
    }

    for (const id of [...this.stabilizers.keys()]) {
      if (!infos.has(id)) this.stabilizers.delete(id)
    }
    return infos
  }

  private pickPrimary(present: Handedness[]): Handedness | null {
    if (present.length === 0) return null
    const sticky = this.state === 'pinching' || this.state === 'grabbing' || this.state === 'two_hand'
    if (sticky && this.primary && present.includes(this.primary)) return this.primary
    if (present.includes(this.cfg.dominantHand)) return this.cfg.dominantHand
    return present[0]
  }

  private resolveTarget(bothPinching: boolean, primary: HandInfo | undefined, t: number): InteractionState {
    if (bothPinching) return 'two_hand'
    if (!primary) return 'idle'

    switch (primary.stable) {
      case 'pinch':
        if (this.pinchLatched) return 'idle'
        if (this.state === 'grabbing') return 'grabbing'
        if (this.state === 'pinching' && t - this.stateSince >= this.cfg.grabHoldMs) return 'grabbing'
        return 'pinching'
      case 'fist':
        return 'paused'
      case 'open_palm':
        return 'workspace'
      default:
        return 'idle'
    }
  }

  private transition(next: InteractionState, t: number, cursor: Vec2 | null, events: GestureEvent[]) {
    const prev = this.state
    if (next === prev) return
    const emit = (type: GestureEventType) => events.push({ type, t, cursor })

    // exits
    if (prev === 'grabbing') {
      emit('grab_end')
      this.lastTapEnd = Number.NEGATIVE_INFINITY
    }
    if (prev === 'two_hand') emit('two_hand_end')

    const leavingPinch =
      (isPinchFamily(prev) && !isPinchFamily(next) && next !== 'two_hand') || (prev === 'two_hand' && this.pinchOpen)
    if (leavingPinch) {
      emit('pinch_end')
      this.pinchOpen = false
      if (prev === 'pinching') this.lastTapEnd = t // a tap: release before grab
    }
    if (prev === 'workspace') emit('open_palm_end')
    if (prev === 'paused') emit('fist_end')

    // enters
    if (next === 'workspace') emit('open_palm_start')
    else if (next === 'paused') emit('fist_start')
    else if (next === 'pinching') {
      emit('pinch_start')
      this.pinchOpen = true
      if (t - this.lastTapEnd <= this.cfg.doublePinchMs) {
        emit('double_pinch')
        this.lastTapEnd = Number.NEGATIVE_INFINITY
      }
    } else if (next === 'grabbing') emit('grab_start')
    else if (next === 'two_hand') emit('two_hand_start')

    this.state = next
    this.stateSince = t
    this.prev = null
    this.rotateGate.reset()
    this.depthGate.reset()
  }

  private sampleFor(primary: HandInfo | undefined, left?: HandInfo, right?: HandInfo): Sample | null {
    if (this.state === 'two_hand') {
      if (!left || !right) return null
      const a = left.features.pinchPoint
      const b = right.features.pinchPoint
      const dx = (b.x - a.x) * this.cfg.aspect
      const dy = b.y - a.y
      return { cursor: mid(a, b), scale: 0, angle: Math.atan2(dy, dx), span: Math.max(Math.hypot(dx, dy), 1e-6) }
    }
    if ((this.state === 'workspace' || this.state === 'grabbing') && primary) {
      const f = primary.features
      return { cursor: f.anchor, scale: f.scale, angle: f.rollAngle, span: 0 }
    }
    return null
  }

  private computeMotion(primary: HandInfo | undefined, left?: HandInfo, right?: HandInfo): GestureMotion {
    const motion = zeroMotion()
    const sample = this.sampleFor(primary, left, right)
    const prev = this.prev

    if (sample && prev) {
      if (this.state === 'workspace') {
        motion.move = sub(sample.cursor, prev.cursor)
      } else if (this.state === 'grabbing') {
        motion.move = sub(sample.cursor, prev.cursor)
        motion.depth = this.depthGate.apply(Math.log(sample.scale / prev.scale), this.cfg.depthDeadzone)
        motion.rotate = this.rotateGate.apply(angleDiff(prev.angle, sample.angle), this.cfg.rotateDeadzoneRad)
      } else if (this.state === 'two_hand') {
        motion.move = sub(sample.cursor, prev.cursor)
        motion.zoom = Math.log(sample.span / prev.span)
        motion.rotate = angleDiff(prev.angle, sample.angle)
      }
    }

    this.prev = sample
    return motion
  }
}