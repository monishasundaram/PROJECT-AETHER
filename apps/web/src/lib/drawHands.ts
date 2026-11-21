import type { TrackedHand } from '@aether/shared'
import type { InteractionState, Vec2 } from '@aether/gestures'
import { HAND_CONNECTIONS } from '@aether/vision'

const HAND_COLORS = { Left: '#3b82f6', Right: '#22d3ee' } as const

const STATE_COLORS: Record<InteractionState, string> = {
  idle: '#64748b',
  workspace: '#22d3ee',
  paused: '#f87171',
  pinching: '#fbbf24',
  grabbing: '#34d399',
  two_hand: '#a78bfa',
}

export interface Overlay {
  cursor: Vec2 | null
  state: InteractionState
}

export function drawHands(
  ctx: CanvasRenderingContext2D,
  hands: TrackedHand[],
  w: number,
  h: number,
  overlay?: Overlay,
) {
  ctx.clearRect(0, 0, w, h)
  ctx.lineWidth = 2

  for (const hand of hands) {
    const color = HAND_COLORS[hand.id]
    ctx.globalAlpha = hand.stale ? 0.35 : 1
    ctx.strokeStyle = color
    ctx.fillStyle = color

    ctx.beginPath()
    for (const [a, b] of HAND_CONNECTIONS) {
      const p = hand.landmarks[a]
      const q = hand.landmarks[b]
      ctx.moveTo(p.x * w, p.y * h)
      ctx.lineTo(q.x * w, q.y * h)
    }
    ctx.stroke()

    for (const p of hand.landmarks) {
      ctx.beginPath()
      ctx.arc(p.x * w, p.y * h, 3, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.globalAlpha = 1

  if (overlay?.cursor) {
    // Cursor is in mirrored screen space; this canvas is CSS-mirrored, so draw in raw coordinates.
    const x = (1 - overlay.cursor.x) * w
    const y = overlay.cursor.y * h
    const color = STATE_COLORS[overlay.state]
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(x, y, 12, 0, Math.PI * 2)
    ctx.stroke()
    if (overlay.state === 'grabbing' || overlay.state === 'two_hand') {
      ctx.beginPath()
      ctx.arc(x, y, 5, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}