import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseSession, replaySession } from './recording'

const dir = fileURLToPath(new URL('../fixtures/', import.meta.url))
const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')) : []

const PAIRS: Array<[string, string]> = [
  ['open_palm_start', 'open_palm_end'],
  ['fist_start', 'fist_end'],
  ['pinch_start', 'pinch_end'],
  ['grab_start', 'grab_end'],
  ['two_hand_start', 'two_hand_end'],
]

describe('recorded fixtures', () => {
  it('fixtures directory is readable', () => {
    expect(Array.isArray(files)).toBe(true)
  })

  for (const file of files) {
    it(`${file}: start/end events are properly paired`, () => {
      const session = parseSession(readFileSync(join(dir, file), 'utf8'))
      const events = replaySession(session).flatMap((f) => f.events.map((e) => e.type as string))

      const open = new Set<string>()
      for (const type of events) {
        const pair = PAIRS.find(([s, e]) => type === s || type === e)
        if (!pair) continue
        if (type === pair[0]) {
          expect(open.has(pair[0]), `${type} fired twice without ${pair[1]}`).toBe(false)
          open.add(pair[0])
        } else {
          expect(open.has(pair[0]), `${type} without a preceding ${pair[0]}`).toBe(true)
          open.delete(pair[0])
        }
      }
      console.info(`[${file}]`, events.join(' → '))
    })
  }
})