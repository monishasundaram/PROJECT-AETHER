import type { Handedness } from '@aether/shared'

export interface Vec2 {
  x: number
  y: number
}

export type HandPose = 'none' | 'open_palm' | 'pinch' | 'fist'

export type InteractionState = 'idle' | 'workspace' | 'paused' | 'pinching' | 'grabbing' | 'two_hand'

export type GestureEventType =
  | 'open_palm_start'
  | 'open_palm_end'
  | 'pinch_start'
  | 'pinch_end'
  | 'grab_start'
  | 'grab_end'
  | 'double_pinch'
  | 'fist_start'
  | 'fist_end'
  | 'two_hand_start'
  | 'two_hand_end'

export interface GestureEvent {
  type: GestureEventType
  t: number
  /** Cursor in mirrored screen space (0..1) at the time of the event. */
  cursor: Vec2 | null
}

/** Per-frame deltas. All zero when not applicable to the current state. */
export interface GestureMotion {
  /** Cursor movement in mirrored screen space. */
  move: Vec2
  /** Log ratio of hand size change (positive = hand moving toward camera). Grab only. */
  depth: number
  /** Radians, positive = clockwise on screen. Wrist roll (grab) or hand-line angle (two-hand). */
  rotate: number
  /** Log ratio of distance between pinch points (two-hand only). zoom factor = exp(zoom). */
  zoom: number
}

/** [index, middle, ring, pinky]: wrist→tip distance / wrist→PIP distance. */
export type FingerExtension = [number, number, number, number]

export interface HandDebug {
  raw: HandPose
  stable: HandPose
  pinchRatio: number
  extension: FingerExtension
  stale: boolean
}

export interface GestureFrame {
  t: number
  state: InteractionState
  primary: Handedness | null
  cursor: Vec2 | null
  motion: GestureMotion
  events: GestureEvent[]
  hands: Partial<Record<Handedness, HandDebug>>
}