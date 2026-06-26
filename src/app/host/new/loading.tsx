// Route-segment skeleton for /host/new — mirrors the gradient header, title and
// the create-listing form-field placeholders (maxWidth 720).
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
          <SkeletonBlock width={130} height={16} />
        </div>
      </header>

      <section style={{ maxWidth: 720, margin: '0 auto', padding: '36px 24px 72px' }}>
        <SkeletonBlock width={240} height={34} radius={12} />
        <SkeletonBlock width={340} height={15} style={{ marginTop: 12, marginBottom: 28 }} />

        <div
          style={{
            background: '#fff',
            borderRadius: 22,
            border: '1px solid rgba(42,34,32,0.06)',
            boxShadow: '0 6px 24px rgba(42,34,32,0.06)',
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          {/* Single + paired fields */}
          {['100%', '100%'].map((w, i) => (
            <div key={i}>
              <SkeletonBlock width="30%" height={12} radius={6} />
              <SkeletonBlock height={46} radius={14} style={{ marginTop: 8 }} />
            </div>
          ))}

          {/* Textarea */}
          <div>
            <SkeletonBlock width="30%" height={12} radius={6} />
            <SkeletonBlock height={110} radius={14} style={{ marginTop: 8 }} />
          </div>

          {/* Two-up rows */}
          {[0, 1].map((row) => (
            <div key={row} style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {[0, 1].map((col) => (
                <div key={col} style={{ flex: '1 1 200px' }}>
                  <SkeletonBlock width="40%" height={12} radius={6} />
                  <SkeletonBlock height={46} radius={14} style={{ marginTop: 8 }} />
                </div>
              ))}
            </div>
          ))}

          {/* Submit */}
          <SkeletonBlock width={180} height={48} radius={999} style={{ marginTop: 8 }} />
        </div>
      </section>
    </div>
  )
}
