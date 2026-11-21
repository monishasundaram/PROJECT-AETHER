import { describe, expect, it } from 'vitest'
import { DEFAULT_GESTURE_CONFIG as cfg } from './config'
import { PoseStabilizer } from './stabilizer'

describe('PoseStabilizer', () => {
  it('ignores a single noisy frame', () => {
    const s = new PoseStabilizer()
    s.update('fist', 0, cfg)
    expect(s.pose).toBe('none')
  })

  it('commits after the configured number of consecutive frames', () => {
    const s = new PoseStabilizer()
    for (let i = 0; i < cfg.confirmFrames.open_palm - 1; i++) s.update('open_palm', i, cfg)
    expect(s.pose).toBe('none')
    expect(s.update('open_palm', 99, cfg)).toBe(true)
    expect(s.pose).toBe('open_palm')
  })

  it('does not commit an alternating (flickering) signal', () => {
    const s = new PoseStabilizer()
    for (let i = 0; i < 20; i++) s.update(i % 2 ? 'none' : 'pinch', i, cfg)
    expect(s.pose).toBe('none')
  })

  it('releases a pinch after pinchReleaseFrames non-pinch frames', () => {
    const s = new PoseStabilizer()
    for (let i = 0; i < cfg.confirmFrames.pinch; i++) s.update('pinch', i, cfg)
    expect(s.pose).toBe('pinch')
    s.update('none', 10, cfg)
    expect(s.pose).toBe('pinch')
    s.update('open_palm', 11, cfg)
    expect(s.pose).toBe('open_palm')
  })

  it('a one-frame dropout does not release a pinch', () => {
    const s = new PoseStabilizer()
    for (let i = 0; i < 3; i++) s.update('pinch', i, cfg)
    s.update('none', 4, cfg)
    s.update('pinch', 5, cfg)
    s.update('none', 6, cfg)
    s.update('pinch', 7, cfg)
    expect(s.pose).toBe('pinch')
  })
})