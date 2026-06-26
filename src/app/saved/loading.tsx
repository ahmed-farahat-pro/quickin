// Route-segment skeleton for /saved — mirrors the gradient header, title and
// the 3→2→1 column grid of saved-stay cards (maxWidth 1100).
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
        .qk-skel-saved-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 22px;
        }
        @media (max-width: 820px) {
          .qk-skel-saved-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 520px) {
          .qk-skel-saved-grid { grid-template-columns: 1fr !important; }
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
            maxWidth: 1100,
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

      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '36px 24px 72px' }}>
        <SkeletonBlock width={220} height={34} radius={12} />
        <SkeletonBlock width={180} height={15} style={{ marginTop: 12, marginBottom: 28 }} />

        <div className="qk-skel-saved-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </section>
    </div>
  )
}
