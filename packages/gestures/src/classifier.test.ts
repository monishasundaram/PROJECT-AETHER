import { describe, expect, it } from 'vitest'
import { classifyPose } from './classifier'
import { DEFAULT_GESTURE_CONFIG as cfg } from './config'
import type { HandFeatures } from './features'

const base: HandFeatures = {
  scale: 1,
  pinchRatio: 1,
  extension: [1.35, 1.35, 1.35, 1.3],
  anchor: { x: 0.5, y: 0.5 },
  pinchPoint: { x: 0.5, y: 0.5 },
  rollAngle: 0,
}

describe('classifyPose', () => {
  it('open hand → open_palm', () => {
    expect(classifyPose(base, 'none', cfg)).toBe('open_palm')
  })

  it('all fingers curled → fist, even if thumb and index tips are close', () => {
    const f = { ...base, extension: [0.7, 0.7, 0.7, 0.75] as HandFeatures['extension'], pinchRatio: 0.19 }
    expect(classifyPose(f, 'none', cfg)).toBe('fist')
  })

  it('thumb–index close with other fingers extended → pinch', () => {
    const f = { ...base, pinchRatio: 0.1, extension: [1.1, 1.35, 1.35, 1.3] as HandFeatures['extension'] }
    expect(classifyPose(f, 'none', cfg)).toBe('pinch')
  })

  it('half-bent fingers → none', () => {
    const f = { ...base, extension: [1.05, 1.0, 1.0, 1.05] as HandFeatures['extension'] }
    expect(classifyPose(f, 'none', cfg)).toBe('none')
  })

  it('uses hysteresis: ratio between enter and exit keeps an existing pinch only', () => {
    const f = { ...base, pinchRatio: 0.35 }
    expect(classifyPose(f, 'none', cfg)).toBe('open_palm')
    expect(classifyPose(f, 'pinch', cfg)).toBe('pinch')
  })

  it('sensitivity widens the pinch threshold', () => {
    const f = { ...base, pinchRatio: 0.35 }
    expect(classifyPose(f, 'none', { ...cfg, sensitivity: 1.5 })).toBe('pinch')
    expect(classifyPose({ ...base, pinchRatio: 0.2 }, 'none', { ...cfg, sensitivity: 0.5 })).not.toBe('pinch')
  })
})