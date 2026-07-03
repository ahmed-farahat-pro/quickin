'use client'

// Floating WhatsApp contact button, shown on public pages. Hidden inside the
// admin consoles + auth + checkout so it doesn't clutter those flows. The
// number comes from NEXT_PUBLIC_WHATSAPP (placeholder default — swap in Vercel).
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'

// PLACEHOLDER — replace with the real WhatsApp business number (digits only,
// with country code), e.g. via NEXT_PUBLIC_WHATSAPP in Vercel.
const RAW = process.env.NEXT_PUBLIC_WHATSAPP || '201000000000'
const NUMBER = RAW.replace(/[^\d]/g, '')

// Locale prefixes we strip before matching hidden routes.
const HIDDEN_PREFIXES = ['/ops', '/admin', '/login', '/signup']

export default function WhatsAppFab() {
  const t = useTranslations('contact')
  const pathname = usePathname() || '/'
  const path = pathname.replace(/^\/(en|ar|fr|es)(?=\/|$)/, '') || '/'
  const hidden =
    HIDDEN_PREFIXES.some((p) => path === p || path.startsWith(p + '/')) ||
    /checkout|\/pay(\/|$)/.test(path)
  if (hidden) return null

  const href = `https://wa.me/${NUMBER}?text=${encodeURIComponent('Hello QuickIn 👋')}`

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t('whatsappAria')}
      style={{
        position: 'fixed',
        bottom: 22,
        insetInlineEnd: 22,
        zIndex: 900,
        width: 56,
        height: 56,
        borderRadius: 999,
        background: '#25D366',
        color: '#fff',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 8px 22px rgba(37,211,102,0.45)',
      }}
    >
      <svg viewBox="0 0 32 32" width="30" height="30" fill="currentColor" aria-hidden="true">
        <path d="M16.004 3C9.383 3 4 8.383 4 15.004c0 2.117.555 4.184 1.61 6.008L4 29l8.184-1.57a11.94 11.94 0 0 0 3.82.63h.003C22.625 28.06 28 22.676 28 16.055 28 8.43 22.625 3 16.004 3zm0 21.86h-.003a9.9 9.9 0 0 1-3.36-.586l-.24-.09-4.857.932.94-4.735-.157-.243a9.86 9.86 0 0 1-1.51-5.25c0-5.47 4.45-9.92 9.95-9.92 2.66 0 5.153 1.037 7.03 2.918a9.85 9.85 0 0 1 2.912 7.014c0 5.47-4.45 9.92-9.7 9.92zm5.46-7.42c-.3-.15-1.77-.873-2.043-.973-.273-.1-.473-.15-.673.15-.2.297-.772.97-.947 1.17-.173.198-.35.223-.648.075-.3-.15-1.263-.466-2.406-1.485-.888-.792-1.487-1.77-1.662-2.07-.173-.297-.018-.458.13-.606.134-.133.3-.347.448-.52.15-.174.2-.298.3-.497.099-.2.05-.372-.025-.52-.075-.15-.672-1.62-.922-2.22-.243-.583-.49-.504-.672-.513l-.573-.01c-.2 0-.522.074-.796.372-.273.297-1.045 1.02-1.045 2.49 0 1.47 1.07 2.89 1.22 3.09.15.198 2.105 3.213 5.1 4.505.714.308 1.27.492 1.704.63.716.228 1.368.196 1.883.12.574-.086 1.77-.723 2.02-1.42.248-.698.248-1.296.173-1.42-.074-.124-.273-.198-.573-.347z"/>
      </svg>
    </a>
  )
}
