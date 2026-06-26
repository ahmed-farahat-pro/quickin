// Route-segment skeleton for /explore/[id] — mirrors the stay-detail layout:
// back link, 16/9 hero, thumbnail strip, title + specs, and the two-column
// details / sticky reserve panel (maxWidth 1040).
import {
  ShimmerStyles,
  SkeletonBlock,
  SKELETON_COLORS as C,
  SKELETON_FONT as FONT,
} from '@/components/ui/skeleton-block'

export default function Loading() {
  return (
    <div style={{ background: C.cream, color: C.ink, fontFamily: FONT, minHeight: '100vh' }}>
      <ShimmerStyles />
      <style>{`
        @media (max-width: 760px) {
          .qk-skel-detail-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div style={{ maxWidth: 1040, margin: '0 auto', padding: '28px 24px 72px' }}>
        {/* Back link */}
        <SkeletonBlock width={120} height={16} style={{ marginBottom: 22 }} />

        {/* Hero */}
        <SkeletonBlock
          height={0}
          radius={24}
          style={{ aspectRatio: '16 / 9', height: 'auto' }}
        />

        {/* Thumbnail strip */}
        <div style={{ display: 'flex', gap: 12, padding: '16px 2px 4px' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonBlock
              key={i}
              width={132}
              height={96}
              radius={14}
              style={{ flex: '0 0 auto' }}
            />
          ))}
        </div>

        {/* Title + location */}
        <div style={{ marginTop: 34 }}>
          <SkeletonBlock width="60%" height={40} radius={12} />
          <SkeletonBlock width={260} height={16} style={{ marginTop: 14 }} />
        </div>

        {/* Two-column: details + reserve panel */}
        <div
          className="qk-skel-detail-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(260px, 320px)',
            gap: 36,
            marginTop: 30,
            alignItems: 'start',
          }}
        >
          <div>
            {/* Specs row */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 28,
                padding: '20px 0 24px',
                borderTop: '1px solid rgba(42,34,32,0.10)',
                borderBottom: '1px solid rgba(42,34,32,0.10)',
              }}
            >
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ minWidth: 84 }}>
                  <SkeletonBlock width={40} height={22} />
                  <SkeletonBlock width={64} height={13} style={{ marginTop: 6 }} />
                </div>
              ))}
            </div>

            {/* Description */}
            <div style={{ marginTop: 26 }}>
              <SkeletonBlock width={200} height={20} />
              <SkeletonBlock height={14} style={{ marginTop: 14 }} />
              <SkeletonBlock height={14} style={{ marginTop: 10 }} />
              <SkeletonBlock width="85%" height={14} style={{ marginTop: 10 }} />
              <SkeletonBlock width="70%" height={14} style={{ marginTop: 10 }} />
            </div>
          </div>

          {/* Reserve panel */}
          <div
            style={{
              background: '#fff',
              borderRadius: 22,
              border: '1px solid rgba(42,34,32,0.06)',
              boxShadow: '0 8px 28px rgba(42,34,32,0.10)',
              padding: '24px 24px 26px',
            }}
          >
            <SkeletonBlock width="50%" height={28} />
            <SkeletonBlock height={48} radius={14} style={{ marginTop: 20 }} />
            <SkeletonBlock height={48} radius={14} style={{ marginTop: 12 }} />
            <SkeletonBlock height={48} radius={14} style={{ marginTop: 12 }} />
            <SkeletonBlock height={52} radius={999} style={{ marginTop: 20 }} />
          </div>
        </div>
      </div>
    </div>
  )
}
