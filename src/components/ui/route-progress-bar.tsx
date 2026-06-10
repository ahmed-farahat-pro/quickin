'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { usePathname } from 'next/navigation'

export function RouteProgressBar() {
  const pathname = usePathname()
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isRunningRef = useRef(false)
  const prevPathRef = useRef(pathname)

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = null
    }
  }, [])

  const start = useCallback(() => {
    cleanup()
    isRunningRef.current = true
    setProgress(0)
    setVisible(true)

    let current = 0
    timerRef.current = setInterval(() => {
      current += Math.random() * 12 + 3
      if (current > 90) current = 90
      setProgress(current)
    }, 250)
  }, [cleanup])

  const complete = useCallback(() => {
    cleanup()
    isRunningRef.current = false
    setProgress(100)
    hideTimeoutRef.current = setTimeout(() => {
      setVisible(false)
      setProgress(0)
    }, 300)
  }, [cleanup])

  // Complete progress when pathname changes (navigation finished)
  useEffect(() => {
    if (pathname !== prevPathRef.current) {
      prevPathRef.current = pathname
      if (isRunningRef.current) {
        complete()
      }
    }
  }, [pathname, complete])

  // Track pointer movement to distinguish clicks from drag/swipe gestures
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null)
  const isDragRef = useRef(false)

  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      pointerDownPos.current = { x: e.clientX, y: e.clientY }
      isDragRef.current = false
    }

    const handlePointerMove = (e: PointerEvent) => {
      if (!pointerDownPos.current) return
      const dx = Math.abs(e.clientX - pointerDownPos.current.x)
      const dy = Math.abs(e.clientY - pointerDownPos.current.y)
      // If pointer moved more than 5px, it's a drag/swipe, not a click
      if (dx > 5 || dy > 5) {
        isDragRef.current = true
      }
    }

    const handlePointerUp = () => {
      pointerDownPos.current = null
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('pointermove', handlePointerMove, true)
    document.addEventListener('pointerup', handlePointerUp, true)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('pointermove', handlePointerMove, true)
      document.removeEventListener('pointerup', handlePointerUp, true)
    }
  }, [])

  // Listen for link clicks to detect navigation start
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // Skip drag/swipe gestures (e.g. carousel swipe inside a Link)
      if (isDragRef.current) return

      if (e.defaultPrevented) return

      const target = e.target as HTMLElement
      const anchor = target.closest('a')
      if (!anchor) return

      // Skip if click originated from inside an interactive element within the link
      // (carousel buttons, favorite buttons, etc.)
      if (target.closest('button, [role="button"]')) return

      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto:')) return
      if (anchor.getAttribute('target') === '_blank') return

      // Only start if navigating to a different path
      const url = new URL(href, window.location.origin)
      if (url.pathname !== prevPathRef.current) {
        start()
      }
    }

    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [start])

  // Cleanup on unmount
  useEffect(() => cleanup, [cleanup])

  if (!visible) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] h-0.5 overflow-hidden">
      <div
        className="h-full bg-primary transition-all duration-300 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}
