import type { RefObject } from 'react'
import type { CameraStatus } from '@aether/shared'

interface Props {
  videoRef: RefObject<HTMLVideoElement>
  canvasRef: RefObject<HTMLCanvasElement>
  cameraStatus: CameraStatus
}

const MESSAGES: Record<CameraStatus, string> = {
  idle: 'Camera off',
  requesting: 'Requesting camera access…',
  active: '',
  denied: 'Camera access denied',
  'not-found': 'No camera found',
  'in-use': 'Camera unavailable',
  error: 'Camera error',
}

export function CameraPreview({ videoRef, canvasRef, cameraStatus }: Props) {
  return (
    <div className="preview">
      {/* Mirrored for natural interaction; overlay mirrors with it so landmarks align. */}
      <video ref={videoRef} className="mirror" muted playsInline />
      <canvas ref={canvasRef} className="mirror overlay" />
      {cameraStatus !== 'active' && <div className="placeholder">{MESSAGES[cameraStatus]}</div>}
    </div>
  )
}