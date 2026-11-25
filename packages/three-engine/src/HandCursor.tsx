import { useEffect, useRef } from 'react'
import { mapCursor } from './math'
import type { GestureBus } from './gestureBus'

/** DOM cursor driven imperatively from the latest gesture frame (no React renders per frame). */
export function HandCursor({ bus }: { bus: GestureBus }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const el = ref.current
      const f = bus.latest
      if (el) {
        if (f?.cursor) {
          const p = mapCursor(f.cursor)
          el.style.opacity = '1'
          el.style.left = `${p.x * 100}%`
          el.style.top = `${p.y * 100}%`
          el.dataset.state = f.state
        } else {
          el.style.opacity = '0'
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [bus])

  return <div ref={ref} className="hand-cursor" data-state="idle" />
}