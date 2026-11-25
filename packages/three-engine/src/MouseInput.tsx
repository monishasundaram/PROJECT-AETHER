import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { beginGrab, clampPosition, dragPosition, type GrabSession } from './math'
import { pickObject } from './picking'
import { sceneApi } from './sceneStore'

/**
 * Mouse fallback. Dragging an object moves it in the view plane; dragging empty space
 * orbits (OrbitControls); a click on empty space deselects; the wheel zooms.
 */
export function MouseInput() {
  const gl = useThree((s) => s.gl)
  const get = useThree((s) => s.get)

  useEffect(() => {
    const el = gl.domElement
    let session: GrabSession | null = null
    let emptyDown: { x: number; y: number } | null = null

    const ndcOf = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      return { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -(((e.clientY - r.top) / r.height) * 2 - 1) }
    }

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      const { camera, scene } = get()
      const ndc = ndcOf(e)
      const id = pickObject(camera, scene, ndc)

      if (!id) {
        emptyDown = { x: e.clientX, y: e.clientY }
        return // let OrbitControls orbit
      }
      const obj = sceneApi.getObject(id)
      if (!obj) return
      sceneApi.select(id)
      const s = beginGrab(camera, ndc, obj.position, id)
      if (!s) return
      session = s
      sceneApi.setGrabbed(id)
      el.setPointerCapture(e.pointerId)
      e.stopImmediatePropagation() // keep OrbitControls from also orbiting
    }

    const onMove = (e: PointerEvent) => {
      if (!session) return
      const pos = dragPosition(get().camera, ndcOf(e), session)
      if (pos) sceneApi.update(session.id, { position: clampPosition(pos) })
    }

    const onUp = (e: PointerEvent) => {
      if (session) {
        session = null
        sceneApi.setGrabbed(null)
        return
      }
      if (emptyDown && Math.hypot(e.clientX - emptyDown.x, e.clientY - emptyDown.y) < 4) sceneApi.select(null)
      emptyDown = null
    }

    el.addEventListener('pointerdown', onDown, { capture: true })
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    return () => {
      el.removeEventListener('pointerdown', onDown, { capture: true })
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
    }
  }, [gl, get])

  return null
}