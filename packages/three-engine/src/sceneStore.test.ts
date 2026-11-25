import { beforeEach, describe, expect, it } from 'vitest'
import { useSceneStore } from './sceneStore'

beforeEach(() => {
  const s = useSceneStore.getState()
  s.resetAll()
  s.select(null)
  s.hover(null)
  s.setGrabbed(null)
})

describe('scene store', () => {
  it('updates a transform and resets it to home', () => {
    const s = useSceneStore.getState()
    s.update('cube', { position: [5, 1, 1], scale: 2 })
    expect(useSceneStore.getState().objects.cube.position).toEqual([5, 1, 1])
    s.resetObject('cube')
    const cube = useSceneStore.getState().objects.cube
    expect(cube.position).toEqual(cube.home.position)
    expect(cube.scale).toBe(1)
  })

  it('selectNext cycles through objects in order', () => {
    const s = useSceneStore.getState()
    s.selectNext()
    expect(useSceneStore.getState().selectedId).toBe(s.order[0])
    for (let i = 0; i < s.order.length; i++) useSceneStore.getState().selectNext()
    expect(useSceneStore.getState().selectedId).toBe(s.order[0])
  })

  it('ignores updates to unknown ids', () => {
    const before = useSceneStore.getState().objects
    useSceneStore.getState().update('nope', { scale: 3 })
    expect(useSceneStore.getState().objects).toBe(before)
  })
})