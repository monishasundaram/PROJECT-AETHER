import type { Camera, Vector3 } from 'three'
import type { GestureEvent, GestureFrame, Vec2 } from '@aether/gestures'
import {
  adjustGrabDistance,
  beginGrab,
  cameraForward,
  clampPosition,
  clampScale,
  dollyCamera,
  dragPosition,
  mapCursor,
  orbitCamera,
  rotateAboutAxis,
  toNdc,
  type GrabSession,
  type Ndc,
} from './math'
import type { SceneApi, TransformPatch } from './types'

/** Tuning knobs. Flip a sign here if a motion feels inverted. */
export const GAIN = {
  /** Hand size change → object distance. */
  depth: 1.5,
  /** Two-hand span change → object scale / camera dolly. */
  zoom: 1.2,
  /** Wrist roll → object roll (1 = follows your hand exactly). */
  rotate: 1,
  /** Radians of camera orbit per full-frame hand movement. */
  orbit: 2.5,
} as const

export interface InteractionContext {
  camera: Camera
  /** Point the camera orbits and dollies around. */
  target: Vector3
  pick(ndc: Ndc): string | null
}

const ndcOf = (c: Vec2 | null): Ndc | null => (c ? toNdc(mapCursor(c)) : null)

export class InteractionController {
  private grab: GrabSession | null = null
  private pinchTarget: string | null = null
  /** True once the current pinch became a grab or two-hand gesture (so releasing it isn't a "tap"). */
  private pinchConsumed = false

  constructor(private readonly scene: SceneApi) {}

  process(frame: GestureFrame, ctx: InteractionContext): void {
    const ndc = ndcOf(frame.cursor)

    for (const e of frame.events) this.onEvent(e, ctx)

    switch (frame.state) {
      case 'grabbing':
        this.applyGrab(frame, ndc, ctx)
        break
      case 'two_hand':
        this.applyTwoHand(frame, ndc, ctx)
        break
      case 'workspace':
        this.applyWorkspace(frame, ctx)
        break
      default:
        break
    }

    const hovering = frame.state === 'workspace' || frame.state === 'pinching' || frame.state === 'idle'
    this.scene.hover(hovering && ndc ? ctx.pick(ndc) : null)
  }

  reset() {
    this.endGrab()
    this.pinchTarget = null
    this.pinchConsumed = false
    this.scene.hover(null)
  }

  private onEvent(e: GestureEvent, ctx: InteractionContext) {
    switch (e.type) {
      case 'pinch_start': {
        const ndc = ndcOf(e.cursor)
        const id = ndc ? ctx.pick(ndc) : null
        this.pinchTarget = id
        this.pinchConsumed = false
        if (id) this.scene.select(id)
        break
      }
      case 'grab_start':
        this.pinchConsumed = true
        // Grab what was pinched; if the pinch was on empty space, "remote-grab" the selection.
        this.startSession(this.pinchTarget ?? this.scene.getSelected(), e.cursor, ctx)
        break
      case 'grab_end':
        this.endGrab()
        break
      case 'two_hand_start':
        this.pinchConsumed = true
        this.startSession(this.scene.getSelected(), e.cursor, ctx)
        break
      case 'two_hand_end':
        this.endGrab()
        break
      case 'pinch_end':
        // A quick tap on empty space deselects. Releasing a grab or two-hand gesture doesn't.
        if (!this.pinchConsumed && this.pinchTarget === null) this.scene.select(null)
        this.pinchTarget = null
        this.pinchConsumed = false
        break
      default:
        break
    }
  }

  private startSession(id: string | null, cursor: Vec2 | null, ctx: InteractionContext) {
    const ndc = ndcOf(cursor)
    const obj = id ? this.scene.getObject(id) : undefined
    if (!id || !ndc || !obj) return
    const session = beginGrab(ctx.camera, ndc, obj.position, id)
    if (!session) return
    this.grab = session
    this.scene.select(id)
    this.scene.setGrabbed(id)
  }

  private endGrab() {
    this.grab = null
    this.scene.setGrabbed(null)
  }

  private applyGrab(frame: GestureFrame, ndc: Ndc | null, ctx: InteractionContext) {
    const grab = this.grab
    if (!grab || !ndc) return
    const obj = this.scene.getObject(grab.id)
    if (!obj) return this.endGrab()

    const { depth, rotate } = frame.motion
    if (depth !== 0) adjustGrabDistance(grab, -depth * GAIN.depth) // hand toward camera → object closer

    const patch: TransformPatch = {}
    const pos = dragPosition(ctx.camera, ndc, grab)
    if (pos) patch.position = clampPosition(pos)
    if (rotate !== 0) {
      patch.quaternion = rotateAboutAxis(obj.quaternion, cameraForward(ctx.camera), rotate * GAIN.rotate)
    }
    this.scene.update(grab.id, patch)
  }

  private applyTwoHand(frame: GestureFrame, ndc: Ndc | null, ctx: InteractionContext) {
    const { zoom, rotate } = frame.motion
    const grab = this.grab
    const obj = grab ? this.scene.getObject(grab.id) : undefined

    if (grab && obj) {
      const patch: TransformPatch = {}
      const pos = ndc ? dragPosition(ctx.camera, ndc, grab) : null
      if (pos) patch.position = clampPosition(pos)
      if (zoom !== 0) patch.scale = clampScale(obj.scale * Math.exp(zoom * GAIN.zoom))
      if (rotate !== 0) {
        patch.quaternion = rotateAboutAxis(obj.quaternion, cameraForward(ctx.camera), rotate * GAIN.rotate)
      }
      this.scene.update(grab.id, patch)
    } else if (zoom !== 0) {
      // Nothing selected: spreading your hands zooms the view in.
      dollyCamera(ctx.camera, ctx.target, -zoom * GAIN.zoom)
    }
  }

  private applyWorkspace(frame: GestureFrame, ctx: InteractionContext) {
    if (this.scene.getHandMode() !== 'orbit') return
    const { x, y } = frame.motion.move
    if (x === 0 && y === 0) return
    // Dragging the scene: hand right turns the scene right, hand up tilts the view from below.
    orbitCamera(ctx.camera, ctx.target, -x * GAIN.orbit, -y * GAIN.orbit)
  }
}