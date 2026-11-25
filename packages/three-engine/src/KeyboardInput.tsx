import { useEffect } from 'react'
import { applyKey } from './keys'
import { useSceneStore } from './sceneStore'

const TEXT_TARGETS = new Set(['INPUT', 'SELECT', 'TEXTAREA'])

export function KeyboardInput() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && TEXT_TARGETS.has(e.target.tagName)) return
      if (e.ctrlKey || e.metaKey || e.altKey) return

      const s = useSceneStore.getState()
      switch (e.key) {
        case 'Escape':
          s.select(null)
          return
        case 'Tab':
          e.preventDefault()
          s.selectNext()
          return
        case 'Home':
          s.resetAll()
          return
        case '0':
          if (s.selectedId) s.resetObject(s.selectedId)
          return
      }

      if (!s.selectedId) return
      const patch = applyKey(e.key, s.objects[s.selectedId])
      if (patch) {
        e.preventDefault()
        s.update(s.selectedId, patch)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return null
}