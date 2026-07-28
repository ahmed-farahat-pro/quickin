'use client'

// Host-authored stay guide for ONE confirmed reservation — the web half of the
// editor the iOS + Android apps have. Talks to:
//   GET    /api/local/bookings/:id/stay-guide
//   POST   /api/local/bookings/:id/stay-guide
//   PATCH  /api/local/bookings/:id/stay-guide/:itemId   (text edits + reorder)
//   DELETE /api/local/bookings/:id/stay-guide/:itemId
// Every one of those verifies server-side that the caller is the host of the
// listing this booking belongs to and that the booking is confirmed — this
// component only decides what to *show*.
//
// It is mounted exclusively on confirmed reservations (see host-reservations),
// which is also why the guest link and its QR can be rendered here: by then the
// reservation has a code. `stayPassPath` still refuses a null/"null" code.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { fileToCompressedDataUrl, MAX_OWNERSHIP_DOC_CHARS } from '@/lib/image'
import { stayPassPath } from '@/lib/stay-code'
import { StayQr } from '@/app/stay/stay-qr'

const C = {
  burgundy: '#5B0F16',
  cream: '#F6F1E6',
  tan: '#EFE6D8',
  ink: '#2A2220',
  muted: '#6B6055',
}

const KINDS = ['info', 'photo', 'place_qr', 'attachment'] as const
type Kind = (typeof KINDS)[number]

interface GuideItem {
  id: string
  kind: Kind
  title: string | null
  body: string | null
  url: string | null
  order: number
}

interface Draft {
  kind: Kind
  title: string
  body: string
  url: string
}

const emptyDraft: Draft = { kind: 'info', title: '', body: '', url: '' }

const field: React.CSSProperties = {
  width: '100%',
  fontFamily: 'inherit',
  fontSize: 14,
  padding: '9px 12px',
  border: `1px solid ${C.tan}`,
  borderRadius: 12,
  background: '#fff',
  color: C.ink,
}

const fieldLabel: React.CSSProperties = {
  display: 'block',
  fontSize: 12.5,
  fontWeight: 700,
  color: C.ink,
  margin: '0 0 5px',
}

const primaryBtn: React.CSSProperties = {
  background: C.burgundy,
  color: '#fff',
  border: 'none',
  borderRadius: 999,
  padding: '9px 20px',
  fontWeight: 700,
  fontSize: 13.5,
  fontFamily: 'inherit',
  cursor: 'pointer',
}

const ghostBtn: React.CSSProperties = {
  background: '#fff',
  color: C.burgundy,
  border: `1px solid ${C.tan}`,
  borderRadius: 999,
  padding: '7px 16px',
  fontWeight: 700,
  fontSize: 13,
  fontFamily: 'inherit',
  cursor: 'pointer',
}

const linkBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 13,
  fontWeight: 700,
  color: C.muted,
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('read failed'))
    reader.readAsDataURL(file)
  })
}

/** Photos go through the shared compressor (same as listing/ID uploads); other
 *  documents are inlined as-is. Both are capped at the server's limit so an
 *  oversized file fails here instead of on a rejected request. */
async function encodeFile(file: File, t: (key: string) => string): Promise<{ url: string } | { error: string }> {
  try {
    const url = /^image\//i.test(file.type)
      ? await fileToCompressedDataUrl(file)
      : await readAsDataUrl(file)
    if (url.length > MAX_OWNERSHIP_DOC_CHARS) return { error: t('errors.tooLarge') }
    return { url }
  } catch {
    return { error: t('errors.file') }
  }
}

