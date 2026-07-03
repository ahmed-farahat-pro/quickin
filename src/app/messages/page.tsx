'use client'

// Inbox for pre-booking chat threads (as guest or host). Left: conversation
// list; right: the selected thread's live panel. Auth is enforced by the API
// (401 → sign-in prompt).
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import LocalChatPanel from '@/components/local-chat-panel'

const C = { burgundy: '#5B0F16', cream: '#F6F1E6', tan: '#EFE6D8', ink: '#2A2220', muted: '#6B6055' }

interface Convo {
  id: string
  listing_title: string | null
  listing_image: string | null
  other_name: string | null
  last_message: string | null
  last_message_at: string
  is_host: boolean
}

export default function MessagesPage() {
  const t = useTranslations('chat')
  const [convos, setConvos] = useState<Convo[]>([])
  const [active, setActive] = useState<string | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'needsLogin' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/local/chat', { credentials: 'same-origin' })
        if (res.status === 401) { if (!cancelled) setState('needsLogin'); return }
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'error')
        if (!cancelled) {
          setConvos(data.conversations ?? [])
          setState('ready')
          setActive((prev) => prev ?? (data.conversations?.[0]?.id ?? null))
        }
      } catch {
        if (!cancelled) setState('error')
      }
    }
    load()
    const id = setInterval(load, 8000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  return (
    <main style={{ minHeight: '100vh', background: C.cream, color: C.ink, fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '28px 20px 60px' }}>
        <a href="/explore" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: C.burgundy, textDecoration: 'none', marginBottom: 18 }}>
          <span style={{ fontSize: 18, lineHeight: 1 }}>&larr;</span> {t('backToExplore')}
        </a>
        <h1 style={{ margin: '0 0 20px', fontFamily: '"Playfair Display", Georgia, serif', fontSize: 30, fontWeight: 700, color: C.burgundy }}>
          {t('inboxTitle')}
        </h1>

        {state === 'needsLogin' ? (
          <p style={{ fontSize: 15 }}>
            {t('needsLogin')}{' '}
            <a href="/login" style={{ color: C.burgundy, fontWeight: 700, textDecoration: 'none' }}>{t('logIn')}</a>
          </p>
        ) : (
          <style>{`
            @media (max-width: 720px) { .qk-msg-grid { grid-template-columns: 1fr !important; } }
          `}</style>
        )}

        {state !== 'needsLogin' && (
          <div className="qk-msg-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 300px) 1fr', gap: 20, alignItems: 'stretch' }}>
            {/* Thread list */}
            <div style={{ background: '#fff', borderRadius: 18, border: '1px solid rgba(42,34,32,0.06)', overflow: 'hidden' }}>
              {state === 'loading' && <p style={{ padding: 16, fontSize: 14, color: C.muted }}>{t('loading')}</p>}
              {state === 'ready' && convos.length === 0 && <p style={{ padding: 16, fontSize: 14, color: C.muted }}>{t('noThreads')}</p>}
              {convos.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActive(c.id)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
                    padding: '13px 15px', border: 'none', borderBottom: '1px solid rgba(42,34,32,0.06)',
                    background: active === c.id ? C.tan : '#fff', fontFamily: 'inherit',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 14.5, fontWeight: 700, color: C.ink }}>{c.other_name || t('host')}</span>
                    {c.is_host && <span style={{ fontSize: 10.5, fontWeight: 700, color: C.burgundy, background: C.cream, borderRadius: 999, padding: '2px 7px' }}>{t('asHost')}</span>}
                  </div>
                  {c.listing_title && <div style={{ fontSize: 12.5, color: C.muted, marginTop: 2 }}>{c.listing_title}</div>}
                  {c.last_message && <div style={{ fontSize: 12.5, color: C.muted, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.last_message}</div>}
                </button>
              ))}
            </div>

            {/* Active thread */}
            <div style={{ background: '#fff', borderRadius: 18, border: '1px solid rgba(42,34,32,0.06)', padding: 16, height: '62vh', minHeight: 380 }}>
              {active ? (
                <LocalChatPanel key={active} conversationId={active} />
              ) : (
                <p style={{ fontSize: 14, color: C.muted }}>{t('pickThread')}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
