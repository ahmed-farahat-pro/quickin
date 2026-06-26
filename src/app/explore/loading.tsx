// Route-segment skeleton for /explore — mirrors the search hero + results grid
// in explore-client.tsx (maxWidth 1200, cream hero, auto-fill 280px card grid).
import {
  ShimmerStyles,
  SkeletonBlock,
  SkeletonCard,
  SKELETON_COLORS as C,
  SKELETON_FONT as FONT,
} from '@/components/ui/skeleton-block'

export default function Loading() {
  return (
    <div style={{ background: C.cream, color: C.ink, fontFamily: FONT, minHeight: '100vh' }}>
      <ShimmerStyles />
      <style>{`
        @media (max-width: 440px) {
          .qk-skel-explore-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* Hero + search bar */}
      <section style={{ background: C.cream, padding: '36px 24px 8px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <SkeletonBlock width={300} height={36} radius={12} />
          <SkeletonBlock width={460} height={16} style={{ marginTop: 14, maxWidth: '100%' }} />

          {/* Search bar shell */}
          <div
            style={{
              marginTop: 24,
              background: '#fff',
              borderRadius: 22,
              border: '1px solid rgba(42,34,32,0.08)',
              boxShadow: '0 8px 28px rgba(42,34,32,0.08)',
              padding: 18,
              display: 'flex',
              gap: 14,
              flexWrap: 'wrap',
              alignItems: 'flex-end',
            }}
          >
            {[2, 1, 1, 0.8].map((flex, i) => (
              <div key={i} style={{ flex: `${flex} 1 140px`, minWidth: 120 }}>
                <SkeletonBlock width="40%" height={11} radius={6} />
                <SkeletonBlock height={44} radius={14} style={{ marginTop: 6 }} />
              </div>
            ))}
            <SkeletonBlock width={120} height={46} radius={14} style={{ flex: '0 0 auto' }} />
          </div>

          {/* Status row */}
          <div
            style={{
              marginTop: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <SkeletonBlock width={160} height={14} />
            <SkeletonBlock width={140} height={36} radius={999} />
          </div>
        </div>
      </section>

      {/* Results grid */}
      <section
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          width: '100%',
          boxSizing: 'border-box',
          padding: '28px 24px 72px',
        }}
      >
        <div
          className="qk-skel-explore-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 28,
          }}
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </section>
    </div>
  )
}
