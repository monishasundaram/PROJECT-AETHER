import { describe, expect, it } from 'vitest'
import type { HandFrame } from '@aether/shared'
import { GestureEngine } from './engine'
import { FrameRecorder, parseSession, replaySession } from './recording'
import { FRAME_MS } from './testing/driver'
import { makeHand } from './testing/syntheticHand'

function record(poses: Array<'open' | 'pinch'>) {
  const rec = new FrameRecorder()
  rec.start()
  poses.forEach((pose, i) => {
    const frame: HandFrame = {
      timestamp: 1000 + i * FRAME_MS,
      hands: [makeHand({ id: 'Right', pose })],
      inferenceMs: 5,
    }
    rec.push(frame)
  })
  return rec.stop(4 / 3)
}

describe('recording', () => {
  const poses = [...Array(6).fill('open'), ...Array(14).fill('pinch')] as Array<'open' | 'pinch'>

  it('round-trips through JSON and replays to the same result as a live run', () => {
    const session = parseSession(JSON.stringify(record(poses)))

    const live = new GestureEngine({ aspect: 4 / 3 })
    const liveEvents = poses.flatMap((pose, i) =>
      live.update([makeHand({ id: 'Right', pose })], (i + 1) * FRAME_MS).events.map((e) => e.type),
    )
    const replayed = replaySession(session)
    const replayEvents = replayed.flatMap((f) => f.events.map((e) => e.type))

    expect(replayEvents).toEqual(liveEvents)
    expect(replayed[replayed.length - 1].state).toBe('grabbing')
  })

  it('rejects malformed sessions with a clear error', () => {
    expect(() => parseSession('not json')).toThrow(/not valid JSON/)
    expect(() => parseSession(JSON.stringify({ version: 2 }))).toThrow(/malformed/)
  })
})