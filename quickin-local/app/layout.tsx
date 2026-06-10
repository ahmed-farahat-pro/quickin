import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'QuickIn — Local',
  description: 'Browse boutique stays. Local Next.js + PostgreSQL demo.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
