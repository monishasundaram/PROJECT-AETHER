import type { Vec2 } from './types'

/** Distance with x scaled by aspect so it matches pixel proportions. */
export const dist = (a: Vec2, b: Vec2, aspect: number): number => Math.hypot((a.x - b.x) * aspect, a.y - b.y)

export const mid = (a: Vec2, b: Vec2): Vec2 => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y })

/** Signed shortest rotation from `from` to `to`, in [-π, π]. */
export function angleDiff(from: number, to: number): number {
  let d = to - from
  while (d > Math.PI) d -= 2 * Math.PI
  while (d < -Math.PI) d += 2 * Math.PI
  return d
}