import { Raycaster, Vector2, type Camera, type Object3D } from 'three'
import type { Ndc } from './math'

const raycaster = new Raycaster()
const v = new Vector2()

/** Returns the id of the first scene object under the NDC point, or null. */
export function pickObject(camera: Camera, root: Object3D, ndc: Ndc): string | null {
  raycaster.setFromCamera(v.set(ndc.x, ndc.y), camera)
  for (const hit of raycaster.intersectObjects(root.children, true)) {
    let o: Object3D | null = hit.object
    while (o) {
      const id: unknown = o.userData.objectId
      if (typeof id === 'string') return id
      o = o.parent
    }
  }
  return null
}