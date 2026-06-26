// Route-segment skeleton for /verify-id — mirrors the heading, subtitle and the
// ID upload panel (centered max-w-lg column on the cream background).
import {
  ShimmerStyles,
  SkeletonBlock,
  SKELETON_COLORS as C,
  SKELETON_FONT as FONT,
} from '@/components/ui/skeleton-block'

export default function Loading() {
  return (
    <div
      style={{
        background: C.cream,
        color: C.ink,
        fontFamily: FONT,
        minHeight: '100vh',
        padding: '40px 16px',
      }}
    >
      <ShimmerStyles />

      <div style={{ maxWidth: 512, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Heading + subtitle */}
        <div>
          <SkeletonBlock width="55%" height={28} radius={10} />
          <SkeletonBlock width="80%" height={14} style={{ marginTop: 10 }} />
        </div>

        {/* Upload panel */}
        <div
          style={{
            background: '#fff',
            borderRadius: 22,
            border: '1px solid rgba(42,34,32,0.06)',
            boxShadow: '0 6px 24px rgba(42,34,32,0.06)',
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          <SkeletonBlock width="40%" height={16} />
          {/* Dashed-style upload dropzone */}
          <SkeletonBlock height={170} radius={18} />
          <SkeletonBlock width="60%" height={13} />
          <SkeletonBlock height={50} radius={999} style={{ marginTop: 4 }} />
        </div>
      </div>
    </div>
  )
}
