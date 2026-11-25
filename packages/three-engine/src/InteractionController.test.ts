import { PerspectiveCamera, Vector3 } from 'three'
import { beforeEach, describe, expect, it } from 'vitest'
import type { GestureEvent, GestureFrame } from '@aether/gestures'
import { GAIN, InteractionController, type InteractionContext } from './InteractionController'
import type { HandMode, SceneApi, SceneObjectData } from './types'

const makeObj = (id: string): SceneObjectData => ({
  id,
  name: id,
  kind: 'box',
  color: '#fff',
  position: [0, 0, 0],
  quaternion: [0, 0, 0, 1],
  scale: 1,
  home: { position: [0, 0, 0], quaternion: [0, 0, 0, 1], scale: 1 },
})

function makeScene() {
  const state = {
    objects: { a: makeObj('a'), b: { ...makeObj('b'), position: [3, 0, 0] as [number, number, number] } } as Record<string, SceneObjectData>,
    selected: null as string | null,
    hovered: null as string | null,
    grabbed: null as string | null,
    mode: 'select' as HandMode,
  }
  const api: SceneApi = {
    getObject: (id) => state.objects[id],
    getSelected: () => state.selected,
    getHandMode: () => state.mode,
    select: (id) => void (state.selected = id),
    hover: (id) => void (state.hovered = id),
    setGrabbed: (id) => void (state.grabbed = id),
    update: (id, patch) => void (state.objects[id] = { ...state.objects[id], ...patch }),
  }
  return { state, api }
}

const CENTER = { x: 0.5, y: 0.5 }
const frame = (p: Partial<GestureFrame> = {}): GestureFrame => ({
  t: 0,
  state: 'idle',
  primary: 'Right',
  cursor: CENTER,
  motion: { move: { x: 0, y: 0 }, depth: 0, rotate: 0, zoom: 0 },
  events: [],
  hands: {},
  ...p,
})
const ev = (type: GestureEvent['type'], cursor = CENTER): GestureEvent => ({ type, t: 0, cursor })
const motion = (m: Partial<GestureFrame['motion']>) => ({ move: { x: 0, y: 0 }, depth: 0, rotate: 0, zoom: 0, ...m })

let scene: ReturnType<typeof makeScene>
let controller: InteractionController
let camera: PerspectiveCamera
let picked: string | null
let ctx: InteractionContext

beforeEach(() => {
  scene = makeScene()
  controller = new InteractionController(scene.api)
  camera = new PerspectiveCamera(50, 1.5, 0.1, 100)
  camera.position.set(0, 0, 8)
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld()
  picked = null
  ctx = { camera, target: new Vector3(0, 0.6, 0), pick: () => picked }
})

describe('selection', () => {
  it('pinching an object selects it and keeps it selected after a tap', () => {
    picked = 'a'
    controller.process(frame({ state: 'pinching', events: [ev('pinch_start')] }), ctx)
    expect(scene.state.selected).toBe('a')
    controller.process(frame({ state: 'workspace', events: [ev('pinch_end')] }), ctx)
    expect(scene.state.selected).toBe('a')
  })

  it('tapping empty space deselects on release', () => {
    scene.state.selected = 'a'
    picked = null
    controller.process(frame({ state: 'pinching', events: [ev('pinch_start')] }), ctx)
    expect(scene.state.selected).toBe('a') // not yet: it might become a two-hand gesture
    controller.process(frame({ state: 'workspace', events: [ev('pinch_end')] }), ctx)
    expect(scene.state.selected).toBeNull()
  })

  it('hover follows the cursor and clears when the hand disappears', () => {
    picked = 'b'
    controller.process(frame({ state: 'workspace' }), ctx)
    expect(scene.state.hovered).toBe('b')
    controller.process(frame({ state: 'idle', cursor: null }), ctx)
    expect(scene.state.hovered).toBeNull()
  })
})

