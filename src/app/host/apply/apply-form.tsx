'use client'

// Host application form: collects the details an admin needs to review, then
// POSTs to /api/local/host/apply. This does NOT grant host — on success it shows
// a calm "submitted, pending review" panel. Mirrors the boutique style + patterns
// of host/new/new-listing-form.tsx (inline styles, inline validation/errors).
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { fileToCompressedDataUrl } from '@/lib/image'

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

const input: React.CSSProperties = {
  width: '100%',
  fontFamily: 'inherit',
  fontSize: 14.5,
  padding: '11px 14px',
  border: `1px solid ${C.tan}`,
  borderRadius: 14,
  background: '#fff',
  color: C.ink,
  boxSizing: 'border-box',
}

const fieldWrap: React.CSSProperties = { marginBottom: 18 }

export function ApplyForm({ initialName }: { initialName: string }) {
  const router = useRouter()
  const t = useTranslations('hostApply')

  const [fullName, setFullName] = useState(initialName)
  const [hostType, setHostType] = useState<'individual' | 'company' | 'brokerage'>('individual')
  const [nationalId, setNationalId] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [company, setCompany] = useState('')
  const [notes, setNotes] = useState('')
  const isBusiness = hostType === 'company' || hostType === 'brokerage'

  // ID photos (data URLs) — required so admins can verify the host, same as /verify-id.
  const [idFront, setIdFront] = useState<string | null>(null)
  const [idBack, setIdBack] = useState<string | null>(null)
  const frontInputRef = useRef<HTMLInputElement>(null)
  const backInputRef = useRef<HTMLInputElement>(null)

  async function onPickId(side: 'front' | 'back', e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file
    if (!file) return
    try {
      const url = await fileToCompressedDataUrl(file)
      if (side === 'front') setIdFront(url)
      else setIdBack(url)
    } catch {
      setError(t('errors.idRequired'))
    }
  }

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!nationalId.trim()) {
      setError(t('errors.nationalIdRequired'))
      return
    }
    if (!phone.trim()) {
      setError(t('errors.phoneRequired'))
      return
    }
    if (!address.trim()) {
      setError(t('errors.addressRequired'))
      return
    }
    if (!idFront || !idBack) {
      setError(t('errors.idRequired'))
      return
    }

    setBusy(true)
    try {
      const res = await fetch('/api/local/host/apply', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName.trim() || undefined,
          host_type: hostType,
          national_id: nationalId.trim(),
          phone: phone.trim(),
          address: address.trim(),
          company: isBusiness ? company.trim() || undefined : undefined,
          notes: notes.trim() || undefined,
        }),
      })
      if (res.status === 401) {
        router.push('/login')
        return
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || t('errors.submitFailed'))
      }

      // Submit the ID photos for admin verification (same store as /verify-id).
      // Non-blocking: if this fails the application is still considered submitted.
      try {
        await fetch('/api/local/verification', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            front: idFront,
            back: idBack,
            id_number: nationalId.replace(/\D/g, '') || undefined,
            full_name: fullName.trim() || undefined,
          }),
        })
      } catch (verr) {
        console.error('ID verification submit failed', verr)
      }

      setSubmitted(true)
      router.refresh()
    } catch (err) {
      setBusy(false)
      setError(err instanceof Error ? err.message : t('errors.submitFailed'))
    }
  }

  if (submitted) {
    return (
      <div
        style={{
          background: '#fff',
          borderRadius: 22,
          border: `1px solid rgba(42,34,32,0.06)`,
          boxShadow: '0 6px 24px rgba(42,34,32,0.06)',
          padding: '32px 28px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 999,
            background: '#e7f5ec',
            color: '#177245',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
            fontWeight: 800,
            margin: '0 auto 16px',
          }}
          aria-hidden="true"
        >
          ✓
        </div>
        <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: C.ink }}>
          {t('success.title')}
        </h2>
        <p style={{ margin: '0 auto 22px', fontSize: 14.5, color: C.muted, lineHeight: 1.6, maxWidth: 420 }}>
          {t('success.body')}
        </p>
        <a
          href="/account"
          style={{
            display: 'inline-block',
            color: '#fff',
            background: C.burgundy,
            textDecoration: 'none',
            fontWeight: 700,
            fontSize: 14.5,
            padding: '12px 28px',
            borderRadius: 999,
          }}
        >
          {t('success.backToAccount')}
        </a>
      </div>
    )
  }

  return (
    <form
      onSubmit={submit}
      style={{
        background: '#fff',
        borderRadius: 24,
        border: `1px solid rgba(42,34,32,0.06)`,
        boxShadow: '0 6px 24px rgba(42,34,32,0.07)',
        padding: '28px 26px',
      }}
    >
      <div style={fieldWrap}>
        <label style={label}>{t('fields.hostType')}</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(['individual', 'company', 'brokerage'] as const).map((ht) => {
            const on = hostType === ht
            return (
              <button
                key={ht}
                type="button"
                onClick={() => setHostType(ht)}
                aria-pressed={on}
                style={{
                  padding: '9px 16px',
                  borderRadius: 999,
                  fontSize: 13.5,
                  fontWeight: 700,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  border: `1px solid ${on ? C.burgundy : 'rgba(42,34,32,0.16)'}`,
                  background: on ? C.burgundy : '#fff',
                  color: on ? '#fff' : C.ink,
                }}
              >
                {t(`hostTypes.${ht}`)}
              </button>
            )
          })}
        </div>
      </div>

      <div style={fieldWrap}>
        <label style={label} htmlFor="apply-name">{t('fields.fullName')}</label>
        <input
          id="apply-name"
          style={input}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder={t('placeholders.fullName')}
          autoComplete="name"
        />
      </div>

      <div style={fieldWrap}>
        <label style={label} htmlFor="apply-national-id">
          {t('fields.nationalId')} <span style={{ color: C.burgundy }}>*</span>
        </label>
        <input
          id="apply-national-id"
          style={input}
          value={nationalId}
          onChange={(e) => setNationalId(e.target.value)}
          placeholder={t('placeholders.nationalId')}
          required
        />
      </div>

      <div style={fieldWrap}>
        <label style={label} htmlFor="apply-phone">
          {t('fields.phone')} <span style={{ color: C.burgundy }}>*</span>
        </label>
        <input
          id="apply-phone"
          style={input}
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={t('placeholders.phone')}
          autoComplete="tel"
          required
        />
      </div>

      <div style={fieldWrap}>
        <label style={label} htmlFor="apply-address">
          {t('fields.address')} <span style={{ color: C.burgundy }}>*</span>
        </label>
        <textarea
          id="apply-address"
          style={{ ...input, minHeight: 84, resize: 'vertical' }}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder={t('placeholders.address')}
          autoComplete="street-address"
          required
        />
      </div>

      <div style={fieldWrap}>
        <label style={label}>
          {t('fields.idPhotos')} <span style={{ color: C.burgundy }}>*</span>
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {([
            { side: 'front' as const, value: idFront, ref: frontInputRef, clear: () => setIdFront(null), text: t('fields.idFront') },
            { side: 'back' as const, value: idBack, ref: backInputRef, clear: () => setIdBack(null), text: t('fields.idBack') },
          ]).map(({ side, value, ref, clear, text }) => (
            <div key={side}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: C.muted, marginBottom: 6 }}>{text}</div>
              <input
                ref={ref}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => onPickId(side, e)}
                style={{ display: 'none' }}
                aria-label={text}
              />
              {value ? (
                <div style={{ position: 'relative', width: '100%' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={value}
                    alt={text}
                    style={{
                      width: '100%',
                      aspectRatio: '1 / 1',
                      objectFit: 'cover',
                      borderRadius: 14,
                      border: `1px solid ${C.tan}`,
                      display: 'block',
                    }}
                  />
                  <button
                    type="button"
                    onClick={clear}
                    aria-label={t('idRemove')}
                    title={t('idRemove')}
                    style={{
                      position: 'absolute',
                      top: 8,
                      insetInlineEnd: 8,
                      width: 26,
                      height: 26,
                      borderRadius: 999,
                      border: 'none',
                      background: 'rgba(42,34,32,0.72)',
                      color: '#fff',
                      fontSize: 15,
                      lineHeight: 1,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: 'inherit',
                    }}
                  >
                    ×
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => ref.current?.click()}
                  style={{
                    width: '100%',
                    aspectRatio: '1 / 1',
                    borderRadius: 14,
                    border: `1px dashed ${C.tan}`,
                    background: C.cream,
                    color: C.muted,
                    fontSize: 12.5,
                    fontWeight: 600,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    padding: 10,
                    textAlign: 'center',
                    lineHeight: 1.4,
                  }}
                >
                  {t('idChoose')}
                </button>
              )}
            </div>
          ))}
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 12.5, color: C.muted, lineHeight: 1.5 }}>
          {t('idHint')}
        </p>
      </div>

      {isBusiness && (
        <div style={fieldWrap}>
          <label style={label} htmlFor="apply-company">
            {hostType === 'brokerage' ? t('fields.brokerageName') : t('fields.companyName')}
          </label>
          <input
            id="apply-company"
            style={input}
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder={t('placeholders.company')}
            autoComplete="organization"
          />
        </div>
      )}

      <div style={fieldWrap}>
        <label style={label} htmlFor="apply-notes">{t('fields.notesOptional')}</label>
        <textarea
          id="apply-notes"
          style={{ ...input, minHeight: 84, resize: 'vertical' }}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('placeholders.notes')}
        />
      </div>

      {error && (
        <p role="alert" style={{ margin: '0 0 14px', fontSize: 13.5, color: '#b3261e', fontWeight: 600 }}>
          {error}
        </p>
      )}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          type="submit"
          disabled={busy}
          style={{
            background: C.burgundy,
            color: '#fff',
            border: 'none',
            borderRadius: 999,
            padding: '12px 30px',
            fontWeight: 700,
            fontSize: 15,
            cursor: busy ? 'default' : 'pointer',
            opacity: busy ? 0.7 : 1,
            fontFamily: 'inherit',
          }}
        >
          {busy ? t('submitting') : t('submit')}
        </button>
        <a
          href="/account"
          style={{
            color: C.muted,
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: 14.5,
          }}
        >
          {t('cancel')}
        </a>
      </div>
    </form>
  )
}
