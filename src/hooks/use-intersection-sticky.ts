'use client'

import { useEffect, useState, useRef, RefObject } from 'react'

interface UseIntersectionStickyOptions {
  /**
   * Root margin for the intersection observer.
   * Negative values shrink the detection zone, positive expand it.
   * Format: "top right bottom left" (e.g., "-100px 0px 0px 0px")
   */
  rootMargin?: string
  /**
   * Threshold at which the observer callback fires.
   * 0 = any visibility, 1 = fully visible
   */
  threshold?: number
  /**
   * Debounce delay in ms to prevent rapid toggling.
   * Adds hysteresis to the sticky state changes.
   */
  debounceMs?: number
  /**
   * Minimum time in ms between state updates.
   * Prevents rapid flip-flopping loops by locking the state for a duration.
   */
  throttleMs?: number
  /**
   * Initial sticky state before intersection is observed.
   */
  initialState?: boolean
}

/**
 * A hook that uses Intersection Observer to detect sticky state.
 * Returns a ref to attach to a sentinel element and the current sticky state.
 * 
 * Unlike scroll-based detection, this approach:
 * - Doesn't cause layout thrashing
 * - Is more performant (no scroll event spam)
 * - Works reliably across all viewport sizes
 * - Includes hysteresis (debounce) and stability lock (throttle)
 */
export function useIntersectionSticky(
  options: UseIntersectionStickyOptions = {}
): [RefObject<HTMLDivElement | null>, boolean] {
  const {
    rootMargin = '0px 0px 0px 0px',
    threshold = 0,
    debounceMs = 50,
    throttleMs = 0,
    initialState = false,
  } = options

  const sentinelRef = useRef<HTMLDivElement>(null)
  const [isSticky, setIsSticky] = useState(initialState)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastUpdateRef = useRef(0)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry) return
        
        const now = Date.now()

        // THROTTLE LOGIC:
        // If we are within the cooldown period after a state change, ignore this event.
        // This prevents infinite loops caused by layout shifts triggering the observer.
        if (throttleMs > 0 && now - lastUpdateRef.current < throttleMs) {
            return
        }

        // Clear any pending debounce
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }

        // When sentinel is NOT intersecting (scrolled past), we're sticky
        const shouldBeSticky = !entry.isIntersecting

        // Apply debounce to prevent rapid toggling
        if (debounceMs > 0) {
          timeoutRef.current = setTimeout(() => {
            setIsSticky(shouldBeSticky)
            lastUpdateRef.current = Date.now()
          }, debounceMs)
        } else {
          setIsSticky(shouldBeSticky)
          lastUpdateRef.current = Date.now()
        }
      },
      {
        root: null, // viewport
        rootMargin,
        threshold,
      }
    )

    observer.observe(sentinel)

    return () => {
      observer.disconnect()
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [rootMargin, threshold, debounceMs, throttleMs])

  return [sentinelRef, isSticky]
}
