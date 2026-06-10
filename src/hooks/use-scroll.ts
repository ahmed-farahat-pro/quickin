import { useEffect, useRef } from 'react'

/**
 * A hook that executes a callback on window scroll events, throttled using requestAnimationFrame.
 * This ensures the callback runs at most once per animation frame (typically 60fps),
 * preventing main thread blocking during rapid scrolling.
 *
 * @param callback The function to execute on scroll. Ideally, this function should be stable or wrapped in useCallback.
 * @param runOnMount Whether to run the callback immediately on mount. Defaults to true.
 */
export function useScroll(callback: () => void, runOnMount = true) {
  const callbackRef = useRef(callback)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    let ticking = false
    let animationFrameId: number | null = null

    const handleScroll = () => {
      if (!ticking) {
        animationFrameId = window.requestAnimationFrame(() => {
          if (callbackRef.current) {
            callbackRef.current()
          }
          ticking = false
        })
        ticking = true
      }
    }

    // Passive listener improves scrolling performance
    window.addEventListener('scroll', handleScroll, { passive: true })

    if (runOnMount && callbackRef.current) {
      // Run immediately without throttling for initial state
      callbackRef.current()
    }

    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId)
      }
    }
  }, [runOnMount])
}
