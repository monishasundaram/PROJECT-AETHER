import { Canvas } from '@react-three/fiber'
import { Grid, OrbitControls } from '@react-three/drei'
import { GestureDriver } from './GestureDriver'
import type { GestureBus } from './gestureBus'
import { HandCursor } from './HandCursor'
import { KeyboardInput } from './KeyboardInput'
import { MouseInput } from './MouseInput'
import { SceneObject } from './SceneObject'
import { useSceneStore } from './sceneStore'

const TARGET: [number, number, number] = [0, 0.6, 0]

function Contents({ bus }: { bus: GestureBus }) {
  const order = useSceneStore((s) => s.order)

  return (
    <>
      <color attach="background" args={['#07080a']} />
      <fog attach="fog" args={['#07080a', 14, 32]} />

      <ambientLight intensity={0.45} />
      <directionalLight position={[5, 8, 5]} intensity={1.4} />
      <directionalLight position={[-6, 3, -4]} intensity={0.35} color="#22d3ee" />

      <Grid
        args={[40, 40]}
        cellSize={0.5}
        cellThickness={0.6}
        cellColor="#134e5e"
        sectionSize={2.5}
        sectionThickness={1}
        sectionColor="#0e7490"
        fadeDistance={26}
        fadeStrength={1.5}
        infiniteGrid
      />

      {order.map((id) => (
        <SceneObject key={id} id={id} />
      ))}

      <OrbitControls
        makeDefault
        target={TARGET}
        enablePan={false}
        enableDamping
        dampingFactor={0.12}
        minDistance={2.5}
        maxDistance={18}
        maxPolarAngle={Math.PI * 0.49}
      />
      <GestureDriver bus={bus} />
      <MouseInput />
    </>
  )
}

export function Workspace({ bus }: { bus: GestureBus }) {
  return (
    <div className="workspace">
      <Canvas
        camera={{ position: [0, 3, 8], fov: 50, near: 0.1, far: 100 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <Contents bus={bus} />
      </Canvas>
      <HandCursor bus={bus} />
      <KeyboardInput />
    </div>
  )
}