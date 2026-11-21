import type { Landmark } from '@aether/shared'
import { DEFAULT_ONE_EURO, OneEuroFilter, type OneEuroConfig } from './OneEuroFilter'

const LANDMARK_COUNT = 21

/** Smooths 21 landmarks (x, y, z each) per tracked hand key. */
export class LandmarkSmoother {
  private readonly banks = new Map<string, OneEuroFilter[]>()

  constructor(private config: OneEuroConfig = DEFAULT_ONE_EURO) {}

  setConfig(config: OneEuroConfig) {
    this.config = config
    this.banks.clear()
  }

  smooth(key: string, landmarks: Landmark[], timestampMs: number): Landmark[] {
    let bank = this.banks.get(key)
    if (!bank) {
      bank = Array.from({ length: LANDMARK_COUNT * 3 }, () => new OneEuroFilter(this.config))
      this.banks.set(key, bank)
    }
    const filters = bank
    return landmarks.map((lm, i) => ({
      x: filters[i * 3].filter(lm.x, timestampMs),
      y: filters[i * 3 + 1].filter(lm.y, timestampMs),
      z: filters[i * 3 + 2].filter(lm.z, timestampMs),
    }))
  }

  drop(key: string) {
    this.banks.delete(key)
  }

  reset() {
    this.banks.clear()
  }
}