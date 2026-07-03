'use client'

// "Message host" button on the listing detail page. Opens a slide-over drawer
// that hosts the local chat panel (pre-booking inquiry). No booking required.
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { MessageCircle } from 'lucide-react'
import LocalChatPanel from '@/components/local-chat-panel'

const C = { burgundy: '#5B0F16', cream: '#F6F1E6', tan: '#EFE6D8', ink: '#2A2220', muted: '#6B6055' }

export default function MessageHostButton({ listingId, hostName }: { listingId: string; hostName: string }) {
  const t = useTranslations('chat')
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          background: '#fff',
          color: C.burgundy,
          border: `1px solid ${C.burgundy}`,
          borderRadius: 999,
          padding: '10px 18px',
          fontWeight: 700,
          fontSize: 14,
          fontFamily: 'inherit',
          cursor: 'pointer',
        }}
      >
        <MessageCircle size={17} strokeWidth={2} />
        {t('messageHost')}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(42,34,32,0.44)',
            zIndex: 1000,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(420px, 100%)',
              height: '100%',
              background: C.cream,
              boxShadow: '-8px 0 30px rgba(42,34,32,0.25)',
              display: 'flex',
              flexDirection: 'column',
              padding: '20px 20px 22px',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>{t('title')}</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: C.burgundy }}>{hostName || t('host')}</div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t('close')}
                style={{ border: 'none', background: 'transparent', fontSize: 24, lineHeight: 1, cursor: 'pointer', color: C.ink }}
              >
                ×
              </button>
            </div>
            <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
              <LocalChatPanel listingId={listingId} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
