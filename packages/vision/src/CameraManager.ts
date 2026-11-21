import type { CameraStatus } from '@aether/shared'

type CameraFailure = Exclude<CameraStatus, 'idle' | 'requesting' | 'active'>

export class CameraError extends Error {
  constructor(
    public readonly status: CameraFailure,
    message: string,
  ) {
    super(message)
    this.name = 'CameraError'
  }
}

function mapError(err: unknown): CameraError {
  const name = err instanceof DOMException ? err.name : ''
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return new CameraError(
        'denied',
        'Camera permission denied. Allow camera access in the browser address bar or system privacy settings, then retry.',
      )
    case 'NotFoundError':
    case 'OverconstrainedError':
      return new CameraError('not-found', 'No matching camera found. Connect a camera or pick another device.')
    case 'NotReadableError':
    case 'AbortError':
      return new CameraError('in-use', 'Camera is busy or unavailable. Close other apps using it (Teams, Zoom, Camera app) and retry.')
    default:
      return new CameraError('error', err instanceof Error ? err.message : 'Unknown camera error.')
  }
}

export class CameraManager {
  private stream: MediaStream | null = null
  private video: HTMLVideoElement | null = null

  get isActive() {
    return this.stream !== null
  }

  /** Device labels are only populated after camera permission has been granted. */
  async listDevices(): Promise<MediaDeviceInfo[]> {
    const devices = await navigator.mediaDevices.enumerateDevices()
    return devices.filter((d) => d.kind === 'videoinput')
  }

  async start(video: HTMLVideoElement, deviceId?: string): Promise<void> {
    this.stop()

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new CameraError('error', 'Camera API unavailable. Use localhost or https.')
    }

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      })
    } catch (err) {
      throw mapError(err)
    }

    this.stream = stream
    this.video = video
    video.srcObject = stream

    try {
      await video.play()
    } catch (err) {
      this.stop()
      throw mapError(err)
    }
  }

  stop() {
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
    if (this.video) {
      this.video.srcObject = null
      this.video = null
    }
  }
}