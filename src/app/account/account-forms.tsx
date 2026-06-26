'use client'

// Profile-edit + change-password forms for /account.
//   - Profile : PATCH /api/local/users/[id]      { full_name?, avatar_url? }
//   - Password: POST  /api/auth/change-password  { currentPassword, newPassword }
// Inline success/error states; no global toast dependency.
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

const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 22,
  border: '1px solid rgba(42,34,32,0.06)',
  boxShadow: '0 6px 24px rgba(42,34,32,0.06)',
  padding: '24px',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 700,
  color: C.ink,
  marginBottom: 6,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '12px 14px',
  borderRadius: 14,
  border: '1px solid rgba(42,34,32,0.16)',
  background: C.cream,
  color: C.ink,
  fontSize: 15,
  fontFamily: 'inherit',
  outline: 'none',
}

function buttonStyle(disabled: boolean): React.CSSProperties {
  return {
    display: 'inline-block',
    color: '#fff',
    background: C.burgundy,
    border: 'none',
    fontWeight: 700,
    fontSize: 14,
    fontFamily: 'inherit',
    padding: '11px 26px',
    borderRadius: 999,
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.6 : 1,
  }
}

function Notice({ kind, text }: { kind: 'ok' | 'error'; text: string }) {
  const ok = kind === 'ok'
  return (
    <p
      role={ok ? 'status' : 'alert'}
      style={{
        margin: '14px 0 0',
        fontSize: 13.5,
        fontWeight: 600,
        color: ok ? '#177245' : '#b3261e',
      }}
    >
      {text}
    </p>
  )
}

function sectionTitle(text: string) {
  return (
    <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700, color: C.ink }}>
      {text}
    </h2>
  )
}

export function AccountForms({
  userId,
  initialName,
  initialAvatar,
}: {
  userId: string
  initialName: string
  initialAvatar: string
}) {
  const router = useRouter()
  const t = useTranslations('accountPage')

  // ---- Profile form -----------------------------------------------------
  const [fullName, setFullName] = useState(initialName)
  const [avatarUrl, setAvatarUrl] = useState(initialAvatar)
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMsg, setProfileMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSavingProfile(true)
    setProfileMsg(null)
    try {
      const res = await fetch(`/api/local/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          full_name: fullName.trim(),
          avatar_url: avatarUrl.trim(),
        }),
      })
      if (res.status === 401) {
        router.push('/login')
        return
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || t('profile.error'))
      }
      setProfileMsg({ kind: 'ok', text: t('profile.saved') })
      router.refresh()
    } catch (err) {
      setProfileMsg({
        kind: 'error',
        text: err instanceof Error ? err.message : t('profile.error'),
      })
    } finally {
      setSavingProfile(false)
    }
  }

  // ---- Password form ----------------------------------------------------
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    setPasswordMsg(null)

    if (newPassword.length < 8) {
      setPasswordMsg({ kind: 'error', text: t('password.tooShort') })
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ kind: 'error', text: t('password.mismatch') })
      return
    }

    setSavingPassword(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      if (res.status === 401) {
        router.push('/login')
        return
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || t('password.error'))
      }
      setPasswordMsg({ kind: 'ok', text: t('password.updated') })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setPasswordMsg({
        kind: 'error',
        text: err instanceof Error ? err.message : t('password.error'),
      })
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <>
      {/* Profile */}
      <form style={cardStyle} onSubmit={saveProfile}>
        {sectionTitle(t('profile.title'))}

        <div style={{ marginBottom: 16 }}>
          <label htmlFor="acct-name" style={labelStyle}>
            {t('profile.fullName')}
          </label>
          <input
            id="acct-name"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={t('profile.fullNamePlaceholder')}
            autoComplete="name"
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: 4 }}>
          <label htmlFor="acct-avatar" style={labelStyle}>
            {t('profile.avatarUrl')}
          </label>
          <input
            id="acct-avatar"
            type="url"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://…"
            autoComplete="off"
            style={inputStyle}
          />
        </div>

        <div style={{ marginTop: 18 }}>
          <button type="submit" disabled={savingProfile} style={buttonStyle(savingProfile)}>
            {savingProfile ? t('profile.saving') : t('profile.save')}
          </button>
        </div>

        {profileMsg && <Notice kind={profileMsg.kind} text={profileMsg.text} />}
      </form>

      {/* Password */}
      <form style={cardStyle} onSubmit={changePassword}>
        {sectionTitle(t('password.title'))}

        <div style={{ marginBottom: 16 }}>
          <label htmlFor="acct-current" style={labelStyle}>
            {t('password.current')}
          </label>
          <input
            id="acct-current"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            style={inputStyle}
            required
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label htmlFor="acct-new" style={labelStyle}>
            {t('password.new')}
          </label>
          <input
            id="acct-new"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            style={inputStyle}
            required
          />
        </div>

        <div style={{ marginBottom: 4 }}>
          <label htmlFor="acct-confirm" style={labelStyle}>
            {t('password.confirm')}
          </label>
          <input
            id="acct-confirm"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            style={inputStyle}
            required
          />
        </div>

        <div style={{ marginTop: 18 }}>
          <button type="submit" disabled={savingPassword} style={buttonStyle(savingPassword)}>
            {savingPassword ? t('password.updating') : t('password.update')}
          </button>
        </div>

        {passwordMsg && <Notice kind={passwordMsg.kind} text={passwordMsg.text} />}
      </form>
    </>
  )
}
