'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ShieldCheck, Clock, ShieldAlert, XCircle, UploadCloud, Loader2 } from 'lucide-react'

type Status = 'loading' | 'guest' | 'unverified' | 'pending' | 'verified' | 'rejected'

/**
 * Self-contained identity-verification panel for the live (Supabase-free) web app.
 * Talks to the node-pg backend the mobile apps also use:
 *   GET  /api/local/verification               → current status (qk_token cookie)
 *   POST /api/local/verification { doc, … }     → submit ID photo for admin review
 *   POST /api/id-scan { image }                 → best-effort auto-read (StructOCR)
 *
 * Auto-scan is attempted first; whether or not it reads the number, the photo is
 * saved as a pending submission for an admin to verify in the admin panel.
 */
export function IdVerificationPanel() {
  const [status, setStatus] = useState<Status>('loading')
  const [notes, setNotes] = useState<string | null>(null)
  const [idNumber, setIdNumber] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null) // data URL of the picked photo
  const [scanMsg, setScanMsg] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      const res = await fetch('/api/local/verification', { credentials: 'same-origin', cache: 'no-store' })
      if (res.status === 401) return setStatus('guest')
      const d = await res.json()
      setStatus((d.status as Status) || 'unverified')
      setNotes(d.notes || null)
      setIdNumber(d.id_number || null)
    } catch {
      setStatus('unverified')
    }
  }
  useEffect(() => { load() }, [])

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null); setScanMsg(null)
    const reader = new FileReader()
    reader.onload = () => setPreview(typeof reader.result === 'string' ? reader.result : null)
    reader.readAsDataURL(file)
  }

  async function submit() {
    if (!preview) return
    setSubmitting(true); setError(null); setScanMsg(null)
    const base64 = preview.includes(',') ? preview.split(',')[1] : preview

    // 1) Best-effort auto-scan (fills the ID number when it can read the card).
    let source = 'manual'
    let id_number: string | null = null
    let full_name: string | null = null
    try {
      const scan = await fetch('/api/id-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 }),
      }).then((r) => r.json())
      if (scan?.success && scan?.id_number) {
        source = 'structocr'; id_number = scan.id_number; full_name = scan.full_name ?? null
        setScanMsg(`Auto-detected ID ${scan.id_number} — submitting for confirmation.`)
      } else {
        setScanMsg("Couldn't auto-read the card — submitting for manual review.")
      }
    } catch {
      setScanMsg('Submitting for manual review.')
    }

    // 2) Always save the photo as a pending submission for the admin.
    try {
      const res = await fetch('/api/local/verification', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doc: preview, id_number, full_name, source }),
      })
      if (res.status === 401) { setError('Please sign in to submit your ID.'); return }
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error || 'Upload failed. Please try again.')
      }
      setPreview(null)
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
          Upload a clear photo of your National ID. We&apos;ll try to read it automatically; if not,
          our team verifies it manually.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status === 'verified' && (
          <p className="text-sm text-green-700">Your identity is verified{idNumber ? ` (ID ${idNumber})` : ''}. Nothing more to do.</p>
        )}
        {status === 'pending' && (
          <p className="text-sm text-yellow-700">Thanks! Your ID is in review — an admin will approve it shortly.</p>
        )}
        {status === 'rejected' && notes && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <span className="font-medium">Rejected:</span> {notes}. Please re-upload a clearer photo.
          </div>
        )}
        {status === 'guest' && (
          <p className="text-sm text-muted-foreground">Please sign in first, then upload your ID here.</p>
        )}

        {canSubmit && (
          <div className="space-y-3">
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 p-6 text-center transition-colors hover:bg-muted/50">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="ID preview" className="max-h-48 rounded-lg object-contain" />
              ) : (
                <>
                  <UploadCloud className="h-8 w-8 text-primary/70" />
                  <span className="text-sm font-medium">Choose or take a photo of your ID</span>
                  <span className="text-xs text-muted-foreground">JPG or PNG</span>
                </>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={onPick} disabled={submitting} />
            </label>

            {scanMsg && <p className="text-xs text-muted-foreground">{scanMsg}</p>}
            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button onClick={submit} disabled={!preview || submitting} className="w-full">
              {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting…</> : 'Submit for verification'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
