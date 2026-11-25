import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Vector3 } from 'three'
import { InteractionController } from './InteractionController'
import type { GestureBus } from './gestureBus'
import { pickObject } from './picking'
import { sceneApi } from './sceneStore'

export const CAMERA_TARGET = new Vector3(0, 0.6, 0)

/** Drains queued gesture frames each render frame and applies them to the scene. */
export function GestureDriver({ bus }: { bus: GestureBus }) {
  const controller = useMemo(() => new InteractionController(sceneApi), [])

  useFrame(({ camera, scene }) => {
    const frames = bus.drain()
    if (frames.length === 0) return
    const ctx = {
      camera,
      target: CAMERA_TARGET,
      pick: (ndc: { x: number; y: number }) => pickObject(camera, scene, ndc),
    }
    for (const frame of frames) controller.process(frame, ctx)
  })

  return null
}