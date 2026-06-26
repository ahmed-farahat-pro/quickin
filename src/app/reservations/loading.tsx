// Route-segment skeleton for /reservations — mirrors the gradient header, title
// and the stacked reservation list rows (maxWidth 980).
import {
  ShimmerStyles,
  SkeletonBlock,
  SkeletonRow,
  SKELETON_COLORS as C,
  SKELETON_FONT as FONT,
} from '@/components/ui/skeleton-block'

export default function Loading() {
  return (
    <div style={{ background: C.cream, color: C.ink, fontFamily: FONT, minHeight: '100vh' }}>
      <ShimmerStyles />

      {/* Header */}
      <header
        style={{
          background: `linear-gradient(180deg, ${C.tan} 0%, ${C.cream} 100%)`,
          borderBottom: '1px solid rgba(91,15,22,0.10)',
          padding: '20px 24px',
        }}
      >
        <div
          style={{
            maxWidth: 980,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <SkeletonBlock width={96} height={40} radius={8} />
          <SkeletonBlock width={120} height={16} />
        </div>
      </header>

      <section style={{ maxWidth: 980, margin: '0 auto', padding: '36px 24px 72px' }}>
        <SkeletonBlock width={260} height={34} radius={12} />
        <SkeletonBlock width={160} height={15} style={{ marginTop: 12, marginBottom: 28 }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      </section>
    </div>
  )
}
