// TEMPORARY SMTP diagnostic. Key-protected. REMOVE after use.
//   GET ?key=KEY          -> config presence + connect + AUTH LOGIN transcript (no mail sent)
//   GET ?key=KEY&to=addr  -> full send to `addr`, returns the SMTP transcript
import { NextResponse } from 'next/server'
import tls from 'node:tls'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const KEY = 'qk-maildiag-7c1f'

function mask(s?: string) {
  if (!s) return s
  const [u, d] = s.split('@')
  return d ? (u.slice(0, 2) + '***@' + d) : (s.slice(0, 2) + '***')
}

function probe(cfg: { host: string; port: number; user: string; pass: string; from: string }, to: string | null): Promise<{ transcript: string[]; error: string | null; authed: boolean; sent: boolean }> {
  return new Promise((resolve) => {
    const b64 = (s: string) => Buffer.from(s).toString('base64')
    const fromAddr = cfg.from.match(/<(.+)>/)?.[1] || cfg.from
    const transcript: string[] = []
    let authed = false, sent = false
    const body =
      `From: ${cfg.from}\r\nTo: ${to}\r\nSubject: QuickIn SMTP diagnostic\r\n` +
      `MIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nThis is a QuickIn SMTP test.\r\n.`
    const steps = to
      ? ['EHLO quickin', 'AUTH LOGIN', b64(cfg.user), b64(cfg.pass), `MAIL FROM:<${fromAddr}>`, `RCPT TO:<${to}>`, 'DATA', body, 'QUIT']
      : ['EHLO quickin', 'AUTH LOGIN', b64(cfg.user), b64(cfg.pass), 'QUIT']
    let stage = -1, buf = ''
    let socket: tls.TLSSocket
    try { socket = tls.connect({ host: cfg.host, port: cfg.port, servername: cfg.host }) }
    catch (e) { return resolve({ transcript, error: 'connect threw: ' + (e as Error).message, authed, sent }) }
    socket.setEncoding('utf8')
    const timer = setTimeout(() => { socket.destroy(); resolve({ transcript, error: 'timeout (20s)', authed, sent }) }, 20_000)
    const finish = (error: string | null) => { clearTimeout(timer); try { socket.destroy() } catch {} ; resolve({ transcript, error, authed, sent }) }
    socket.on('error', (e) => finish('socket error: ' + (e as Error).message))
    socket.on('data', (chunk: string) => {
      buf += chunk
      let nl: number
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).replace(/\r$/, ''); buf = buf.slice(nl + 1)
        if (!/^\d{3} /.test(line)) continue
        transcript.push(`<= ${line}`)
        const code = parseInt(line.slice(0, 3), 10)
        if (code >= 400) return finish(`server rejected at step ${stage + 1}: ${line}`)
        if (stage === 3) authed = true
        if (to && stage === 7) sent = true
        stage++
        if (stage >= steps.length) return finish(null)
        const shown = (stage === 2 || stage === 3) ? '<base64 credential>' : (stage === 7 ? '<message body>' : steps[stage])
        transcript.push(`=> ${shown}`)
        socket.write(steps[stage] + '\r\n')
      }
    })
  })
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  if (url.searchParams.get('key') !== KEY) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const host = process.env.SMTP_HOST, user = process.env.SMTP_USER, pass = process.env.SMTP_PASS
  const cfgPresent = !!(host && user && pass)
  const info = {
    SMTP_HOST: host || null,
    SMTP_PORT: process.env.SMTP_PORT || '(default 465)',
    SMTP_USER: mask(user),
    SMTP_FROM: process.env.SMTP_FROM ? mask(process.env.SMTP_FROM) : '(falls back to user)',
    SMTP_PASS_len: (pass || '').length,
    configured: cfgPresent,
  }
  if (!cfgPresent) return NextResponse.json({ ...info, verdict: 'SMTP_PASS is empty — set it to enable sending' })
  const to = url.searchParams.get('to')
  const cfg = { host: host!, port: Number(process.env.SMTP_PORT || 465), user: user!, pass: pass!, from: process.env.SMTP_FROM || user! }
  const r = await probe(cfg, to)
  return NextResponse.json({ ...info, testRecipient: to ? mask(to) : '(none — auth-only)', authed: r.authed, sent: r.sent, error: r.error, transcript: r.transcript })
}
