import { Vector3 } from 'three'
import { clampPosition, clampScale, rotateAboutAxis } from './math'
import type { SceneObjectData, TransformPatch } from './types'

const STEP = 0.15
const YAW = 0.12
const SCALE_STEP = 1.1
const UP = new Vector3(0, 1, 0)

export const KEYBOARD_HELP: ReadonlyArray<[string, string]> = [
  ['← → ↑ ↓', 'Move X / Y'],
  ['W / S', 'Move away / toward'],
  ['Q / E', 'Rotate'],
  ['+ / −', 'Scale'],
  ['Tab', 'Select next'],
  ['0', 'Reset selected'],
  ['Home', 'Reset all'],
  ['Esc', 'Deselect'],
]

/** Keyboard fallback: returns the transform change for a key press, or null if the key isn't mapped. */
export function applyKey(key: string, obj: SceneObjectData): TransformPatch | null {
  const [x, y, z] = obj.position
  const move = (dx: number, dy: number, dz: number): TransformPatch => ({
    position: clampPosition([x + dx, y + dy, z + dz]),
  })

  switch (key) {
    case 'ArrowLeft':
      return move(-STEP, 0, 0)
    case 'ArrowRight':
      return move(STEP, 0, 0)
    case 'ArrowUp':
      return move(0, STEP, 0)
    case 'ArrowDown':
      return move(0, -STEP, 0)
    case 'w':
    case 'W':
      return move(0, 0, -STEP)
    case 's':
    case 'S':
      return move(0, 0, STEP)
    case 'q':
    case 'Q':
      return { quaternion: rotateAboutAxis(obj.quaternion, UP, YAW) }
    case 'e':
    case 'E':
      return { quaternion: rotateAboutAxis(obj.quaternion, UP, -YAW) }
    case '+':
    case '=':
      return { scale: clampScale(obj.scale * SCALE_STEP) }
    case '-':
    case '_':
      return { scale: clampScale(obj.scale / SCALE_STEP) }
    default:
      return null
  }
}