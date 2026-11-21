/**
 * Suppresses small cumulative movement. Reports nothing until the accumulated delta
 * exceeds the threshold, then passes deltas through until reset. Removes jitter
 * without adding a constant dead band mid-gesture.
 */
export class EngageGate {
  private acc = 0
  private engaged = false

  apply(delta: number, threshold: number): number {
    if (this.engaged) return delta
    this.acc += delta
    if (Math.abs(this.acc) >= threshold) this.engaged = true
    return 0
  }

  reset() {
    this.acc = 0
    this.engaged = false
  }
}