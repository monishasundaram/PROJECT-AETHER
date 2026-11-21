import type { GestureConfig } from './config'
import type { HandPose } from './types'

/** Turns noisy per-frame poses into a stable pose using temporal confirmation. */
export class PoseStabilizer {
  pose: HandPose = 'none'
  since = 0
  private candidate: HandPose = 'none'
  private count = 0

  /** Returns true if the stable pose changed. */
  update(raw: HandPose, t: number, cfg: GestureConfig): boolean {
    if (raw === this.pose) {
      this.candidate = raw
      this.count = 0
      return false
    }

    // Releasing a pinch must feel immediate: any non-pinch frames count, whatever they are.
    if (this.pose === 'pinch') {
      this.candidate = raw
      this.count++
      return this.count >= cfg.pinchReleaseFrames ? this.commit(raw, t) : false
    }

    if (raw === this.candidate) this.count++
    else {
      this.candidate = raw
      this.count = 1
    }
    return this.count >= cfg.confirmFrames[raw] ? this.commit(raw, t) : false
  }

  private commit(pose: HandPose, t: number): boolean {
    this.pose = pose
    this.since = t
    this.candidate = pose
    this.count = 0
    return true
  }
}