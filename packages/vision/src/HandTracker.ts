import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'
import { createLogger, type HandFrame, type Handedness, type TrackedHand } from '@aether/shared'
import { LandmarkSmoother } from './LandmarkSmoother'

const log = createLogger('vision')

// Wasm version must match the pinned @mediapipe/tasks-vision version.
// Phase 8 (Electron): download these and serve them locally for offline use.
const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

/** How long to keep showing a hand's last pose after tracking drops. */
const GRACE_MS = 250

/**
 * MediaPipe assumes selfie-mirrored input. Raw webcam frames are not mirrored,
 * so its "Left" is the user's actual right hand. Swap to the user's real hand.
 */
const correctHandedness = (label: string): Handedness => (label === 'Left' ? 'Right' : 'Left')

export class HandTracker {
  private landmarker: HandLandmarker | null = null
  private readonly smoother = new LandmarkSmoother()
  private readonly lastSeen = new Map<Handedness, { hand: TrackedHand; t: number }>()
  private lastTimestamp = -1
  delegate: 'GPU' | 'CPU' | null = null

  async init(): Promise<void> {
    const fileset = await FilesetResolver.forVisionTasks(WASM_URL)
    const create = (delegate: 'GPU' | 'CPU') =>
      HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      })

    try {
      this.landmarker = await create('GPU')
      this.delegate = 'GPU'
    } catch (err) {
      log.warn('GPU delegate failed, falling back to CPU', err)
      this.landmarker = await create('CPU')
      this.delegate = 'CPU'
    }
    log.info(`HandLandmarker ready (${this.delegate})`)
  }

  detect(video: HTMLVideoElement, timestampMs: number): HandFrame {
    if (!this.landmarker) throw new Error('HandTracker not initialized')

    // MediaPipe requires strictly increasing timestamps.
    const ts = timestampMs <= this.lastTimestamp ? this.lastTimestamp + 1 : timestampMs
    this.lastTimestamp = ts

    const started = performance.now()
    const result = this.landmarker.detectForVideo(video, ts)
    const inferenceMs = performance.now() - started

    const hands: TrackedHand[] = []
    const seen = new Set<Handedness>()

    result.landmarks.forEach((landmarks, i) => {
      const category = result.handedness[i]?.[0]
      if (!category) return

      const id = correctHandedness(category.categoryName)
      if (seen.has(id)) return // two hands given the same label: keep the first
      seen.add(id)

      const hand: TrackedHand = {
        id,
        landmarks: this.smoother.smooth(id, landmarks, ts),
        worldLandmarks: (result.worldLandmarks[i] ?? []).map((p) => ({ x: p.x, y: p.y, z: p.z })),
        confidence: category.score,
        stale: false,
      }
      this.lastSeen.set(id, { hand, t: ts })
      hands.push(hand)
    })

    // Hold last known pose briefly so a one-frame dropout doesn't break gestures.
    for (const [id, entry] of this.lastSeen) {
      if (seen.has(id)) continue
      if (ts - entry.t <= GRACE_MS) {
        hands.push({ ...entry.hand, stale: true })
      } else {
        this.lastSeen.delete(id)
        this.smoother.drop(id)
      }
    }

    return { timestamp: ts, hands, inferenceMs }
  }

  reset() {
    this.lastSeen.clear()
    this.smoother.reset()
  }

  dispose() {
    this.landmarker?.close()
    this.landmarker = null
    this.reset()
  }
}