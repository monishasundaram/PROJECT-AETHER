import { describe, expect, it } from 'vitest'
import type { Handedness, TrackedHand } from '@aether/shared'
import { Driver } from './testing/driver'
import { makeHand, type SyntheticPose } from './testing/syntheticHand'

const hand = (id: Handedness, pose: SyntheticPose, x = 0.6, extra: Partial<Parameters<typeof makeHand>[0]> = {}) =>
  makeHand({ id, pose, center: { x, y: 0.75 }, ...extra })

const R = (pose: SyntheticPose, x = 0.6, extra = {}): TrackedHand[] => [hand('Right', pose, x, extra)]

describe('single-hand state machine', () => {
  it('open palm activates the workspace once', () => {
    const d = new Driver()
    d.hold(10, R('open'))
    expect(d.last.state).toBe('workspace')
    expect(d.events).toEqual(['open_palm_start'])
  })

  it('a single noisy frame does not change state', () => {
    const d = new Driver()
    d.hold(6, R('open'))
    d.step(R('fist'))
    d.hold(6, R('open'))
    expect(d.last.state).toBe('workspace')
    expect(d.events).toEqual(['open_palm_start'])
  })

  it('pinch selects, holding grabs, release ends both', () => {
    const d = new Driver()
    d.hold(6, R('open'))
    d.hold(14, R('pinch'))
    expect(d.last.state).toBe('grabbing')
    d.hold(6, R('open'))
    expect(d.last.state).toBe('workspace')
    expect(d.events).toEqual([
      'open_palm_start',
      'open_palm_end',
      'pinch_start',
      'grab_start',
      'grab_end',
      'pinch_end',
      'open_palm_start',
    ])
  })

  it('a one-frame dropout does not drop a grab', () => {
    const d = new Driver()
    d.hold(6, R('open'))
    d.hold(12, R('pinch'))
    d.step(R('open'))
    d.hold(4, R('pinch'))
    expect(d.last.state).toBe('grabbing')
    expect(d.events).not.toContain('grab_end')
  })

  it('fist pauses manipulation without firing pinch events', () => {
    const d = new Driver()
    d.hold(6, R('open'))
    d.hold(8, R('fist'))
    expect(d.last.state).toBe('paused')
    expect(d.events).toEqual(['open_palm_start', 'open_palm_end', 'fist_start'])
  })

  it('double pinch fires when a second tap follows quickly', () => {
    const d = new Driver()
    d.hold(6, R('open'))
    d.hold(3, R('pinch'))
    d.hold(4, R('open'))
    d.hold(2, R('pinch'))
    expect(d.events.filter((e) => e === 'double_pinch')).toHaveLength(1)
    const i = d.events.lastIndexOf('pinch_start')
    expect(d.events[i + 1]).toBe('double_pinch')
  })

  it('no double pinch when the second tap is too late', () => {
    const d = new Driver()
    d.hold(6, R('open'))
    d.hold(3, R('pinch'))
    d.hold(25, R('open'))
    d.hold(3, R('pinch'))
    expect(d.events).not.toContain('double_pinch')
  })

  it('ignores the non-dominant hand', () => {
    const d = new Driver()
    d.hold(10, [hand('Left', 'fist', 0.3), hand('Right', 'open', 0.7)])
    expect(d.last.state).toBe('workspace')
    expect(d.events).not.toContain('fist_start')
  })

  it('stale (tracking-lost) hands hold the previous pose', () => {
    const d = new Driver()
    d.hold(6, R('open'))
    d.hold(10, R('fist', 0.6, { stale: true }))
    expect(d.last.state).toBe('workspace')
  })

  it('losing the hand ends the gesture', () => {
    const d = new Driver()
    d.hold(6, R('open'))
    d.step([])
    expect(d.last.state).toBe('idle')
    expect(d.events).toEqual(['open_palm_start', 'open_palm_end'])
  })
})

