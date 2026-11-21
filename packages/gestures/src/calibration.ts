export interface PinchCalibration {
  pinchEnter: number
  pinchExit: number
}

const median = (values: number[]): number => {
  const s = [...values].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

const round3 = (n: number) => Math.round(n * 1000) / 1000

/**
 * Collects the user's own open-hand and pinched thumb–index ratios and places the
 * enter/exit thresholds a fixed fraction of the way between them.
 */
export class PinchCalibrator {
  private readonly samples = { open: [] as number[], pinched: [] as number[] }

  add(phase: 'open' | 'pinched', ratio: number) {
    this.samples[phase].push(ratio)
  }

  reset() {
    this.samples.open = []
    this.samples.pinched = []
  }

  /** Null if there isn't enough data or the open/pinched ranges are too close to separate. */
  result(minSamples = 10, minGap = 0.25): PinchCalibration | null {
    const { open, pinched } = this.samples
    if (open.length < minSamples || pinched.length < minSamples) return null
    const o = median(open)
    const p = median(pinched)
    const gap = o - p
    if (gap < minGap) return null
    return { pinchEnter: round3(p + 0.25 * gap), pinchExit: round3(p + 0.4 * gap) }
  }
}