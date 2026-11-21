import { useState } from 'react'
import type { GestureConfig, GestureEvent, GestureFrame } from '@aether/gestures'
import type { GestureTotals } from '../hooks/useHandTracking'

interface Props {
  gesture: GestureFrame | null
  events: GestureEvent[]
  totals: GestureTotals
  config: GestureConfig
  onConfig: (patch: Partial<GestureConfig>) => void
  calibration: string | null
  onCalibrate: () => void
  recording: boolean
  onToggleRecording: () => void
}

const RANGE_MAX = 1.2 // pinch meter full scale

export function GesturePanel(p: Props) {
  const [debug, setDebug] = useState(false)
  const g = p.gesture
  const enter = (p.config.pinchEnter * p.config.sensitivity) / RANGE_MAX
  const exit = (p.config.pinchExit * p.config.sensitivity) / RANGE_MAX

  return (
    <aside className="panel">
      <h2>Gesture</h2>
      <div className={`state state-${g?.state ?? 'idle'}`}>{(g?.state ?? 'idle').replace('_', ' ')}</div>

      {(['Left', 'Right'] as const).map((id) => {
        const h = g?.hands[id]
        if (!h) return null
        return (
          <div key={id} className="hand-block">
            <div className="row">
              <span className="label">
                {id}
                {g?.primary === id ? ' ★' : ''}
              </span>
              <span className="value">
                {h.stable}
                {h.raw !== h.stable && <span className="muted"> ({h.raw})</span>}
              </span>
            </div>
            {debug && (
              <>
                <div className="meter">
                  <div className="fill" style={{ width: `${Math.min(h.pinchRatio / RANGE_MAX, 1) * 100}%` }} />
                  <i className="mark" style={{ left: `${enter * 100}%` }} />
                  <i className="mark" style={{ left: `${exit * 100}%` }} />
                </div>
                <div className="muted mono">
                  pinch {h.pinchRatio.toFixed(2)} · ext {h.extension.map((v) => v.toFixed(2)).join(' ')}
                </div>
              </>
            )}
          </div>
        )
      })}
      {!g?.primary && <div className="muted">No hands</div>}

      {debug && (
        <div className="muted mono totals">
          Σ move {p.totals.x.toFixed(2)}, {p.totals.y.toFixed(2)} · rot {((p.totals.rotate * 180) / Math.PI).toFixed(0)}° ·
          zoom ×{Math.exp(p.totals.zoom).toFixed(2)} · depth {p.totals.depth.toFixed(2)}
        </div>
      )}

      <h2>Events</h2>
      <div className="events mono">
        {p.events.length === 0 && <span className="muted">none yet</span>}
        {p.events.map((e, i) => (
          <div key={`${e.t}-${e.type}-${i}`}>{e.type}</div>
        ))}
      </div>

      <h2>Settings</h2>
      <label className="field">
        <span>Pinch sensitivity {p.config.sensitivity.toFixed(2)}</span>
        <input
          type="range"
          min={0.5}
          max={1.5}
          step={0.05}
          value={p.config.sensitivity}
          onChange={(e) => p.onConfig({ sensitivity: Number(e.target.value) })}
        />
      </label>
      <label className="field">
        <span>Dominant hand</span>
        <select value={p.config.dominantHand} onChange={(e) => p.onConfig({ dominantHand: e.target.value as 'Left' | 'Right' })}>
          <option value="Right">Right</option>
          <option value="Left">Left</option>
        </select>
      </label>

      <div className="actions">
        <button onClick={p.onCalibrate}>Calibrate pinch</button>
        <button onClick={() => setDebug((d) => !d)}>{debug ? 'Hide debug' : 'Debug'}</button>
      </div>
      <div className="actions">
        <button onClick={p.onToggleRecording}>{p.recording ? '■ Stop & save' : '● Record session'}</button>
      </div>
      {p.calibration && <div className="muted note">{p.calibration}</div>}
    </aside>
  )
}