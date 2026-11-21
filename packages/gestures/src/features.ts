import { LM, type TrackedHand } from '@aether/shared'
import { dist, mid } from './geometry'
import type { FingerExtension, Vec2 } from './types'

export interface HandFeatures {
  /** Palm length (wrist → middle MCP), aspect-corrected. Grows as the hand nears the camera. */
  scale: number
  /** Thumb tip ↔ index tip distance / scale. */
  pinchRatio: number
  extension: FingerExtension
  /** Stable cursor anchor (between index and middle knuckles), mirrored screen space. */
  anchor: Vec2
  /** Midpoint of thumb and index tips, mirrored screen space. */
  pinchPoint: Vec2
  /** Wrist→middle-knuckle direction, radians clockwise from "up" on the mirrored screen. */
  rollAngle: number
}

const toScreen = (p: Vec2): Vec2 => ({ x: 1 - p.x, y: p.y })

export function extractFeatures(hand: TrackedHand, aspect: number): HandFeatures {
  const lm = hand.landmarks
  const wrist = lm[LM.WRIST]
  const scale = Math.max(dist(wrist, lm[LM.MIDDLE_MCP], aspect), 1e-6)

  const ext = (pip: number, tip: number) =>
    dist(wrist, lm[tip], aspect) / Math.max(dist(wrist, lm[pip], aspect), 1e-6)

  const middleMcp = lm[LM.MIDDLE_MCP]
  const vx = -(middleMcp.x - wrist.x) * aspect // negated: mirrored view
  const vy = middleMcp.y - wrist.y

  return {
    scale,
    pinchRatio: dist(lm[LM.THUMB_TIP], lm[LM.INDEX_TIP], aspect) / scale,
    extension: [
      ext(LM.INDEX_PIP, LM.INDEX_TIP),
      ext(LM.MIDDLE_PIP, LM.MIDDLE_TIP),
      ext(LM.RING_PIP, LM.RING_TIP),
      ext(LM.PINKY_PIP, LM.PINKY_TIP),
    ],
    anchor: toScreen(mid(lm[LM.INDEX_MCP], lm[LM.MIDDLE_MCP])),
    pinchPoint: toScreen(mid(lm[LM.THUMB_TIP], lm[LM.INDEX_TIP])),
    rollAngle: Math.atan2(vx, -vy),
  }
}