export function StayGuideEditor({
  bookingId,
  reservationCode,
}: {
  bookingId: string
  /** The confirmed booking's code — used for the guest-link preview only. */
  reservationCode: string | null
}) {
  const t = useTranslations('stayPass.host')
  const locale = useLocale()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<GuideItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch(`/api/local/bookings/${bookingId}/stay-guide`, { credentials: 'same-origin' })
      if (res.status === 401) {
        window.location.href = '/login'
        return
      }
      if (!res.ok) throw new Error(t('errors.load'))
      const data = await res.json()
      setItems(Array.isArray(data.items) ? (data.items as GuideItem[]) : [])
    } catch (e) {
      setItems([])
      setError(e instanceof Error ? e.message : t('errors.load'))
    }
  }, [bookingId, t])

  useEffect(() => {
    if (open && items === null) load()
  }, [open, items, load])

  async function send(path: string, method: string, payload?: unknown) {
    const res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: payload ? { 'Content-Type': 'application/json' } : undefined,
      body: payload ? JSON.stringify(payload) : undefined,
    })
    if (res.status === 401) {
      window.location.href = '/login'
      throw new Error(t('errors.save'))
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error || t('errors.save'))
    }
    return res.json().catch(() => ({}))
  }

  async function create(draft: Draft) {
    setBusy(true)
    setError(null)
    try {
      await send(`/api/local/bookings/${bookingId}/stay-guide`, 'POST', {
        kind: draft.kind,
        title: draft.title,
        body: draft.body,
        url: draft.url,
      })
      await load()
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errors.save'))
      return false
    } finally {
      setBusy(false)
    }
  }

  async function update(itemId: string, patch: Partial<Draft> & { order?: number }) {
    setBusy(true)
    setError(null)
    try {
      await send(`/api/local/bookings/${bookingId}/stay-guide/${itemId}`, 'PATCH', patch)
      await load()
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errors.save'))
      return false
    } finally {
      setBusy(false)
    }
  }

  async function remove(itemId: string) {
    setBusy(true)
    setError(null)
    try {
      await send(`/api/local/bookings/${bookingId}/stay-guide/${itemId}`, 'DELETE')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errors.remove'))
    } finally {
      setBusy(false)
    }
  }

  /** Move one item and renumber — legacy rows can share an "order" of 0, so the
   *  whole list is rewritten to its new index rather than swapping two values. */
  async function move(index: number, delta: number) {
    if (!items) return
    const next = [...items]
    const target = index + delta
    if (target < 0 || target >= next.length) return
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved)
    setItems(next.map((item, i) => ({ ...item, order: i })))
    setBusy(true)
    setError(null)
    try {
      for (let i = 0; i < next.length; i++) {
        if (items[i]?.id !== next[i].id || next[i].order !== i) {
          await send(`/api/local/bookings/${bookingId}/stay-guide/${next[i].id}`, 'PATCH', { order: i })
        }
      }
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errors.save'))
      await load()
    } finally {
      setBusy(false)
    }
  }

  const guestPath = stayPassPath(reservationCode, locale)
  // Absolute for the QR (a relative path is unscannable), relative for the link.
  // Safe to read `window` here: the panel only renders after the host opens it,
  // long after hydration — the closed state is just the button below.
  const guestUrl =
    guestPath && typeof window !== 'undefined' ? `${window.location.origin}${guestPath}` : guestPath

  if (!open) {
    return (
      <div style={{ marginTop: 14 }}>
        <button type="button" onClick={() => setOpen(true)} style={ghostBtn}>
          {t('manage')}
        </button>
      </div>
    )
  }

  return (
    <div
      style={{
        marginTop: 14,
        padding: '16px 16px 18px',
        background: C.cream,
        border: `1px solid rgba(91,15,22,0.10)`,
        borderRadius: 16,
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <h4 style={{ margin: 0, fontSize: 15.5, fontWeight: 700, color: C.burgundy }}>{t('heading')}</h4>
        <button type="button" onClick={() => setOpen(false)} style={linkBtn}>
          {t('hide')}
        </button>
      </div>
      <p style={{ margin: '6px 0 0', fontSize: 13, lineHeight: 1.6, color: C.muted }}>{t('intro')}</p>

      {guestPath && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '12px 0 0' }}>
          <StayQr value={guestUrl} size={72} title={reservationCode ?? undefined} />
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: C.ink }}>{t('guestLink')}</p>
            <a
              href={guestPath}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 13, color: C.burgundy, textDecoration: 'underline', textUnderlineOffset: 3, wordBreak: 'break-all' }}
            >
              {guestPath}
            </a>
          </div>
        </div>
      )}

      {items === null ? (
        <p style={{ margin: '14px 0 0', fontSize: 13.5, color: C.muted }}>{t('loading')}</p>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '14px 0 0' }}>
            {items.length === 0 && (
              <p style={{ margin: 0, fontSize: 13.5, color: C.muted }}>{t('empty')}</p>
            )}
            {items.map((item, index) =>
              editingId === item.id ? (
                <ItemForm
                  key={item.id}
                  initial={{
                    kind: item.kind,
                    title: item.title ?? '',
                    body: item.body ?? '',
                    url: item.url ?? '',
                  }}
                  busy={busy}
                  submitLabel={t('save')}
                  busyLabel={t('saving')}
                  onCancel={() => setEditingId(null)}
                  onSubmit={async (draft) => {
                    const ok = await update(item.id, draft)
                    if (ok) setEditingId(null)
                    return ok
                  }}
                />
              ) : (
                <article
                  key={item.id}
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 12,
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    background: '#fff',
                    border: '1px solid rgba(42,34,32,0.07)',
                    borderRadius: 14,
                    padding: '11px 13px',
                  }}
                >
                  <div style={{ display: 'flex', gap: 11, minWidth: 0, flex: '1 1 220px' }}>
                    {item.kind === 'photo' && item.url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.url}
                        alt=""
                        style={{ width: 46, height: 46, objectFit: 'cover', borderRadius: 10, display: 'block', background: C.tan }}
                      />
                    )}
                    <div style={{ minWidth: 0 }}>
                      <span
                        style={{
                          display: 'inline-block',
                          background: C.tan,
                          color: C.burgundy,
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '2px 9px',
                          borderRadius: 999,
                        }}
                      >
                        {t(`kinds.${item.kind}`)}
                      </span>
                      {item.title && (
                        <p style={{ margin: '5px 0 0', fontSize: 14, fontWeight: 700, color: C.ink }}>{item.title}</p>
                      )}
                      {item.body && (
                        <p style={{ margin: '2px 0 0', fontSize: 13, color: C.muted, whiteSpace: 'pre-wrap' }}>{item.body}</p>
                      )}
                      {item.kind === 'place_qr' && item.url && (
                        <p style={{ margin: '2px 0 0', fontSize: 12.5, color: C.muted, wordBreak: 'break-all' }}>{item.url}</p>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => move(index, -1)} disabled={busy || index === 0} style={linkBtn}>
                      {t('moveUp')}
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, 1)}
                      disabled={busy || index === items.length - 1}
                      style={linkBtn}
                    >
                      {t('moveDown')}
                    </button>
                    <button type="button" onClick={() => setEditingId(item.id)} disabled={busy} style={linkBtn}>
                      {t('edit')}
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(item.id)}
                      disabled={busy}
                      style={{ ...linkBtn, color: '#b3261e' }}
                    >
                      {t('remove')}
                    </button>
                  </div>
                </article>
              )
            )}
          </div>

          {!editingId && (
            <div style={{ marginTop: 12 }}>
              <ItemForm
                initial={emptyDraft}
                busy={busy}
                submitLabel={t('add')}
                busyLabel={t('adding')}
                resetOnSubmit
                onSubmit={create}
              />
            </div>
          )}
        </>
      )}

      {error && (
        <p role="alert" style={{ margin: '10px 0 0', fontSize: 13, color: '#b3261e', fontWeight: 600 }}>
          {error}
        </p>
      )}
    </div>
  )
}

