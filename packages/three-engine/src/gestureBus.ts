import type { GestureFrame } from '@aether/gestures'

const MAX_QUEUE = 90

/**
 * Carries gesture frames from the vision loop to the render loop.
 * Frames are queued (not overwritten) so discrete events are never lost
 * when tracking and rendering run at different rates.
 */
export class GestureBus {
  /** Most recent frame, for passive readers like the on-screen cursor. */
  latest: GestureFrame | null = null
  private queue: GestureFrame[] = []

  publish(frame: GestureFrame) {
    this.latest = frame
    this.queue.push(frame)
    if (this.queue.length > MAX_QUEUE) {
      // Overflow means rendering stalled. Drop old motion-only frames, never frames carrying events.
      const keepFrom = this.queue.length - MAX_QUEUE / 2
      this.queue = this.queue.filter((f, i) => f.events.length > 0 || i >= keepFrom)
    }
  }

  drain(): GestureFrame[] {
    return this.queue.splice(0)
  }

  clear() {
    this.queue = []
    this.latest = null
  }
}