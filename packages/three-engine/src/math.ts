import { Plane, Quaternion, Ray, Raycaster, Spherical, Vector2, Vector3, type Camera } from 'three'
import type { Vec2 } from '@aether/gestures'
import type { Quat, Vec3 } from './types'

export interface Ndc {
  x: number
  y: number
}

export const CURSOR_MARGIN = 0.12
export const MIN_SCALE = 0.3
export const MAX_SCALE = 4
export const MIN_GRAB_DISTANCE = 1.5
export const MAX_GRAB_DISTANCE = 30
export const MIN_PHI = 0.2
export const MAX_PHI = Math.PI * 0.49 // keep the camera above the floor grid

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
export const clampScale = (s: number) => clamp(s, MIN_SCALE, MAX_SCALE)
export const clampPosition = (p: Vec3): Vec3 => [clamp(p[0], -8, 8), clamp(p[1], -1, 6), clamp(p[2], -8, 8)]

/**
 * Maps a cursor (0..1 of the camera frame, mirrored) to 0..1 of the canvas.
 * The margin means the screen edges are reachable without your hand leaving the camera view.
 */
export function mapCursor(c: Vec2, margin = CURSOR_MARGIN): Vec2 {
  const span = 1 - 2 * margin
  return { x: clamp((c.x - margin) / span, 0, 1), y: clamp((c.y - margin) / span, 0, 1) }
}

/** 0..1 canvas coordinates (y down) → normalized device coordinates (y up). */
export const toNdc = (p: Vec2): Ndc => ({ x: p.x * 2 - 1, y: -(p.y * 2 - 1) })

const raycaster = new Raycaster()
const ndcVec = new Vector2()

function rayAt(camera: Camera, ndc: Ndc): Ray {
  camera.updateMatrixWorld()
  raycaster.setFromCamera(ndcVec.set(ndc.x, ndc.y), camera)
  return raycaster.ray.clone()
}

export const cameraForward = (camera: Camera): Vector3 => camera.getWorldDirection(new Vector3())

export interface GrabSession {
  id: string
  /** Distance from the camera, along its forward axis, of the plane the object is dragged on. */
  distance: number
  /** In-plane vector from the grab point to the object's origin's position, preserved while dragging. */
  offset: Vector3
}

function planeHit(camera: Camera, ndc: Ndc, distance: number): Vector3 | null {
  const forward = cameraForward(camera)
  const point = camera.position.clone().addScaledVector(forward, distance)
  const plane = new Plane().setFromNormalAndCoplanarPoint(forward, point)
  return rayAt(camera, ndc).intersectPlane(plane, new Vector3())
}

export function beginGrab(camera: Camera, ndc: Ndc, position: Vec3, id: string): GrabSession | null {
  const p = new Vector3(...position)
  const distance = p.clone().sub(camera.position).dot(cameraForward(camera))
  if (distance <= 0.1) return null // object is behind the camera
  const hit = planeHit(camera, ndc, distance)
  if (!hit) return null
  return { id, distance, offset: hit.sub(p) }
}

export function dragPosition(camera: Camera, ndc: Ndc, session: GrabSession): Vec3 | null {
  const hit = planeHit(camera, ndc, session.distance)
  if (!hit) return null
  hit.sub(session.offset)
  return [hit.x, hit.y, hit.z]
}

/** Moves the grab plane nearer/farther. `logDelta` < 0 brings the object closer to the camera. */
export function adjustGrabDistance(session: GrabSession, logDelta: number) {
  const next = clamp(session.distance * Math.exp(logDelta), MIN_GRAB_DISTANCE, MAX_GRAB_DISTANCE)
  session.offset.multiplyScalar(next / session.distance) // keep the grab point under the cursor
  session.distance = next
}

/** Rotates in world space: result = rotation(axis, angle) * q. */
export function rotateAboutAxis(q: Quat, axis: Vector3, angle: number): Quat {
  const dq = new Quaternion().setFromAxisAngle(axis, angle)
  dq.multiply(new Quaternion(q[0], q[1], q[2], q[3])).normalize()
  return [dq.x, dq.y, dq.z, dq.w]
}

/** Moves the camera around `target`. Positive dTheta moves the camera toward +x. */
export function orbitCamera(camera: Camera, target: Vector3, dTheta: number, dPhi: number) {
  const offset = camera.position.clone().sub(target)
  const sph = new Spherical().setFromVector3(offset)
  sph.theta += dTheta
  sph.phi = clamp(sph.phi + dPhi, MIN_PHI, MAX_PHI)
  camera.position.copy(target).add(offset.setFromSpherical(sph))
  camera.lookAt(target)
}

/** Multiplies the camera's distance to `target` by exp(logFactor), clamped. */
export function dollyCamera(camera: Camera, target: Vector3, logFactor: number, min = 2.5, max = 18) {
  const offset = camera.position.clone().sub(target)
  const length = clamp(offset.length() * Math.exp(logFactor), min, max)
  camera.position.copy(target).add(offset.setLength(length))
}