import type { GestureConfig } from './config'
import type { HandFeatures } from './features'
import type { HandPose } from './types'

/**
 * Single-frame pose classification. `prev` is the *stable* pose, used for pinch hysteresis:
 * once pinching, the ratio must rise above pinchExit (not pinchEnter) to count as released.
 */
export function classifyPose(f: HandFeatures, prev: HandPose, cfg: GestureConfig): HandPose {
  const allCurled = f.extension.every((r) => r < cfg.fingerCurledRatio)
  const allExtended = f.extension.every((r) => r > cfg.fingerExtendedRatio)
  const pinchLimit = (prev === 'pinch' ? cfg.pinchExit : cfg.pinchEnter) * cfg.sensitivity

  // A fist can bring thumb and index tip close together; all-curled fingers is a fist, not a pinch.
  if (f.pinchRatio < pinchLimit && !allCurled) return 'pinch'
  if (allCurled) return 'fist'
  if (allExtended) return 'open_palm'
  return 'none'
}