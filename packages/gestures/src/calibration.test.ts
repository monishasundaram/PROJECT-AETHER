import { describe, expect, it } from 'vitest'
import { PinchCalibrator } from './calibration'

describe('PinchCalibrator', () => {
  it('places thresholds between open and pinched medians', () => {
    const c = new PinchCalibrator()
    for (let i = 0; i < 20; i++) {
      c.add('open', 0.9)
      c.add('pinched', 0.1)
    }
    const r = c.result()!
    expect(r.pinchEnter).toBeCloseTo(0.3, 2)
    expect(r.pinchExit).toBeCloseTo(0.42, 2)
    expect(r.pinchExit).toBeGreaterThan(r.pinchEnter)
  })

  it('returns null with too few samples', () => {
    const c = new PinchCalibrator()
    c.add('open', 0.9)
    c.add('pinched', 0.1)
    expect(c.result()).toBeNull()
  })

  it('returns null when open and pinched are indistinguishable', () => {
    const c = new PinchCalibrator()
    for (let i = 0; i < 20; i++) {
      c.add('open', 0.5)
      c.add('pinched', 0.4)
    }
    expect(c.result()).toBeNull()
  })
})