describe('motion', () => {
  it('reports cursor movement while grabbing', () => {
    const d = new Driver()
    d.hold(6, R('open', 0.4))
    d.hold(12, R('pinch', 0.4))
    let sum = 0
    d.hold(10, (i) => R('pinch', 0.4 + 0.02 * (i + 1)))
    for (const f of d.frames.slice(-10)) sum += f.motion.move.x
    expect(sum).toBeCloseTo(0.2, 4)
  })

  it('reports wrist rotation beyond the deadzone, clockwise positive', () => {
    const d = new Driver()
    d.hold(6, R('open'))
    d.hold(12, R('pinch'))
    const deg2 = (2 * Math.PI) / 180
    d.hold(15, (i) => R('pinch', 0.6, { rollRad: deg2 * (i + 1) }))
    const sum = d.frames.slice(-15).reduce((s, f) => s + f.motion.rotate, 0)
    expect(sum).toBeGreaterThan(0.3) // ~20° of the 30° total, after the 8° deadzone
    expect(sum).toBeLessThan(0.4)
  })

  it('small roll jitter never produces rotation', () => {
    const d = new Driver()
    d.hold(6, R('open'))
    d.hold(12, R('pinch'))
    const deg3 = (3 * Math.PI) / 180
    d.hold(20, (i) => R('pinch', 0.6, { rollRad: i % 2 ? deg3 : -deg3 }))
    expect(d.frames.slice(-20).every((f) => f.motion.rotate === 0)).toBe(true)
  })
})

describe('two-hand interaction', () => {
  const both = (pose: SyntheticPose, lx: number, rx: number, ly = 0.75, ry = 0.75): TrackedHand[] => [
    makeHand({ id: 'Left', pose, center: { x: lx, y: ly } }),
    makeHand({ id: 'Right', pose, center: { x: rx, y: ry } }),
  ]

  it('both hands pinching enters two_hand', () => {
    const d = new Driver()
    d.hold(6, both('open', 0.3, 0.7))
    d.hold(6, both('pinch', 0.3, 0.7))
    expect(d.last.state).toBe('two_hand')
    expect(d.events).toEqual(['open_palm_start', 'open_palm_end', 'two_hand_start'])
  })

  it('spreading hands apart produces positive zoom', () => {
    const d = new Driver()
    d.hold(6, both('open', 0.3, 0.7))
    d.hold(6, both('pinch', 0.3, 0.7))
    d.hold(10, (i) => both('pinch', 0.3 - 0.01 * (i + 1), 0.7 + 0.01 * (i + 1)))
    const sum = d.frames.slice(-10).reduce((s, f) => s + f.motion.zoom, 0)
    expect(sum).toBeCloseTo(Math.log(1.5), 2)
  })

  it('tilting the hand line produces clockwise rotation', () => {
    const d = new Driver()
    d.hold(6, both('open', 0.3, 0.7))
    d.hold(6, both('pinch', 0.3, 0.7))
    d.hold(10, (i) => both('pinch', 0.3, 0.7, 0.75 - 0.01 * (i + 1), 0.75 + 0.01 * (i + 1)))
    const sum = d.frames.slice(-10).reduce((s, f) => s + f.motion.rotate, 0)
    expect(sum).toBeCloseTo(Math.atan2(0.2, 0.4 * (4 / 3)), 2)
  })

  it('releasing one hand does not turn the other into a new select', () => {
    const d = new Driver()
    d.hold(6, [hand('Right', 'open', 0.7)])
    d.hold(4, [hand('Right', 'pinch', 0.7)])
    d.hold(4, [hand('Left', 'pinch', 0.3), hand('Right', 'pinch', 0.7)])
    expect(d.last.state).toBe('two_hand')

    d.hold(10, [hand('Left', 'open', 0.3), hand('Right', 'pinch', 0.7)])
    expect(d.last.state).toBe('idle') // latched: Right still pinching
    expect(d.events.slice(-2)).toEqual(['two_hand_end', 'pinch_end'])
    expect(d.events.filter((e) => e === 'pinch_start')).toHaveLength(1)

    d.hold(6, [hand('Left', 'open', 0.3), hand('Right', 'open', 0.7)])
    expect(d.last.state).toBe('workspace')
  })
})