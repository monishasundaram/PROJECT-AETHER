export type Vec3 = [number, number, number]
export type Quat = [number, number, number, number]
export type PrimitiveKind = 'box' | 'sphere' | 'torus' | 'cylinder'
export type HandMode = 'select' | 'orbit'

export interface SceneObjectData {
  id: string
  name: string
  kind: PrimitiveKind
  color: string
  position: Vec3
  /** Unit quaternion [x, y, z, w]. */
  quaternion: Quat
  /** Uniform scale. */
  scale: number
  /** Transform restored by reset. */
  home: { position: Vec3; quaternion: Quat; scale: number }
}

export type TransformPatch = Partial<Pick<SceneObjectData, 'position' | 'quaternion' | 'scale'>>

/** The slice of the scene the interaction controller needs. Implemented by the Zustand store. */
export interface SceneApi {
  getObject(id: string): SceneObjectData | undefined
  getSelected(): string | null
  getHandMode(): HandMode
  select(id: string | null): void
  hover(id: string | null): void
  setGrabbed(id: string | null): void
  update(id: string, patch: TransformPatch): void
}