// Route-segment skeleton for /account — mirrors the gradient header, identity
// card, profile/password form blocks and quick-links list (maxWidth 720).
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
            maxWidth: 720,
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

      <section
        style={{
          maxWidth: 720,
          margin: '0 auto',
          padding: '36px 24px 72px',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        <div>
          <SkeletonBlock width={180} height={34} radius={12} />
          <SkeletonBlock width={300} height={15} style={{ marginTop: 12 }} />
        </div>

        {/* Identity card */}
        <div
          style={{
            background: '#fff',
            borderRadius: 22,
            border: '1px solid rgba(42,34,32,0.06)',
            boxShadow: '0 6px 24px rgba(42,34,32,0.06)',
            padding: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 18,
          }}
        >
          <SkeletonBlock width={72} height={72} radius={999} style={{ flex: '0 0 auto' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <SkeletonBlock width="40%" height={20} />
            <SkeletonBlock width="60%" height={14} style={{ marginTop: 8 }} />
            <SkeletonBlock width={120} height={24} radius={999} style={{ marginTop: 12 }} />
          </div>
        </div>

        {/* Form blocks */}
        {[0, 1].map((i) => (
          <div
            key={i}
            style={{
              background: '#fff',
              borderRadius: 22,
              border: '1px solid rgba(42,34,32,0.06)',
              boxShadow: '0 6px 24px rgba(42,34,32,0.06)',
              padding: 24,
            }}
          >
            <SkeletonBlock width={160} height={20} />
            <SkeletonBlock width="30%" height={12} radius={6} style={{ marginTop: 20 }} />
            <SkeletonBlock height={46} radius={14} style={{ marginTop: 8 }} />
            <SkeletonBlock width="30%" height={12} radius={6} style={{ marginTop: 16 }} />
            <SkeletonBlock height={46} radius={14} style={{ marginTop: 8 }} />
            <SkeletonBlock width={140} height={44} radius={999} style={{ marginTop: 20 }} />
          </div>
        ))}

        {/* Quick links */}
        <div
          style={{
            background: '#fff',
            borderRadius: 22,
            border: '1px solid rgba(42,34,32,0.06)',
            boxShadow: '0 6px 24px rgba(42,34,32,0.06)',
            padding: '12px 16px',
          }}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonBlock key={i} width="50%" height={18} style={{ margin: '14px 0' }} />
          ))}
        </div>
      </section>
    </div>
  )
}
