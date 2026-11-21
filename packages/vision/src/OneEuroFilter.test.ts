import { describe, expect, it } from 'vitest'
import { OneEuroFilter } from './OneEuroFilter'

const FRAME_MS = 1000 / 30

describe('OneEuroFilter', () => {
  it('passes the first sample through unchanged', () => {
    const f = new OneEuroFilter()
    expect(f.filter(0.42, 0)).toBe(0.42)
  })

  it('holds a constant signal constant', () => {
    const f = new OneEuroFilter()
    let out = 0
    for (let i = 0; i < 50; i++) out = f.filter(0.5, i * FRAME_MS)
    expect(out).toBeCloseTo(0.5, 6)
  })

  it('suppresses jitter around a stationary value', () => {
    const f = new OneEuroFilter({ minCutoff: 1, beta: 0, dCutoff: 1 })
    const outputs: number[] = []
    for (let i = 0; i < 60; i++) {
      const noisy = 0.5 + (i % 2 === 0 ? 0.01 : -0.01)
      outputs.push(f.filter(noisy, i * FRAME_MS))
    }
    const tail = outputs.slice(-20)
    const spread = Math.max(...tail) - Math.min(...tail)
    expect(spread).toBeLessThan(0.005) // input spread was 0.02
  })

  it('lags less during fast motion when beta is high', () => {
    const adaptive = new OneEuroFilter({ minCutoff: 1, beta: 50, dCutoff: 1 })
    const fixed = new OneEuroFilter({ minCutoff: 1, beta: 0, dCutoff: 1 })
    let adaptiveOut = 0
    let fixedOut = 0
    let input = 0
    for (let i = 0; i <= 30; i++) {
      input = i / 30
      adaptiveOut = adaptive.filter(input, i * FRAME_MS)
      fixedOut = fixed.filter(input, i * FRAME_MS)
    }
    const adaptiveError = Math.abs(adaptiveOut - input)
    const fixedError = Math.abs(fixedOut - input)
    expect(adaptiveError).toBeLessThan(fixedError)
    expect(adaptiveError).toBeLessThan(0.05)
  })

  it('resets state', () => {
    const f = new OneEuroFilter()
    f.filter(1, 0)
    f.filter(1, FRAME_MS)
    f.reset()
    expect(f.filter(0.2, 1000)).toBe(0.2)
  })
})