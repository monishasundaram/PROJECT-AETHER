import { Workspace } from '@aether/three-engine'
import { CameraPreview } from './components/CameraPreview'
import { GesturePanel } from './components/GesturePanel'
import { ObjectPanel } from './components/ObjectPanel'
import { StatusPanel } from './components/StatusPanel'
import { useHandTracking } from './hooks/useHandTracking'
import { gestureBus } from './lib/gestureBus'

export function App() {
  const t = useHandTracking()

  return (
    <div className="app">
      <header>
        <span className="brand">AETHER</span>
        <span className="sub">Workspace · Phase 3</span>
      </header>
      <main>
        <Workspace bus={gestureBus} />
        <div className="side">
          <CameraPreview videoRef={t.videoRef} canvasRef={t.canvasRef} cameraStatus={t.cameraStatus} />
          <StatusPanel
            cameraStatus={t.cameraStatus}
            trackerStatus={t.trackerStatus}
            stats={t.stats}
            hands={t.hands}
            error={t.error}
            devices={t.devices}
            deviceId={t.deviceId}
            onSelectDevice={t.selectDevice}
            onStart={t.start}
            onStop={t.stop}
          />
          <ObjectPanel />
          <GesturePanel
            gesture={t.gesture}
            events={t.events}
            totals={t.totals}
            config={t.config}
            onConfig={t.updateConfig}
            calibration={t.calibration}
            onCalibrate={t.calibratePinch}
            recording={t.recording}
            onToggleRecording={t.toggleRecording}
          />
        </div>
      </main>
    </div>
  )
}