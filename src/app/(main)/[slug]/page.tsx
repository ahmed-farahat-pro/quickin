import { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
import { getLocale } from 'next-intl/server'
import { DynamicPageRenderer } from '@/components/features/cms/dynamic-page-renderer'
import { TermsPage } from './terms-content'

interface PageProps {
  params: Promise<{ slug: string }>
}

// Built-in content for the standard info / legal / hosting pages linked from the
// footer. Rendered when there is no CMS (custom_pages) entry — so these links never
// 404. When a Supabase CMS is configured, published custom_pages still take priority.
const INFO_PAGES: Record<string, { title: string; body: string[] }> = {
  about: {
    title: 'About QuickIn',
    body: [
      'QuickIn is a boutique stay platform connecting travelers with a carefully curated collection of homes, chalets, and villas across Egypt’s coast and beyond.',
      'We believe a great trip starts with a great place to stay. Every listing is reviewed for quality, and every host is verified — so you can book with confidence and arrive feeling at home.',
    ],
  },
  help: {
    title: 'Help Center',
    body: [
      'Need a hand? Most questions about booking, payments, check-in, and cancellations are answered here.',
      'Booking is simple: find a stay, choose your dates and guests, and send a request. The host approves it, you pay securely, and your reservation is confirmed. You can track every reservation from your account.',
      'Still stuck? Reach our team any time at support@quickin.app.',
    ],
  },
  safety: {
    title: 'Safety Information',
    body: [
      'Your safety comes first. Hosts complete identity verification, payments are processed securely, and our team is available around the clock.',
      'Always communicate and pay through QuickIn — it keeps your trip protected. If anything ever feels off, report it and we’ll step in.',
    ],
  },
  cancellation: {
    title: 'Cancellation Options',
    body: [
      'Each stay sets its own cancellation policy — flexible, moderate, or strict — shown clearly on the listing before you book.',
      'Flexible: full refund up to 24 hours before check-in. Moderate: full refund up to 5 days before. Strict: 50% refund up to 7 days before.',
      'You can cancel any reservation from your account, and any refund follows the policy that applied when you booked.',
    ],
  },
  report: {
    title: 'Report a Concern',
    body: [
      'If a listing, message, or stay doesn’t feel right, let us know. Reports are confidential and reviewed by our trust & safety team.',
      'Email the details to support@quickin.app and we’ll follow up promptly.',
    ],
  },
  host: {
    title: 'Become a Host',
    body: [
      'Share your space and earn on your terms. List your home, set your nightly price and house rules, and decide which requests to approve.',
      'Hosting on QuickIn means verified guests, secure payouts, and a team that has your back.',
    ],
  },
  resources: {
    title: 'Host Resources',
    body: [
      'Everything you need to host with confidence — pricing tips, photography guidance, and best practices for great reviews.',
      'A well-presented listing with clear photos and honest details books faster and earns happier guests.',
    ],
  },
  community: {
    title: 'Community Forum',
    body: [
      'Connect with fellow hosts and travelers, swap tips, and share what makes a stay memorable.',
      'Our community is built on hospitality and respect. Be kind, be honest, and help each other travel better.',
    ],
  },
  'responsible-hosting': {
    title: 'Hosting Responsibly',
    body: [
      'Great hosting means safe, accurate, and welcoming stays. Keep your listing details truthful, follow local rules and regulations, and respect your neighbors.',
      'Provide working smoke detectors, clear check-in instructions, and a clean, well-maintained space.',
    ],
  },
  about_us: { title: 'About QuickIn', body: ['QuickIn connects travelers with curated boutique stays.'] },
  newsroom: {
    title: 'Newsroom',
    body: [
      'News, updates, and stories from QuickIn.',
      'For press inquiries, reach us at press@quickin.app.',
    ],
  },
  careers: {
    title: 'Careers',
    body: [
      'We’re building a better way to travel, and we’re always looking for thoughtful, curious people to join us.',
      'Interested? Send your CV and a note about what you’d love to work on to careers@quickin.app.',
    ],
  },
  contact: {
    title: 'Contact Us',
    body: [
      'We’d love to hear from you. Reach the QuickIn team by email, phone, or WhatsApp — we usually reply within a few hours.',
    ],
  },
  terms: {
    title: 'Terms & Conditions',
    body: [
      'Welcome to QuickIn. By using our platform you agree to these terms, which govern how you browse, book, and host stays.',
      'QuickIn provides a marketplace connecting guests and hosts; the booking contract is between the guest and the host. We facilitate secure payments and provide support, but we are not the owner of the listed properties.',
      'You agree to provide accurate information, use the platform lawfully, and respect other members of the community. This summary is provided for demonstration purposes.',
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    body: [
      'Your privacy matters to us. We collect only the information needed to provide and improve QuickIn — such as your account details, bookings, and how you use the service.',
      'We never sell your personal data. Payment details are handled securely, and you can request access to or deletion of your data at any time.',
      'This summary is provided for demonstration purposes.',
    ],
  },
  sitemap: {
    title: 'Sitemap',
    body: [
      'Explore boutique stays, manage your reservations, and verify your identity — all from one place.',
      'Main areas: Explore stays, My reservations, Identity verification, Log in, and Sign up.',
    ],
  },
}

function humanize(slug: string) {
  return slug.replace(/[-/]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// Contact methods block (email / phone / WhatsApp). Values come from env with
// clearly-marked PLACEHOLDER defaults — set NEXT_PUBLIC_* in Vercel to swap.
function ContactMethods() {
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'support@quickin.app'
  const phoneRaw = process.env.NEXT_PUBLIC_CONTACT_PHONE || '+20 100 000 0000'
  const waRaw = process.env.NEXT_PUBLIC_WHATSAPP || '201000000000'
  const wa = waRaw.replace(/[^\d]/g, '')
  const tel = phoneRaw.replace(/[^\d+]/g, '')
  const rows: { label: string; value: string; href: string }[] = [
    { label: 'Email', value: email, href: `mailto:${email}` },
    { label: 'Phone', value: phoneRaw, href: `tel:${tel}` },
    { label: 'WhatsApp', value: phoneRaw, href: `https://wa.me/${wa}` },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, margin: '8px 0 4px' }}>
      {rows.map((r) => (
        <a
          key={r.label}
          href={r.href}
          target={r.label === 'WhatsApp' ? '_blank' : undefined}
          rel={r.label === 'WhatsApp' ? 'noopener noreferrer' : undefined}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            background: '#fff',
            border: '1px solid rgba(42,34,32,0.10)',
            borderRadius: 14,
            padding: '14px 18px',
            textDecoration: 'none',
            color: '#2A2220',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, color: '#6B6055' }}>{r.label}</span>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#5B0F16' }}>{r.value}</span>
        </a>
      ))}
    </div>
  )
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const info = INFO_PAGES[slug]
  if (info) return { title: `${info.title} | QuickIn` }

  const supabase = await createClient()
  if (supabase) {
    const { data: page } = await supabase
      .from('custom_pages')
      .select('title')
      .eq('slug', slug)
      .eq('is_published', true)
      .single()
    if (page) {
      const titleObj = page.title as Record<string, string>
      const locale = await getLocale()
      return { title: `${titleObj[locale] || titleObj.en || titleObj.ar || 'Page'} | QuickIn` }
    }
  }
  return { title: `${humanize(slug)} | QuickIn` }
}

