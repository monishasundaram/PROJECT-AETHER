import { describe, expect, it } from 'vitest'
import { applyKey } from './keys'
import type { SceneObjectData } from './types'

const obj = (over: Partial<SceneObjectData> = {}): SceneObjectData => ({
  id: 'a',
  name: 'A',
  kind: 'box',
  color: '#fff',
  position: [0, 0, 0],
  quaternion: [0, 0, 0, 1],
  scale: 1,
  home: { position: [0, 0, 0], quaternion: [0, 0, 0, 1], scale: 1 },
  ...over,
})

describe('applyKey', () => {
  it('arrow keys move in the expected directions', () => {
    expect(applyKey('ArrowRight', obj())!.position![0]).toBeGreaterThan(0)
    expect(applyKey('ArrowLeft', obj())!.position![0]).toBeLessThan(0)
    expect(applyKey('ArrowUp', obj())!.position![1]).toBeGreaterThan(0)
    expect(applyKey('w', obj())!.position![2]).toBeLessThan(0)
    expect(applyKey('s', obj())!.position![2]).toBeGreaterThan(0)
  })

  it('q and e rotate in opposite directions', () => {
    expect(applyKey('q', obj())!.quaternion![1]).toBeGreaterThan(0)
    expect(applyKey('e', obj())!.quaternion![1]).toBeLessThan(0)
  })

  it('+ and - scale, clamped', () => {
    expect(applyKey('+', obj())!.scale).toBeCloseTo(1.1, 6)
    expect(applyKey('-', obj())!.scale).toBeCloseTo(1 / 1.1, 6)
    expect(applyKey('+', obj({ scale: 4 }))!.scale).toBe(4)
  })

  it('keeps positions inside the workspace bounds', () => {
    expect(applyKey('ArrowRight', obj({ position: [8, 0, 0] }))!.position![0]).toBe(8)
  })

  it('returns null for unmapped keys', () => {
    expect(applyKey('x', obj())).toBeNull()
  })
})