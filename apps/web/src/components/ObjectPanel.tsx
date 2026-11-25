import { KEYBOARD_HELP, useSceneStore, type HandMode } from '@aether/three-engine'

function ObjectRow({ id }: { id: string }) {
  const name = useSceneStore((s) => s.objects[id].name)
  const selected = useSceneStore((s) => s.selectedId === id)
  const select = useSceneStore((s) => s.select)
  return (
    <button className={`obj ${selected ? 'on' : ''}`} onClick={() => select(selected ? null : id)}>
      {name}
    </button>
  )
}

function Readout() {
  const o = useSceneStore((s) => (s.selectedId ? s.objects[s.selectedId] : null))
  if (!o) return <div className="muted note">Nothing selected</div>
  return (
    <div className="muted mono note">
      {o.name} · pos {o.position.map((v) => v.toFixed(2)).join(', ')} · scale {o.scale.toFixed(2)}
    </div>
  )
}

export function ObjectPanel() {
  const order = useSceneStore((s) => s.order)
  const selectedId = useSceneStore((s) => s.selectedId)
  const handMode = useSceneStore((s) => s.handMode)
  const setHandMode = useSceneStore((s) => s.setHandMode)
  const resetObject = useSceneStore((s) => s.resetObject)
  const resetAll = useSceneStore((s) => s.resetAll)

  return (
    <aside className="panel">
      <h2>Objects</h2>
      <div className="objlist">
        {order.map((id) => (
          <ObjectRow key={id} id={id} />
        ))}
      </div>
      <Readout />

      <h2>Open-palm mode</h2>
      <select value={handMode} onChange={(e) => setHandMode(e.target.value as HandMode)}>
        <option value="select">Select &amp; grab</option>
        <option value="orbit">Orbit camera</option>
      </select>

      <div className="actions">
        <button disabled={!selectedId} onClick={() => selectedId && resetObject(selectedId)}>
          Reset selected
        </button>
        <button onClick={resetAll}>Reset all</button>
      </div>

      <h2>Keyboard / mouse</h2>
      <div className="help mono">
        {KEYBOARD_HELP.map(([k, d]) => (
          <div key={k}>
            <span>{k}</span>
            <span className="muted">{d}</span>
          </div>
        ))}
        <div>
          <span>Drag object</span>
          <span className="muted">Move</span>
        </div>
        <div>
          <span>Drag space / wheel</span>
          <span className="muted">Orbit / zoom</span>
        </div>
      </div>
    </aside>
  )
}