export default async function CustomPage({ params }: PageProps) {
  const { slug } = await params

  // Aliases that should just go to a real route.
  if (slug === 'listings') redirect('/explore')

  const locale = (await getLocale()) as 'en' | 'ar'

  // Terms & Conditions — the full guest/tenant agreement (Arabic + English),
  // rendered from the legal source, not the generic info fallback.
  if (slug === 'terms') return <TermsPage locale={locale} />

  // 1. Published CMS page wins when Supabase is configured.
  const supabase = await createClient()
  if (supabase) {
    const { data: page } = await supabase
      .from('custom_pages')
      .select('*')
      .eq('slug', slug)
      .eq('is_published', true)
      .single()
    if (page) {
      const titleObj = page.title as Record<string, string>
      const title = titleObj[locale] || titleObj.en || titleObj.ar
      return (
        <div className="container mx-auto py-12 px-4 max-w-4xl">
          <h1 className="text-4xl font-bold mb-8">{title}</h1>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <DynamicPageRenderer content={page.content as any[]} language={locale} />
        </div>
      )
    }
  }

  // 2. Built-in info content, or a clean branded placeholder — never a hard 404.
  const info = INFO_PAGES[slug]
  const title = info?.title || humanize(slug)
  const body = info?.body || [
    'We’re putting the finishing touches on this page. In the meantime, explore our boutique stays.',
  ]

  return (
    <article style={{ maxWidth: 760, margin: '0 auto', padding: '56px 24px 80px' }}>
      <h1
        style={{
          fontFamily: '"Playfair Display", Georgia, serif',
          fontSize: 'clamp(28px, 5vw, 40px)',
          fontWeight: 700,
          color: '#5B0F16',
          margin: '0 0 24px',
        }}
      >
        {title}
      </h1>
      {body.map((p, i) => (
        <p key={i} style={{ fontSize: 16, lineHeight: 1.7, color: '#3a3330', margin: '0 0 18px' }}>
          {p}
        </p>
      ))}

      {slug === 'contact' && <ContactMethods />}

      <div style={{ marginTop: 36 }}>
        <Link
          href="/explore"
          style={{
            display: 'inline-block',
            background: '#5B0F16',
            color: '#fff',
            fontWeight: 700,
            textDecoration: 'none',
            borderRadius: 999,
            padding: '12px 28px',
          }}
        >
          Back to Explore
        </Link>
      </div>
    </article>
  )
}
