// Route-segment skeleton for /host — mirrors the gradient header, the title +
// "Create a listing" CTA row, the listings grid and the incoming-reservations
// rows (maxWidth 1040).
import {
  ShimmerStyles,
  SkeletonBlock,
  SkeletonCard,
  SkeletonRow,
  SKELETON_COLORS as C,
  SKELETON_FONT as FONT,
} from '@/components/ui/skeleton-block'

export default function Loading() {
  return (
    <div style={{ background: C.cream, color: C.ink, fontFamily: FONT, minHeight: '100vh' }}>
      <ShimmerStyles />
      <style>{`
        @media (max-width: 640px) {
          .qk-skel-host-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

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
            maxWidth: 1040,
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

      <section style={{ maxWidth: 1040, margin: '0 auto', padding: '36px 24px 72px' }}>
        {/* Title row + CTA */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 16,
            marginBottom: 28,
          }}
        >
          <div>
            <SkeletonBlock width={220} height={34} radius={12} />
            <SkeletonBlock width={160} height={15} style={{ marginTop: 12 }} />
          </div>
          <SkeletonBlock width={160} height={44} radius={999} />
        </div>

        {/* Listings grid */}
        <div
          className="qk-skel-host-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 18,
            marginBottom: 44,
          }}
        >
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>

        {/* Incoming reservations */}
        <SkeletonBlock width={260} height={28} radius={10} style={{ marginBottom: 16 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {Array.from({ length: 2 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      </section>
    </div>
  )
}
