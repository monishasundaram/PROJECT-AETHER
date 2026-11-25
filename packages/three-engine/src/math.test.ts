import { PerspectiveCamera, Spherical, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import {
  MAX_PHI,
  adjustGrabDistance,
  beginGrab,
  clampScale,
  dollyCamera,
  dragPosition,
  mapCursor,
  orbitCamera,
  rotateAboutAxis,
  toNdc,
} from './math'

const camera = (pos: [number, number, number] = [0, 0, 8]) => {
  const c = new PerspectiveCamera(50, 1.5, 0.1, 100)
  c.position.set(...pos)
  c.lookAt(0, 0, 0)
  c.updateMatrixWorld()
  return c
}

describe('cursor mapping', () => {
  it('centers stay centered and margins reach the edges', () => {
    expect(mapCursor({ x: 0.5, y: 0.5 })).toEqual({ x: 0.5, y: 0.5 })
    expect(mapCursor({ x: 0.12, y: 0.12 })).toEqual({ x: 0, y: 0 })
    expect(mapCursor({ x: 0.88, y: 0.88 })).toEqual({ x: 1, y: 1 })
    expect(mapCursor({ x: -1, y: 2 })).toEqual({ x: 0, y: 1 })
  })

  it('converts canvas coordinates to NDC with y flipped', () => {
    expect(toNdc({ x: 0, y: 0 })).toEqual({ x: -1, y: 1 })
    expect(toNdc({ x: 1, y: 1 })).toEqual({ x: 1, y: -1 })
  })
})

describe('grab dragging', () => {
  it('keeps the object in place when the cursor does not move', () => {
    const cam = camera()
    const s = beginGrab(cam, { x: 0, y: 0 }, [1, 0, 0], 'a')!
    const p = dragPosition(cam, { x: 0, y: 0 }, s)!
    expect(p[0]).toBeCloseTo(1, 6)
    expect(p[1]).toBeCloseTo(0, 6)
    expect(p[2]).toBeCloseTo(0, 6)
  })

  it('moves in the view plane without changing depth', () => {
    const cam = camera()
    const s = beginGrab(cam, { x: 0, y: 0 }, [0, 0, 0], 'a')!
    const p = dragPosition(cam, { x: 0.5, y: 0.2 }, s)!
    expect(p[0]).toBeGreaterThan(0.5)
    expect(p[1]).toBeGreaterThan(0)
    expect(p[2]).toBeCloseTo(0, 6)
  })

  it('refuses to grab an object behind the camera', () => {
    expect(beginGrab(camera(), { x: 0, y: 0 }, [0, 0, 20], 'a')).toBeNull()
  })

  it('adjusting distance scales the grab plane and offset together', () => {
    const cam = camera()
    const s = beginGrab(cam, { x: 0.5, y: 0 }, [0, 0, 0], 'a')!
    const offsetLen = s.offset.length()
    adjustGrabDistance(s, Math.log(0.5))
    expect(s.distance).toBeCloseTo(4, 6)
    expect(s.offset.length()).toBeCloseTo(offsetLen / 2, 6)
  })

  it('clamps grab distance', () => {
    const s = beginGrab(camera(), { x: 0, y: 0 }, [0, 0, 0], 'a')!
    adjustGrabDistance(s, -20)
    expect(s.distance).toBe(1.5)
  })
})

describe('rotation and scale', () => {
  it('rotates about a world axis', () => {
    const q = rotateAboutAxis([0, 0, 0, 1], new Vector3(0, 1, 0), Math.PI / 2)
    expect(q[1]).toBeCloseTo(Math.SQRT1_2, 6)
    expect(q[3]).toBeCloseTo(Math.SQRT1_2, 6)
  })

  it('composes rotations', () => {
    const axis = new Vector3(0, 1, 0)
    const once = rotateAboutAxis([0, 0, 0, 1], axis, Math.PI / 2)
    const twice = rotateAboutAxis(rotateAboutAxis([0, 0, 0, 1], axis, Math.PI / 4), axis, Math.PI / 4)
    twice.forEach((v, i) => expect(v).toBeCloseTo(once[i], 6))
  })

  it('clamps scale', () => {
    expect(clampScale(100)).toBe(4)
    expect(clampScale(0.001)).toBe(0.3)
  })
})

describe('camera motion', () => {
  const target = new Vector3(0, 0.6, 0)

  it('orbiting preserves distance and moves the camera toward +x for positive theta', () => {
    const cam = camera([0, 3, 8])
    const before = cam.position.distanceTo(target)
    orbitCamera(cam, target, 0.5, 0)
    expect(cam.position.distanceTo(target)).toBeCloseTo(before, 6)
    expect(cam.position.x).toBeGreaterThan(0)
  })

  it('clamps the polar angle above the floor', () => {
    const cam = camera([0, 3, 8])
    orbitCamera(cam, target, 0, 5)
    const sph = new Spherical().setFromVector3(cam.position.clone().sub(target))
    expect(sph.phi).toBeLessThanOrEqual(MAX_PHI + 1e-9)
  })

  it('dolly clamps to min and max distance', () => {
    const cam = camera([0, 3, 8])
    dollyCamera(cam, target, -10)
    expect(cam.position.distanceTo(target)).toBeCloseTo(2.5, 6)
    dollyCamera(cam, target, 10)
    expect(cam.position.distanceTo(target)).toBeCloseTo(18, 6)
  })
})