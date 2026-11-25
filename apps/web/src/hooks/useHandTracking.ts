import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createLogger,
  type CameraStatus,
  type TrackedHand,
  type TrackerStatus,
  type TrackingStats,
} from '@aether/shared'
import { CameraError, CameraManager, HandTracker } from '@aether/vision'
import {
  FrameRecorder,
  GestureEngine,
  PinchCalibrator,
  type GestureConfig,
  type GestureEvent,
  type GestureFrame,
  type InteractionState,
} from '@aether/gestures'
import { downloadJson } from '../lib/download'
import { drawHands } from '../lib/drawHands'
import { gestureBus } from '../lib/gestureBus'

const log = createLogger('tracking')
const UI_UPDATE_MS = 200

/** Cumulative motion since the current interaction state began (debug aid). */
export interface GestureTotals {
  x: number
  y: number
  rotate: number
  zoom: number
  depth: number
}
const ZERO_TOTALS: GestureTotals = { x: 0, y: 0, rotate: 0, zoom: 0, depth: 0 }

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function useHandTracking() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cameraRef = useRef<CameraManager | null>(null)
  const trackerRef = useRef<HandTracker | null>(null)
  const loopRef = useRef<{ stop: () => void } | null>(null)
  const startId = useRef(0)

  const [engine] = useState(() => new GestureEngine())
  const [recorder] = useState(() => new FrameRecorder())
  const [calibrator] = useState(() => new PinchCalibrator())
  const calibPhase = useRef<'open' | 'pinched' | null>(null)
  const pendingEvents = useRef<GestureEvent[]>([])

  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('idle')
  const [trackerStatus, setTrackerStatus] = useState<TrackerStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceId, setDeviceId] = useState<string | undefined>()
  const [stats, setStats] = useState<TrackingStats>({ fps: 0, inferenceMs: 0, delegate: null })
  const [hands, setHands] = useState<TrackedHand[]>([])

  const [gesture, setGesture] = useState<GestureFrame | null>(null)
  const [events, setEvents] = useState<GestureEvent[]>([])
  const [totals, setTotals] = useState<GestureTotals>(ZERO_TOTALS)
  const [config, setConfigState] = useState<GestureConfig>(engine.config)
  const [calibration, setCalibration] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)

  const runLoop = (video: HTMLVideoElement, tracker: HandTracker) => {
    let active = true
    let handle = 0
    let frames = 0
    let windowStart = performance.now()
    let lastUi = 0
    let fps = 0
    let lastState: InteractionState = 'idle'
    const runningTotals: GestureTotals = { ...ZERO_TOTALS }
    const useRvfc = typeof video.requestVideoFrameCallback === 'function'

    if (video.videoWidth > 0) engine.setConfig({ aspect: video.videoWidth / video.videoHeight })

    const tick = () => {
      if (!active) return

      if (video.readyState >= 2 && video.videoWidth > 0) {
        const now = performance.now()
        try {
          const frame = tracker.detect(video, now)
          const g = engine.update(frame.hands, frame.timestamp)
                    gestureBus.publish(g)

          if (recorder.isRecording) recorder.push(frame)

          const primaryHand = g.primary ? g.hands[g.primary] : undefined
          if (calibPhase.current && primaryHand) calibrator.add(calibPhase.current, primaryHand.pinchRatio)

          if (g.state !== lastState) {
            lastState = g.state
            Object.assign(runningTotals, ZERO_TOTALS)
          }
          runningTotals.x += g.motion.move.x
          runningTotals.y += g.motion.move.y
          runningTotals.rotate += g.motion.rotate
          runningTotals.zoom += g.motion.zoom
          runningTotals.depth += g.motion.depth
          if (g.events.length) pendingEvents.current.push(...g.events)

          const canvas = canvasRef.current
          const ctx = canvas?.getContext('2d')
          if (canvas && ctx) {
            if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth
            if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight
            drawHands(ctx, frame.hands, canvas.width, canvas.height, { cursor: g.cursor, state: g.state })
          }

          frames++
          if (now - windowStart >= 1000) {
            fps = (frames * 1000) / (now - windowStart)
            frames = 0
            windowStart = now
          }
          if (now - lastUi >= UI_UPDATE_MS || g.events.length > 0) {
            lastUi = now
            setHands(frame.hands)
            setStats({ fps, inferenceMs: frame.inferenceMs, delegate: tracker.delegate })
            setGesture(g)
            setTotals({ ...runningTotals })
            if (pendingEvents.current.length) {
              const flushed = pendingEvents.current.splice(0).reverse()
              setEvents((prev) => [...flushed, ...prev].slice(0, 10))
            }
          }
        } catch (err) {
          log.error('Tracking loop failed', err)
          setError(err instanceof Error ? err.message : String(err))
          setTrackerStatus('error')
          active = false
          return
        }
      }
      schedule()
    }

    const schedule = () => {
      handle = useRvfc ? video.requestVideoFrameCallback(tick) : requestAnimationFrame(tick)
    }

    schedule()

    return {
      stop() {
        active = false
        if (useRvfc) video.cancelVideoFrameCallback(handle)
        else cancelAnimationFrame(handle)
      },
    }
  }

  const stop = useCallback(() => {
    startId.current++
    loopRef.current?.stop()
    loopRef.current = null
    cameraRef.current?.stop()
    trackerRef.current?.reset()
    // Emit end events (grab_end etc.) so the 3D scene doesn't keep a stuck grab.
    gestureBus.publish(engine.update([], performance.now()))
    engine.reset()
    calibPhase.current = null
    pendingEvents.current = []

    const canvas = canvasRef.current
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)

    setCameraStatus('idle')
    setTrackerStatus(trackerRef.current ? 'ready' : 'idle')
    setHands([])
    setGesture(null)
    setTotals(ZERO_TOTALS)
    setStats((s) => ({ ...s, fps: 0, inferenceMs: 0 }))
  }, [engine])

  const start = useCallback(
    async (requestedDeviceId?: string) => {
      const video = videoRef.current
      if (!video) return

      const id = ++startId.current
      loopRef.current?.stop()
      loopRef.current = null
      setError(null)
      setCameraStatus('requesting')

      const camera = (cameraRef.current ??= new CameraManager())

      try {
        await camera.start(video, requestedDeviceId ?? deviceId)
      } catch (err) {
        if (id !== startId.current) return
        log.error('Camera start failed', err)
        setCameraStatus(err instanceof CameraError ? err.status : 'error')
        setError(err instanceof Error ? err.message : String(err))
        return
      }
      if (id !== startId.current) return

      setCameraStatus('active')
      camera.listDevices().then(setDevices).catch((e) => log.warn('listDevices failed', e))

      try {
        if (!trackerRef.current) {
          setTrackerStatus('loading-model')
          const tracker = new HandTracker()
          await tracker.init()
          if (id !== startId.current) {
            tracker.dispose()
            return
          }
          trackerRef.current = tracker
        }
        setTrackerStatus('tracking')
        loopRef.current = runLoop(video, trackerRef.current)
      } catch (err) {
        if (id !== startId.current) return
        log.error('Tracker init failed', err)
        camera.stop()
        setCameraStatus('idle')
        setTrackerStatus('error')
        setError(`Hand tracking failed to start: ${err instanceof Error ? err.message : String(err)}`)
      }
    },
    // runLoop only uses stable refs, setters and the engine/recorder/calibrator singletons.
    [deviceId],
  )

  const selectDevice = useCallback(
    (id: string) => {
      setDeviceId(id)
      if (cameraStatus === 'active') void start(id)
    },
    [cameraStatus, start],
  )

  const updateConfig = useCallback(
    (patch: Partial<GestureConfig>) => {
      engine.setConfig(patch)
      setConfigState(engine.config)
    },
    [engine],
  )

  const calibratePinch = useCallback(async () => {
    if (cameraStatus !== 'active' || trackerStatus !== 'tracking') {
      setCalibration('Start the camera first.')
      return
    }
    calibrator.reset()
    setCalibration('Hold your hand OPEN and still…')
    await wait(1000)
    calibPhase.current = 'open'
    await wait(2000)
    calibPhase.current = null

    setCalibration('Now PINCH thumb and index, and hold…')
    await wait(1000)
    calibPhase.current = 'pinched'
    await wait(2000)
    calibPhase.current = null

    const result = calibrator.result()
    if (!result) {
      setCalibration('Calibration failed: hand not tracked, or open and pinched looked too similar. Try again.')
      return
    }
    updateConfig(result)
    setCalibration(`Calibrated: enter ${result.pinchEnter}, exit ${result.pinchExit}`)
  }, [cameraStatus, trackerStatus, calibrator, updateConfig])

  const toggleRecording = useCallback(() => {
    if (recorder.isRecording) {
      const session = recorder.stop(engine.config.aspect)
      setRecording(false)
      if (session.frames.length > 0) {
        downloadJson(`aether-session-${new Date().toISOString().replace(/[:.]/g, '-')}.json`, session)
      }
    } else {
      recorder.start()
      setRecording(true)
    }
  }, [recorder, engine])

  useEffect(
    () => () => {
      gestureBus.clear()
      startId.current++
      loopRef.current?.stop()
      cameraRef.current?.stop()
      trackerRef.current?.dispose()
      trackerRef.current = null
    },
    [],
  )

  return {
    videoRef,
    canvasRef,
    cameraStatus,
    trackerStatus,
    error,
    devices,
    deviceId,
    stats,
    hands,
    start: () => start(),
    stop,
    selectDevice,
    gesture,
    events,
    totals,
    config,
    updateConfig,
    calibration,
    calibratePinch,
    recording,
    toggleRecording,
  }
}