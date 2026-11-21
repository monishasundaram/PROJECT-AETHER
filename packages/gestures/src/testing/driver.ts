import type { TrackedHand } from '@aether/shared'
import { GestureEngine } from '../engine'
import type { GestureEventType, GestureFrame } from '../types'

export const FRAME_MS = 1000 / 30

/** Feeds frames to an engine at a fixed 30 FPS clock and records the output. */
export class Driver {
  t = 0
  readonly frames: GestureFrame[] = []

  constructor(readonly engine = new GestureEngine()) {}

  step(hands: TrackedHand[]): GestureFrame {
    this.t += FRAME_MS
    const frame = this.engine.update(hands, this.t)
    this.frames.push(frame)
    return frame
  }

  hold(n: number, hands: TrackedHand[] | ((i: number) => TrackedHand[])) {
    for (let i = 0; i < n; i++) this.step(typeof hands === 'function' ? hands(i) : hands)
  }

  get events(): GestureEventType[] {
    return this.frames.flatMap((f) => f.events.map((e) => e.type))
  }

  get last(): GestureFrame {
    return this.frames[this.frames.length - 1]
  }
}