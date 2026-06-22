'use client'

// Header notifications bell for the local-stack web. Fetches /api/local/notifications
// (cookie auth), shows an unread badge, and a dropdown of recent items with "mark all read".
// Renders nothing when signed out (401).

import { useCallback, useEffect, useState } from 'react'
import { Bell, Check } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type Notif = { id: string; title: string; body?: string | null; read: boolean }

export function NotificationsBell({ className }: { className?: string }) {
  const t = useTranslations('explorePage')
  const [items, setItems] = useState<Notif[]>([])
  const [unread, setUnread] = useState(0)
  const [signedIn, setSignedIn] = useState(true)

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/local/notifications', { credentials: 'same-origin', cache: 'no-store' })
      if (r.status === 401) { setSignedIn(false); return }
      if (!r.ok) return
      const d = await r.json()
      setItems(Array.isArray(d.notifications) ? d.notifications : [])
      setUnread(Number(d.unreadCount) || 0)
      setSignedIn(true)
    } catch { /* offline — leave as is */ }
  }, [])

  useEffect(() => { load() }, [load])

  async function markAll() {
    setUnread(0)
    setItems((prev) => prev.map((i) => ({ ...i, read: true })))
    try { await fetch('/api/local/notifications/read-all', { method: 'POST', credentials: 'same-origin' }) } catch { /* ignore */ }
  }

  if (!signedIn) return null

  return (
    <DropdownMenu onOpenChange={(o) => { if (o) load() }}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t('nav.notifications')}
          className={`relative inline-flex h-10 w-10 items-center justify-center rounded-full text-[#2A2220] transition-colors hover:bg-black/5 ${className ?? ''}`}
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#5B0F16] px-1 text-[11px] font-bold text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[26rem] w-80 overflow-auto rounded-2xl p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-sm font-semibold">{t('nav.notifications')}</span>
          {items.some((i) => !i.read) && (
            <button onClick={markAll} className="inline-flex items-center gap-1 text-xs font-semibold text-[#5B0F16]">
              <Check className="h-3.5 w-3.5" /> {t('nav.markAllRead')}
            </button>
          )}
        </div>
        {items.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">{t('nav.noNotifications')}</div>
        ) : (
          <ul className="divide-y">
            {items.map((n) => (
              <li key={n.id} className={`px-4 py-3 ${n.read ? '' : 'bg-[#5B0F16]/5'}`}>
                <div className="flex gap-2">
                  {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#5B0F16]" />}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#2A2220]">{n.title}</p>
                    {n.body && <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
