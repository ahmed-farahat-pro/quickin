'use client'

// Host application form: collects the details an admin needs to review, then
// POSTs to /api/local/host/apply. This does NOT grant host — on success it shows
// a calm "submitted, pending review" panel. Mirrors the boutique style + patterns
// of host/new/new-listing-form.tsx (inline styles, inline validation/errors).
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

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
  const [nationalId, setNationalId] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [company, setCompany] = useState('')
  const [notes, setNotes] = useState('')

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

    setBusy(true)
    try {
      const res = await fetch('/api/local/host/apply', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName.trim() || undefined,
          national_id: nationalId.trim(),
          phone: phone.trim(),
          address: address.trim(),
          company: company.trim() || undefined,
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
        <label style={label} htmlFor="apply-company">{t('fields.companyOptional')}</label>
        <input
          id="apply-company"
          style={input}
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder={t('placeholders.company')}
          autoComplete="organization"
        />
      </div>

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
