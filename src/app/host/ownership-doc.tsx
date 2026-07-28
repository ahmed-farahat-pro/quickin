'use client'

// Ownership document (proof the host owns / may list the place) — the web half
// of the flow the iOS + Android apps already have. Two widgets, both talking to
// the same `ownership_doc` field:
//  - OwnershipDocField: the labelled picker used by the create and edit forms.
//    It only holds the compressed data URL; the parent form sends it.
//  - OwnershipDocReupload: the "Re-upload ownership document" button on the host
//    dashboard cards. It PATCHes /api/local/listings/:id itself, which re-queues
//    the listing for review (approval_status='pending', unpublished).
// The document is admin-only — it is reviewed in /ops and never shown publicly.
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { fileToCompressedDataUrl, MAX_OWNERSHIP_DOC_CHARS } from '@/lib/image'

const C = {
  burgundy: '#5B0F16',
  cream: '#F6F1E6',
  tan: '#EFE6D8',
  ink: '#2A2220',
  muted: '#6B6055',
}

const label: React.CSSProperties = {
  display: 'block',
  fontSize: 13.5,
  fontWeight: 700,
  color: C.ink,
  marginBottom: 6,
}

/** Compress a picked file to a data URL, or a translated reason it failed. */
async function encodeDoc(
  file: File,
  t: (key: string) => string
): Promise<{ doc: string } | { error: string }> {
  try {
    const doc = await fileToCompressedDataUrl(file)
    // Same cap the server enforces — fail here rather than on a rejected request.
    if (doc.length > MAX_OWNERSHIP_DOC_CHARS) return { error: t('errors.tooLarge') }
    return { doc }
  } catch {
    return { error: t('errors.failed') }
  }
}

/**
 * Ownership-document upload field for the create / edit listing forms. The
 * picked image lives in the parent form's state (`value`), which sends it as
 * `ownership_doc`. `hasExistingDoc` lets the edit form say a document is already
 * on file without ever exposing its bytes to the host.
 */
export function OwnershipDocField({
  value,
  onChange,
  onError,
  idPrefix,
  hasExistingDoc = false,
}: {
  value: string
  onChange: (dataUrl: string) => void
  /** Surface a problem on the parent form's error line (null clears it). */
  onError: (message: string | null) => void
  /** Keeps the create + edit file inputs from sharing a DOM id. */
  idPrefix: string
  /** Edit flow: this listing already has a document stored. */
  hasExistingDoc?: boolean
}) {
  const t = useTranslations('hostPage.ownershipDoc')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file
    if (!file) return
    setBusy(true)
    onError(null)
    const result = await encodeDoc(file, t)
    setBusy(false)
    if ('error' in result) onError(result.error)
    else onChange(result.doc)
  }

  const attached = Boolean(value)

  return (
    <div style={{ marginBottom: 18 }}>
      <label style={label} htmlFor={`${idPrefix}-ownership-doc`}>{t('label')}</label>
      <p style={{ margin: '0 0 10px', fontSize: 12.5, color: C.muted, lineHeight: 1.55 }}>{t('intro')}</p>
      <input
        ref={fileRef}
        id={`${idPrefix}-ownership-doc`}
        type="file"
        accept="image/*"
        onChange={onPick}
        style={{ display: 'none' }}
      />
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          style={{
            padding: '10px 18px',
            borderRadius: 12,
            border: `1px solid ${C.tan}`,
            background: C.cream,
            color: C.burgundy,
            fontWeight: 700,
            fontSize: 14,
            fontFamily: 'inherit',
            cursor: busy ? 'default' : 'pointer',
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? t('processing') : attached || hasExistingDoc ? t('change') : t('upload')}
        </button>
        <span style={{ fontSize: 12.5, color: C.muted }}>
          {attached ? t('attached') : hasExistingDoc ? t('onFile') : t('missing')}
        </span>
      </div>

      {attached && (
        <div style={{ marginTop: 12, position: 'relative', width: 120, aspectRatio: '1 / 1', borderRadius: 12, overflow: 'hidden', background: C.tan }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label={t('remove')}
            style={{
              position: 'absolute', top: 5, right: 5, width: 22, height: 22, borderRadius: 999,
              border: 'none', background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 14, lineHeight: 1,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>
      )}

      <p style={{ margin: '10px 0 0', fontSize: 12.5, color: C.muted, lineHeight: 1.55 }}>{t('reviewNotice')}</p>
    </div>
  )
}

/**
 * "Re-upload ownership document" for a listing that is under review or was
 * rejected (mirrors iOS `approval.reupload`). Sends the new document straight to
 * PATCH /api/local/listings/:id, then refreshes the server-rendered dashboard so
 * the card's status badge reflects the fresh review queue entry.
 */
export function OwnershipDocReupload({ listingId }: { listingId: string }) {
  const router = useRouter()
  const t = useTranslations('hostPage.ownershipDoc')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file
    if (!file) return
    setBusy(true)
    setError(null)
    setDone(false)
    try {
      const result = await encodeDoc(file, t)
      if ('error' in result) {
        setError(result.error)
        return
      }
      const res = await fetch(`/api/local/listings/${listingId}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownership_doc: result.doc }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || t('errors.uploadFailed'))
      }
      setDone(true)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.uploadFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ padding: '0 16px 16px' }}>
      <input ref={fileRef} type="file" accept="image/*" onChange={onPick} style={{ display: 'none' }} />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        style={{
          width: '100%',
          padding: '9px 12px',
          borderRadius: 999,
          border: `1px solid rgba(91,15,22,0.18)`,
          background: C.tan,
          color: C.burgundy,
          fontFamily: 'inherit',
          fontSize: 13.5,
          fontWeight: 700,
          cursor: busy ? 'default' : 'pointer',
          opacity: busy ? 0.7 : 1,
        }}
      >
        {busy ? t('uploading') : t('reupload')}
      </button>
      {done && !error && (
        <p role="status" style={{ margin: '8px 0 0', fontSize: 12.5, color: '#177245', fontWeight: 700 }}>
          {t('resubmitted')}
        </p>
      )}
      {error && (
        <p role="alert" style={{ margin: '8px 0 0', fontSize: 12.5, color: '#b3261e', fontWeight: 600 }}>
          {error}
        </p>
      )}
    </div>
  )
}
