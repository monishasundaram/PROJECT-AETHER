import type { Handedness } from '@aether/shared'
import type { HandPose } from './types'

export interface GestureConfig {
  /** Video width / height. Needed so x and y distances are comparable. */
  aspect: number
  dominantHand: Handedness
  /** Multiplier on pinch thresholds. >1 = easier to pinch, <1 = stricter. */
  sensitivity: number
  /** Thumb–index distance / palm length below which a pinch starts. */
  pinchEnter: number
  /** Ratio above which a pinch ends (> pinchEnter = hysteresis). */
  pinchExit: number
  fingerExtendedRatio: number
  fingerCurledRatio: number
  /** Consecutive frames a pose must persist before it becomes the stable pose. */
  confirmFrames: Record<HandPose, number>
  /** Consecutive non-pinch frames needed to release a pinch. */
  pinchReleaseFrames: number
  /** Pinch held this long turns select into grab. */
  grabHoldMs: number
  /** Max gap between a tap's release and the next pinch for a double pinch. */
  doublePinchMs: number
  /** Roll needed (radians) before rotation starts being reported during a grab. */
  rotateDeadzoneRad: number
  /** Log-scale size change needed before depth starts being reported during a grab. */
  depthDeadzone: number
}

export const DEFAULT_GESTURE_CONFIG: GestureConfig = {
  aspect: 4 / 3,
  dominantHand: 'Right',
  sensitivity: 1,
  pinchEnter: 0.28,
  pinchExit: 0.4,
  fingerExtendedRatio: 1.2,
  fingerCurledRatio: 0.9,
  confirmFrames: { pinch: 2, open_palm: 3, fist: 4, none: 4 },
  pinchReleaseFrames: 2,
  grabHoldMs: 250,
  doublePinchMs: 400,
  rotateDeadzoneRad: (8 * Math.PI) / 180,
  depthDeadzone: 0.15,
}