describe('grabbing', () => {
  function startGrab() {
    picked = 'a'
    controller.process(frame({ state: 'pinching', events: [ev('pinch_start')] }), ctx)
    controller.process(frame({ state: 'grabbing', events: [ev('grab_start')] }), ctx)
  }

  it('moves the object in the view plane following the cursor, then stops on release', () => {
    startGrab()
    expect(scene.state.grabbed).toBe('a')

    controller.process(frame({ state: 'grabbing', cursor: { x: 0.62, y: 0.5 } }), ctx)
    const [x, y, z] = scene.state.objects.a.position
    expect(x).toBeGreaterThan(0.3)
    expect(y).toBeCloseTo(0, 6)
    expect(z).toBeCloseTo(0, 6)

    controller.process(frame({ state: 'workspace', events: [ev('grab_end'), ev('pinch_end')] }), ctx)
    expect(scene.state.grabbed).toBeNull()
    const frozen = [...scene.state.objects.a.position]
    controller.process(frame({ state: 'workspace', cursor: { x: 0.9, y: 0.5 } }), ctx)
    expect(scene.state.objects.a.position).toEqual(frozen)
    expect(scene.state.selected).toBe('a') // release after a grab doesn't deselect
  })

  it('hand moving toward the camera brings the object closer', () => {
    startGrab()
    controller.process(frame({ state: 'grabbing', motion: motion({ depth: 0.2 }) }), ctx)
    expect(scene.state.objects.a.position[2]).toBeGreaterThan(0.5)
  })

  it('wrist roll spins the object about the view axis', () => {
    startGrab()
    controller.process(frame({ state: 'grabbing', motion: motion({ rotate: 0.5 }) }), ctx)
    const q = scene.state.objects.a.quaternion
    expect(q[2]).toBeCloseTo(-Math.sin(0.25), 6) // camera looks down -z
    expect(q[0]).toBeCloseTo(0, 6)
    expect(q[1]).toBeCloseTo(0, 6)
  })

  it('remote-grabs the selection when the pinch started on empty space', () => {
    scene.state.selected = 'a'
    picked = null
    controller.process(frame({ state: 'pinching', events: [ev('pinch_start')] }), ctx)
    controller.process(frame({ state: 'grabbing', events: [ev('grab_start')] }), ctx)
    expect(scene.state.grabbed).toBe('a')
  })

  it('does nothing when there is nothing to grab', () => {
    picked = null
    controller.process(frame({ state: 'pinching', events: [ev('pinch_start')] }), ctx)
    controller.process(frame({ state: 'grabbing', events: [ev('grab_start')] }), ctx)
    expect(scene.state.grabbed).toBeNull()
  })

  it('a lost hand (grab_end) releases the object', () => {
    startGrab()
    controller.process(frame({ state: 'idle', cursor: null, events: [ev('grab_end', CENTER)] }), ctx)
    expect(scene.state.grabbed).toBeNull()
  })
})

describe('two-hand', () => {
  it('scales and rotates the selected object', () => {
    scene.state.selected = 'a'
    controller.process(frame({ state: 'two_hand', events: [ev('two_hand_start')] }), ctx)
    expect(scene.state.grabbed).toBe('a')

    controller.process(frame({ state: 'two_hand', motion: motion({ zoom: Math.log(1.5), rotate: 0.3 }) }), ctx)
    const o = scene.state.objects.a
    expect(o.scale).toBeCloseTo(Math.exp(Math.log(1.5) * GAIN.zoom), 6)
    expect(o.quaternion[2]).toBeCloseTo(-Math.sin(0.15), 6)

    controller.process(frame({ state: 'workspace', events: [ev('two_hand_end'), ev('pinch_end')] }), ctx)
    expect(scene.state.grabbed).toBeNull()
    expect(scene.state.selected).toBe('a')
  })

  it('dollies the camera when nothing is selected (spread = closer)', () => {
    const before = camera.position.distanceTo(ctx.target)
    controller.process(frame({ state: 'two_hand', events: [ev('two_hand_start')] }), ctx)
    controller.process(frame({ state: 'two_hand', motion: motion({ zoom: 0.3 }) }), ctx)
    expect(camera.position.distanceTo(ctx.target)).toBeLessThan(before)
  })
})

describe('orbit mode', () => {
  it('orbits the camera from open-palm movement only in orbit mode', () => {
    camera.position.set(0, 3, 8)
    controller.process(frame({ state: 'workspace', motion: motion({ move: { x: 0.1, y: 0 } }) }), ctx)
    expect(camera.position.x).toBe(0)

    scene.state.mode = 'orbit'
    controller.process(frame({ state: 'workspace', motion: motion({ move: { x: 0.1, y: 0 } }) }), ctx)
    expect(camera.position.x).toBeLessThan(0) // hand right → scene turns right → camera moves left
  })
})