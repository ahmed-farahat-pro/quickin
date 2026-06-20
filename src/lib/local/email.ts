import tls from 'node:tls'

// Minimal SMTP email sender — no npm packages (installs are throttled on this
// stack). Speaks just enough SMTP over implicit TLS (port 465) to send a plain
// message via AUTH LOGIN. Configure with env:
//   SMTP_HOST, SMTP_PORT(=465), SMTP_USER, SMTP_PASS, SMTP_FROM(optional)
// When SMTP isn't configured (or a send fails) the code is logged to the server
// console so the OTP flow still works in local dev.

interface SmtpConfig { host: string; port: number; user: string; pass: string; from: string }

function smtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (!host || !user || !pass) return null
  return {
    host,
    port: Number(process.env.SMTP_PORT || 465),
    user,
    pass,
    from: process.env.SMTP_FROM || user,
  }
}

/**
 * Send one plain-text email over implicit-TLS SMTP. Resolves on a queued (250)
 * reply, rejects on any 4xx/5xx or timeout. Handles multiline greetings by only
 * acting on the final line of each reply (a line with a space after the code).
 */
function sendSmtp(cfg: SmtpConfig, to: string, subject: string, text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const b64 = (s: string) => Buffer.from(s).toString('base64')
    const fromAddr = cfg.from.match(/<(.+)>/)?.[1] || cfg.from
    const body =
      `From: ${cfg.from}\r\nTo: ${to}\r\nSubject: ${subject}\r\n` +
      `MIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${text}\r\n.`
    // Command sequence; 334/354 continuation replies advance to the next step.
    const steps = [
      'EHLO quickin', 'AUTH LOGIN', b64(cfg.user), b64(cfg.pass),
      `MAIL FROM:<${fromAddr}>`, `RCPT TO:<${to}>`, 'DATA', body, 'QUIT',
    ]
    let stage = -1 // -1 = awaiting the server greeting
    let buf = ''

    const socket = tls.connect({ host: cfg.host, port: cfg.port, servername: cfg.host })
    socket.setEncoding('utf8')
    const timer = setTimeout(() => { socket.destroy(); reject(new Error('SMTP timeout')) }, 20_000)
    const done = (err?: Error) => { clearTimeout(timer); socket.destroy(); err ? reject(err) : resolve() }

    socket.on('error', (e) => done(e instanceof Error ? e : new Error(String(e))))
    socket.on('data', (chunk: string) => {
      buf += chunk
      let nl: number
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).replace(/\r$/, '')
        buf = buf.slice(nl + 1)
        if (!/^\d{3} /.test(line)) continue // intermediate line of a multiline reply
        if (parseInt(line.slice(0, 3), 10) >= 400) return done(new Error(`SMTP: ${line}`))
        stage++
        if (stage >= steps.length) return done() // QUIT acknowledged
        socket.write(steps[stage] + '\r\n')
      }
    })
  })
}

/** Send the 6-digit verification code, or log it when SMTP isn't configured. */
export async function sendOtpEmail(to: string, code: string): Promise<void> {
  const subject = 'Your QuickIn verification code'
  const text =
    `Your QuickIn verification code is ${code}.\n\n` +
    `It expires in 10 minutes. If you didn't request this, you can ignore this email.`
  const cfg = smtpConfig()
  if (!cfg) {
    console.log(`[OTP][dev] SMTP not configured — verification code for ${to}: ${code}`)
    return
  }
  try {
    await sendSmtp(cfg, to, subject, text)
    console.log(`[OTP] sent verification code to ${to}`)
  } catch (e) {
    // Never block signup on a mail failure; log the code so dev/testing continues.
    console.error(`[OTP] SMTP send failed for ${to}: ${e}. Code: ${code}`)
  }
}
