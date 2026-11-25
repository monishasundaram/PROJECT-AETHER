import { create } from 'zustand'
import type { HandMode, PrimitiveKind, Quat, SceneApi, SceneObjectData, Vec3 } from './types'

const IDENTITY: Quat = [0, 0, 0, 1]

function make(id: string, name: string, kind: PrimitiveKind, color: string, position: Vec3): SceneObjectData {
  return { id, name, kind, color, position, quaternion: IDENTITY, scale: 1, home: { position, quaternion: IDENTITY, scale: 1 } }
}

// Phase 3 placeholder objects. Phase 4 replaces them with engineering models.
const INITIAL: SceneObjectData[] = [
  make('cube', 'Cube', 'box', '#22d3ee', [-3, 0.6, 0]),
  make('sphere', 'Sphere', 'sphere', '#3b82f6', [-1, 0.7, 0]),
  make('torus', 'Torus', 'torus', '#a78bfa', [1, 0.7, 0]),
  make('cylinder', 'Cylinder', 'cylinder', '#94a3b8', [3, 0.6, 0]),
]

interface SceneState {
  objects: Record<string, SceneObjectData>
  order: string[]
  selectedId: string | null
  hoveredId: string | null
  grabbedId: string | null
  handMode: HandMode
  select: SceneApi['select']
  hover: SceneApi['hover']
  setGrabbed: SceneApi['setGrabbed']
  update: SceneApi['update']
  selectNext: () => void
  resetObject: (id: string) => void
  resetAll: () => void
  setHandMode: (mode: HandMode) => void
}

export const useSceneStore = create<SceneState>()((set) => ({
  objects: Object.fromEntries(INITIAL.map((o) => [o.id, o])),
  order: INITIAL.map((o) => o.id),
  selectedId: null,
  hoveredId: null,
  grabbedId: null,
  handMode: 'select',

  select: (id) => set((s) => (s.selectedId === id ? s : { selectedId: id })),
  hover: (id) => set((s) => (s.hoveredId === id ? s : { hoveredId: id })),
  setGrabbed: (id) => set((s) => (s.grabbedId === id ? s : { grabbedId: id })),

  update: (id, patch) =>
    set((s) => {
      const o = s.objects[id]
      return o ? { objects: { ...s.objects, [id]: { ...o, ...patch } } } : s
    }),

  selectNext: () =>
    set((s) => {
      const i = s.selectedId ? s.order.indexOf(s.selectedId) : -1
      return { selectedId: s.order[(i + 1) % s.order.length] }
    }),

  resetObject: (id) =>
    set((s) => {
      const o = s.objects[id]
      return o ? { objects: { ...s.objects, [id]: { ...o, ...o.home } } } : s
    }),

  resetAll: () =>
    set((s) => ({
      objects: Object.fromEntries(Object.values(s.objects).map((o) => [o.id, { ...o, ...o.home }])),
    })),

  setHandMode: (mode) => set({ handMode: mode }),
}))

/** Non-React access for the interaction controller and DOM input handlers. */
export const sceneApi: SceneApi = {
  getObject: (id) => useSceneStore.getState().objects[id],
  getSelected: () => useSceneStore.getState().selectedId,
  getHandMode: () => useSceneStore.getState().handMode,
  select: (id) => useSceneStore.getState().select(id),
  hover: (id) => useSceneStore.getState().hover(id),
  setGrabbed: (id) => useSceneStore.getState().setGrabbed(id),
  update: (id, patch) => useSceneStore.getState().update(id, patch),
}