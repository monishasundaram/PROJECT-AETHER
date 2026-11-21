export interface OneEuroConfig {
  /** Lower = smoother when still, more jitter removed. */
  minCutoff: number
  /** Higher = less lag during fast movement. */
  beta: number
  /** Cutoff for the derivative filter. Rarely needs changing. */
  dCutoff: number
}

export const DEFAULT_ONE_EURO: OneEuroConfig = {
  minCutoff: 1.5,
  beta: 20,
  dCutoff: 1,
}

class LowPass {
  last: number | undefined

  filter(value: number, alpha: number): number {
    this.last = this.last === undefined ? value : alpha * value + (1 - alpha) * this.last
    return this.last
  }

  reset() {
    this.last = undefined
  }
}

const smoothingFactor = (dtSeconds: number, cutoff: number) => {
  const tau = 1 / (2 * Math.PI * cutoff)
  return 1 / (1 + tau / dtSeconds)
}

/**
 * One Euro Filter (Casiez et al., 2012): adaptive low-pass filter.
 * Strong smoothing at low speed (kills jitter), light smoothing at high speed (kills lag).
 */
export class OneEuroFilter {
  private readonly x = new LowPass()
  private readonly dx = new LowPass()
  private lastTime: number | null = null

  constructor(private readonly config: OneEuroConfig = DEFAULT_ONE_EURO) {}

  filter(value: number, timestampMs: number): number {
    if (this.lastTime === null) {
      this.lastTime = timestampMs
      this.dx.filter(0, 1)
      return this.x.filter(value, 1)
    }

    const dt = Math.max((timestampMs - this.lastTime) / 1000, 1e-6)
    this.lastTime = timestampMs

    const previous = this.x.last ?? value
    const rawVelocity = (value - previous) / dt
    const velocity = this.dx.filter(rawVelocity, smoothingFactor(dt, this.config.dCutoff))
    const cutoff = this.config.minCutoff + this.config.beta * Math.abs(velocity)
    return this.x.filter(value, smoothingFactor(dt, cutoff))
  }

  reset() {
    this.x.reset()
    this.dx.reset()
    this.lastTime = null
  }
}