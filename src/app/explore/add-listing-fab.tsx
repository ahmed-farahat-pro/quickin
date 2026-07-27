// Fixed "Add listing" action button for hosts — the top-nav pill moved down to a
// floating button, mirroring the WhatsApp FAB (same 56px height, pill radius and
// shadow weight) on the opposite corner of the screen:
//
//   inline-START  → WhatsApp   (src/components/whatsapp-fab.tsx)
//   inline-END    → Add listing (this file)
//
// Logical inset properties keep them on opposite corners in RTL too (they simply
// mirror with the rest of the layout), so the two can never collide.
//
// Wide screens get the extended pill (+ icon + label); ≤640px collapses to a 56px
// circle and raises `bottom` clear of the phone-only "download the app" bar
// (fixed, ~64px + safe-area, zIndex 950 — see ./app-download-bar.tsx).
import { Plus } from 'lucide-react'

export default function AddListingFab({ href, label }: { href: string; label: string }) {
  return (
    <>
      <style>{`
        .qk-fab-add {
          position: fixed;
          bottom: 22px;
          inset-inline-end: 22px;
          z-index: 900;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          height: 56px;
          min-width: 56px;
          padding: 0 22px;
          border-radius: 999px;
          background: #5B0F16;
          color: #F6F1E6;
          font-weight: 700;
          font-size: 15px;
          line-height: 1;
          white-space: nowrap;
          text-decoration: none;
          box-shadow: 0 8px 22px rgba(91,15,22,0.45);
        }
        @media (max-width: 640px) {
          .qk-fab-add {
            bottom: calc(80px + env(safe-area-inset-bottom));
            width: 56px;
            padding: 0;
            gap: 0;
          }
          .qk-fab-add-label { display: none; }
        }
      `}</style>
      <a href={href} className="qk-fab-add" aria-label={label} title={label}>
        <Plus aria-hidden style={{ width: 24, height: 24, flex: '0 0 auto' }} strokeWidth={2.5} />
        <span className="qk-fab-add-label">{label}</span>
      </a>
    </>
  )
}
