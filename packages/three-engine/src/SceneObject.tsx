import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Edges } from '@react-three/drei'
import { Quaternion, Vector3, type Group } from 'three'
import { useSceneStore } from './sceneStore'

const tmpPos = new Vector3()
const tmpQuat = new Quaternion()
const SMOOTHING = 16 // higher = snappier; hides tracking steps without feeling laggy

export function SceneObject({ id }: { id: string }) {
  const group = useRef<Group>(null)
  const init = useMemo(() => useSceneStore.getState().objects[id], [id])
  const kind = useSceneStore((s) => s.objects[id].kind)
  const color = useSceneStore((s) => s.objects[id].color)
  const hovered = useSceneStore((s) => s.hoveredId === id)
  const selected = useSceneStore((s) => s.selectedId === id)
  const grabbed = useSceneStore((s) => s.grabbedId === id)

  // Transforms are read imperatively so 30 Hz tracking updates never re-render React.
  useFrame((_, delta) => {
    const g = group.current
    const o = useSceneStore.getState().objects[id]
    if (!g || !o) return
    const k = 1 - Math.exp(-delta * SMOOTHING)
    g.position.lerp(tmpPos.set(...o.position), k)
    g.quaternion.slerp(tmpQuat.set(...o.quaternion), k)
    g.scale.setScalar(g.scale.x + (o.scale - g.scale.x) * k)
  })

  const emissive = grabbed ? 0.6 : selected ? 0.4 : hovered ? 0.25 : 0.04

  return (
    <group ref={group} userData={{ objectId: id }} position={init.position} quaternion={init.quaternion} scale={init.scale}>
      <mesh>
        {kind === 'box' && <boxGeometry args={[1.1, 1.1, 1.1]} />}
        {kind === 'sphere' && <sphereGeometry args={[0.65, 32, 24]} />}
        {kind === 'torus' && <torusGeometry args={[0.5, 0.2, 16, 48]} />}
        {kind === 'cylinder' && <cylinderGeometry args={[0.5, 0.5, 1.1, 32]} />}
        <meshStandardMaterial color={color} metalness={0.35} roughness={0.45} emissive={color} emissiveIntensity={emissive} />
        {(selected || hovered) && <Edges threshold={20} color={selected ? '#22d3ee' : '#fbbf24'} />}
      </mesh>
    </group>
  )
}