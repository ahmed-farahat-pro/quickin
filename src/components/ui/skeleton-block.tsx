// Boutique shimmer skeletons for route-segment loading.tsx files.
//
// These are pure server-renderable markup (no 'use client') used by the
// per-route loading.tsx skeletons so that, instead of the dark global
// "Loading amazing stays" overlay, each route shows a tasteful placeholder
// in the QuickIn palette that mirrors the real page layout.
//
// The shimmer is a single CSS sweep keyframe in the boutique tan/cream tones.
// Drop <ShimmerStyles /> once near the top of a loading tree; every
// <SkeletonBlock /> below it animates from that one stylesheet.
import type { CSSProperties } from 'react'

const COLORS = {
  burgundy: '#5B0F16',
  cream: '#F6F1E6',
  tan: '#EFE6D8',
  ink: '#2A2220',
  muted: '#6B6055',
}

const FONT = '"DM Sans", ui-sans-serif, system-ui, -apple-system, sans-serif'

// Animation + base name kept unique-ish so it never clashes with page <style> blocks.
const SHIMMER_ANIM = 'qkShimmer'

/**
 * Injects the shimmer keyframes + the base `.qk-skeleton` paint exactly once.
 * Render this once inside each loading.tsx (placing it twice is harmless —
 * duplicate identical keyframes are a no-op).
 */
export function ShimmerStyles() {
  return (
    <style>{`
      @keyframes ${SHIMMER_ANIM} {
        0% { background-position: -480px 0; }
        100% { background-position: 480px 0; }
      }
      .qk-skeleton {
        position: relative;
        background-color: ${COLORS.tan};
        background-image: linear-gradient(
          90deg,
          rgba(239,230,216,0) 0%,
          rgba(255,255,255,0.65) 50%,
          rgba(239,230,216,0) 100%
        );
        background-size: 480px 100%;
        background-repeat: no-repeat;
        animation: ${SHIMMER_ANIM} 1.4s ease-in-out infinite;
      }
      @media (prefers-reduced-motion: reduce) {
        .qk-skeleton { animation: none; }
      }
    `}</style>
  )
}

interface SkeletonBlockProps {
  width?: number | string
  height?: number | string
  radius?: number | string
  style?: CSSProperties
  className?: string
}

/**
 * A single shimmering placeholder rectangle in the boutique palette.
 * Pair with one <ShimmerStyles /> higher in the tree.
 */
export function SkeletonBlock({
  width = '100%',
  height = 16,
  radius = 10,
  style,
  className,
}: SkeletonBlockProps) {
  return (
    <div
      aria-hidden="true"
      className={`qk-skeleton${className ? ` ${className}` : ''}`}
      style={{
        width,
        height,
        borderRadius: radius,
        ...style,
      }}
    />
  )
}

/** A boutique listing-card placeholder: image + title + sub + price lines. */
export function SkeletonCard({ style }: { style?: CSSProperties }) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 22,
        overflow: 'hidden',
        border: '1px solid rgba(42,34,32,0.05)',
        boxShadow: '0 6px 24px rgba(42,34,32,0.08)',
        ...style,
      }}
    >
      <SkeletonBlock height={0} radius={0} style={{ aspectRatio: '4 / 3', height: 'auto' }} />
      <div style={{ padding: '18px 20px 22px' }}>
        <SkeletonBlock width="72%" height={18} />
        <SkeletonBlock width="48%" height={13} style={{ marginTop: 10 }} />
        <SkeletonBlock width="40%" height={15} style={{ marginTop: 18 }} />
      </div>
    </div>
  )
}

/** A horizontal list-row placeholder: thumbnail + two stacked text lines + trailing block. */
export function SkeletonRow({ style }: { style?: CSSProperties }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 18,
        alignItems: 'center',
        background: '#fff',
        borderRadius: 20,
        border: '1px solid rgba(42,34,32,0.06)',
        boxShadow: '0 6px 24px rgba(42,34,32,0.07)',
        padding: 16,
        ...style,
      }}
    >
      <SkeletonBlock width={120} height={96} radius={14} style={{ flex: '0 0 auto' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <SkeletonBlock width="55%" height={18} />
        <SkeletonBlock width="35%" height={13} style={{ marginTop: 10 }} />
        <SkeletonBlock width="45%" height={13} style={{ marginTop: 12 }} />
      </div>
      <SkeletonBlock width={72} height={28} radius={8} style={{ flex: '0 0 auto' }} />
    </div>
  )
}

/** Re-export palette + font so loading.tsx files can match page chrome without duplicating them. */
export const SKELETON_COLORS = COLORS
export const SKELETON_FONT = FONT
