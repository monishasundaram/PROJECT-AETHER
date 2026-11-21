import type { CameraStatus, TrackedHand, TrackerStatus, TrackingStats } from '@aether/shared'

interface Props {
  cameraStatus: CameraStatus
  trackerStatus: TrackerStatus
  stats: TrackingStats
  hands: TrackedHand[]
  error: string | null
  devices: MediaDeviceInfo[]
  deviceId: string | undefined
  onSelectDevice: (id: string) => void
  onStart: () => void
  onStop: () => void
}

const tone = (s: string) =>
  s === 'active' || s === 'tracking' || s === 'ready'
    ? 'ok'
    : s === 'idle'
      ? 'off'
      : s === 'requesting' || s === 'loading-model'
        ? 'warn'
        : 'bad'

function Row({ label, value, status }: { label: string; value: string; status?: string }) {
  return (
    <div className="row">
      <span className="label">{label}</span>
      <span className="value">
        {status && <i className={`dot ${tone(status)}`} />}
        {value}
      </span>
    </div>
  )
}

export function StatusPanel(p: Props) {
  const running = p.cameraStatus === 'active' || p.cameraStatus === 'requesting'

  return (
    <aside className="panel">
      <h2>System</h2>
      <Row label="Camera" value={p.cameraStatus} status={p.cameraStatus} />
      <Row label="Tracker" value={p.trackerStatus} status={p.trackerStatus} />
      <Row label="Delegate" value={p.stats.delegate ?? '—'} />
      <Row label="Tracking FPS" value={p.stats.fps ? p.stats.fps.toFixed(0) : '—'} />
      <Row label="Inference" value={p.stats.inferenceMs ? `${p.stats.inferenceMs.toFixed(1)} ms` : '—'} />

      <h2>Camera</h2>
      <select
        value={p.deviceId ?? ''}
        onChange={(e) => p.onSelectDevice(e.target.value)}
        disabled={p.devices.length === 0}
      >
        {p.devices.length === 0 && <option value="">Default camera</option>}
        {p.devices.map((d, i) => (
          <option key={d.deviceId} value={d.deviceId}>
            {d.label || `Camera ${i + 1}`}
          </option>
        ))}
      </select>
      <div className="actions">
        <button onClick={p.onStart} disabled={running}>
          Start camera
        </button>
        <button onClick={p.onStop} disabled={!running}>
          Stop
        </button>
      </div>

      <h2>Hands</h2>
      {p.hands.length === 0 && <div className="muted">No hands detected</div>}
      {p.hands.map((h) => (
        <Row
          key={h.id}
          label={`${h.id} hand`}
          value={`${(h.confidence * 100).toFixed(0)}%${h.stale ? ' · holding' : ''}`}
          status={h.stale ? 'requesting' : 'active'}
        />
      ))}

      {p.error && <div className="error">{p.error}</div>}
    </aside>
  )
}