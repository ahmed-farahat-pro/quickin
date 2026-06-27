'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ShieldCheck, Clock, ShieldAlert, XCircle, UploadCloud, Loader2, X } from 'lucide-react'

type Status = 'loading' | 'guest' | 'unverified' | 'pending' | 'verified' | 'rejected'
type Side = 'front' | 'back'

/**
 * Self-contained identity-verification panel for the live (Supabase-free) web app.
 * Talks to the node-pg backend the mobile apps also use:
 *   GET  /api/local/verification                          → current status (qk_token cookie)
 *   POST /api/local/verification { front, back, id_number? } → submit ID photos for admin review
 *
 * No OCR: the user simply picks or captures a FRONT photo and a BACK photo of their ID and submits
 * both. Every submission becomes a pending row for an admin to verify in the admin panel.
 */
export function IdVerificationPanel() {
  const [status, setStatus] = useState<Status>('loading')
  const [notes, setNotes] = useState<string | null>(null)
  const [idNumberSaved, setIdNumberSaved] = useState<string | null>(null)
  const [front, setFront] = useState<string | null>(null) // data URL of the front photo
  const [back, setBack] = useState<string | null>(null) // data URL of the back photo
  const [idNumber, setIdNumber] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      const res = await fetch('/api/local/verification', { credentials: 'same-origin', cache: 'no-store' })
      if (res.status === 401) return setStatus('guest')
      const d = await res.json()
      setStatus((d.status as Status) || 'unverified')
      setNotes(d.notes || null)
      setIdNumberSaved(d.id_number || null)
    } catch {
      setStatus('unverified')
    }
  }
  useEffect(() => { load() }, [])

  function onPick(side: Side, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    const reader = new FileReader()
    reader.onload = () => {
      const url = typeof reader.result === 'string' ? reader.result : null
      if (side === 'front') setFront(url)
      else setBack(url)
    }
    reader.readAsDataURL(file)
    // Allow re-picking the same file.
    e.target.value = ''
  }

  async function submit() {
    if (!front || !back) {
      setError('Please add both the front and back of your ID.')
      return
    }
    setSubmitting(true); setError(null)
    try {
      const res = await fetch('/api/local/verification', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ front, back, id_number: idNumber.trim() || undefined }),
      })
      if (res.status === 401) { setError('Please sign in to submit your ID.'); return }
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error || 'Upload failed. Please try again.')
      }
      setFront(null); setBack(null); setIdNumber('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (status === 'loading') {
    return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
  }

  const pill = {
    verified:   { icon: ShieldCheck, cls: 'bg-green-500 text-white',  label: 'Verified' },
    pending:    { icon: Clock,       cls: 'bg-yellow-500 text-white', label: 'Pending review' },
    rejected:   { icon: XCircle,     cls: 'bg-red-500 text-white',    label: 'Rejected' },
    unverified: { icon: ShieldAlert, cls: 'bg-muted text-foreground', label: 'Not verified' },
    guest:      { icon: ShieldAlert, cls: 'bg-muted text-foreground', label: 'Sign in' },
  }[status] ?? { icon: ShieldAlert, cls: 'bg-muted', label: 'Not verified' }
  const PillIcon = pill.icon

  const canSubmit = status === 'unverified' || status === 'rejected' || status === 'guest'

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Identity verification
          <Badge className={pill.cls}><PillIcon className="h-3 w-3 mr-1" />{pill.label}</Badge>
        </CardTitle>
        <CardDescription>
          Upload a clear photo of the front and back of your National ID. Our team verifies it manually.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status === 'verified' && (
          <p className="text-sm text-green-700">Your identity is verified{idNumberSaved ? ` (ID ${idNumberSaved})` : ''}. Nothing more to do.</p>
        )}
        {status === 'pending' && (
          <p className="text-sm text-yellow-700">Thanks! Your ID is in review — an admin will approve it shortly.</p>
        )}
        {status === 'rejected' && notes && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <span className="font-medium">Rejected:</span> {notes}. Please re-upload clearer photos.
          </div>
        )}
        {status === 'guest' && (
          <p className="text-sm text-muted-foreground">Please sign in first, then upload your ID here.</p>
        )}

        {canSubmit && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <IdPhotoInput side="front" label="Front of ID" value={front} onPick={onPick} onClear={() => setFront(null)} disabled={submitting} />
              <IdPhotoInput side="back" label="Back of ID" value={back} onPick={onPick} onClear={() => setBack(null)} disabled={submitting} />
            </div>

            <div className="space-y-1">
              <label htmlFor="id-number" className="text-xs font-medium text-muted-foreground">ID number (optional)</label>
              <input
                id="id-number"
                type="text"
                inputMode="numeric"
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
                disabled={submitting}
                placeholder="e.g. 29001011234567"
                className="w-full rounded-input border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button onClick={submit} disabled={!front || !back || submitting} className="w-full">
              {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting…</> : 'Submit for verification'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface IdPhotoInputProps {
  side: Side
  label: string
  value: string | null
  onPick: (side: Side, e: React.ChangeEvent<HTMLInputElement>) => void
  onClear: () => void
  disabled?: boolean
}

function IdPhotoInput({ side, label, value, onPick, onClear, disabled }: IdPhotoInputProps) {
  return (
    <div className="space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="relative">
        <label className="flex aspect-[3/2] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 p-4 text-center transition-colors hover:bg-muted/50">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt={`${label} preview`} className="max-h-full max-w-full rounded-lg object-contain" />
          ) : (
            <>
              <UploadCloud className="h-7 w-7 text-primary/70" />
              <span className="text-xs font-medium">Choose or take a photo</span>
              <span className="text-[10px] text-muted-foreground">JPG or PNG</span>
            </>
          )}
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onPick(side, e)} disabled={disabled} />
        </label>
        {value && !disabled && (
          <button
            type="button"
            onClick={onClear}
            aria-label={`Remove ${label}`}
            className="absolute right-2 top-2 rounded-full bg-white/90 p-1 text-red-500 shadow-sm transition-colors hover:bg-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}