/** One form, used both to add an item and to edit an existing one. */
function ItemForm({
  initial,
  busy,
  submitLabel,
  busyLabel,
  resetOnSubmit = false,
  onSubmit,
  onCancel,
}: {
  initial: Draft
  busy: boolean
  submitLabel: string
  busyLabel: string
  resetOnSubmit?: boolean
  onSubmit: (draft: Draft) => Promise<boolean>
  onCancel?: () => void
}) {
  const t = useTranslations('stayPass.host')
  const [draft, setDraft] = useState<Draft>(initial)
  const [fileBusy, setFileBusy] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const isFileKind = draft.kind === 'photo' || draft.kind === 'attachment'
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file
    if (!file) return
    setFileBusy(true)
    setFileError(null)
    const result = await encodeFile(file, t)
    setFileBusy(false)
    if ('error' in result) setFileError(result.error)
    else set({ url: result.url })
  }

  async function submit() {
    const ok = await onSubmit(draft)
    if (ok && resetOnSubmit) setDraft(emptyDraft)
  }

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid rgba(42,34,32,0.07)',
        borderRadius: 14,
        padding: '13px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div>
        <label style={fieldLabel} htmlFor={`kind-${initial.kind}-${submitLabel}`}>
          {t('kindLabel')}
        </label>
        <select
          id={`kind-${initial.kind}-${submitLabel}`}
          value={draft.kind}
          onChange={(e) => set({ kind: e.target.value as Kind, url: '' })}
          style={field}
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {t(`kinds.${k}`)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label style={fieldLabel}>{t('titleLabel')}</label>
        <input
          value={draft.title}
          onChange={(e) => set({ title: e.target.value })}
          placeholder={t('titlePlaceholder')}
          maxLength={120}
          style={field}
        />
      </div>

      <div>
        <label style={fieldLabel}>{t('bodyLabel')}</label>
        <textarea
          value={draft.body}
          onChange={(e) => set({ body: e.target.value })}
          placeholder={t('bodyPlaceholder')}
          rows={3}
          maxLength={4000}
          style={{ ...field, resize: 'vertical' }}
        />
      </div>

      {draft.kind === 'place_qr' && (
        <div>
          <label style={fieldLabel}>{t('linkLabel')}</label>
          <input
            value={draft.url}
            onChange={(e) => set({ url: e.target.value })}
            placeholder={t('linkPlaceholder')}
            inputMode="url"
            style={field}
          />
        </div>
      )}

      {isFileKind && (
        <div>
          <input
            ref={fileRef}
            type="file"
            accept={draft.kind === 'photo' ? 'image/*' : 'image/*,application/pdf'}
            onChange={onPick}
            style={{ display: 'none' }}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            <button type="button" onClick={() => fileRef.current?.click()} disabled={fileBusy} style={ghostBtn}>
              {fileBusy
                ? t('processing')
                : draft.url
                  ? t('change')
                  : draft.kind === 'photo'
                    ? t('choosePhoto')
                    : t('chooseFile')}
            </button>
            {draft.url && <span style={{ fontSize: 12.5, color: C.muted }}>{t('attached')}</span>}
          </div>
          {fileError && (
            <p role="alert" style={{ margin: '7px 0 0', fontSize: 12.5, color: '#b3261e', fontWeight: 600 }}>
              {fileError}
            </p>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={submit}
          disabled={busy || fileBusy}
          style={{ ...primaryBtn, opacity: busy || fileBusy ? 0.7 : 1 }}
        >
          {busy ? busyLabel : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={busy} style={linkBtn}>
            {t('cancel')}
          </button>
        )}
      </div>
    </div>
  )
}
