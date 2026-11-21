export interface Landmark {
  x: number
  y: number
  z: number
}

/** The user's actual hand (already corrected for the webcam mirror issue). */
export type Handedness = 'Left' | 'Right'

export interface TrackedHand {
  id: Handedness
  /** 21 normalized landmarks (x,y in 0..1 of the camera frame), smoothed. */
  landmarks: Landmark[]
  /** 21 landmarks in metric-ish world space (meters, origin at hand center). Unsmoothed. */
  worldLandmarks: Landmark[]
  confidence: number
  /** True when the hand was lost this frame and we're holding the last known pose. */
  stale: boolean
}

export interface HandFrame {
  timestamp: number
  hands: TrackedHand[]
  inferenceMs: number
}

export type CameraStatus =
  | 'idle'
  | 'requesting'
  | 'active'
  | 'denied'
  | 'not-found'
  | 'in-use'
  | 'error'

export type TrackerStatus = 'idle' | 'loading-model' | 'ready' | 'tracking' | 'error'

export interface TrackingStats {
  fps: number
  inferenceMs: number
  delegate: 'GPU' | 'CPU' | null
}