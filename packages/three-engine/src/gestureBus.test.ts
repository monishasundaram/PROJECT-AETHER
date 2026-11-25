import { describe, expect, it } from 'vitest'
import type { GestureEvent, GestureFrame } from '@aether/gestures'
import { GestureBus } from './gestureBus'

const frame = (events: GestureEvent[] = []): GestureFrame => ({
  t: 0,
  state: 'idle',
  primary: null,
  cursor: null,
  motion: { move: { x: 0, y: 0 }, depth: 0, rotate: 0, zoom: 0 },
  events,
  hands: {},
})

describe('GestureBus', () => {
  it('delivers frames in order and empties on drain', () => {
    const bus = new GestureBus()
    const a = frame()
    const b = frame()
    bus.publish(a)
    bus.publish(b)
    expect(bus.drain()).toEqual([a, b])
    expect(bus.drain()).toEqual([])
    expect(bus.latest).toBe(b)
  })

  it('never drops frames that carry events on overflow', () => {
    const bus = new GestureBus()
    const important = frame([{ type: 'grab_start', t: 0, cursor: null }])
    bus.publish(important)
    for (let i = 0; i < 200; i++) bus.publish(frame())
    const drained = bus.drain()
    expect(drained).toContain(important)
    expect(drained.length).toBeLessThan(100)
  })

  it('clear resets everything', () => {
    const bus = new GestureBus()
    bus.publish(frame())
    bus.clear()
    expect(bus.drain()).toEqual([])
    expect(bus.latest).toBeNull()
  })
})