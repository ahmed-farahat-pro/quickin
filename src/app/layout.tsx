import type { Metadata } from "next";
import { DM_Sans, Playfair_Display, Noto_Sans_Arabic, Amiri, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from 'next-intl'
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { GlobalLoadingBar } from "@/components/ui/global-loading-bar";
import { RouteProgressBar } from "@/components/ui/route-progress-bar";
import { getDirection, type Locale } from '@/i18n/config'
import { getMessages } from '@/i18n/messages'
import { getRequestLocale } from '@/i18n/request-locale'
import { AppDirectionProvider } from '@/components/providers/app-direction-provider'
import { AuthNotification } from '@/components/features/auth/auth-notification'
import { getBaseUrl } from "@/lib/utils";

// Body fonts
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

const notoSansArabic = Noto_Sans_Arabic({
  variable: "--font-noto-sans-arabic",
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

// Hero headline fonts
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});

const amiri = Amiri({
  variable: "--font-amiri",
  subsets: ["arabic", "latin"],
  weight: ["400", "700"],
  display: "swap",
});

// Mono font
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const baseUrl = getBaseUrl();

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "QuickIn - Find It. Book It. Live It.",
    template: "%s | QuickIn",
  },
  description: "Curated stays for slow travelers. Handpicked homes designed for comfort, beauty, and calm.",
  keywords: ["vacation rentals", "boutique stays", "travel", "accommodation", "curated homes", "Egypt"],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: baseUrl,
    title: "QuickIn - Find It. Book It. Live It.",
    description: "Curated stays for slow travelers. Handpicked homes designed for comfort, beauty, and calm.",
    siteName: "QuickIn",
    images: [
      {
        url: "/logo-icon.png",
        width: 800,
        height: 600,
        alt: "QuickIn Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "QuickIn - Find It. Book It. Live It.",
    description: "Curated stays for slow travelers. Handpicked homes designed for comfort, beauty, and calm.",
    images: ["/logo-icon.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>)
{
  const localePromise = getRequestLocale()

  return <RootLayoutInner localePromise={localePromise}>{children}</RootLayoutInner>
}

async function RootLayoutInner({
  children,
  localePromise,
}: Readonly<{
  children: React.ReactNode;
  localePromise: Promise<Locale>;
}>)
{
  const locale = await localePromise
  const messages = getMessages(locale)
  const dir = getDirection(locale)

  return (
    <html lang={locale} dir={dir} className={`${dmSans.variable} ${notoSansArabic.variable} ${playfair.variable} ${amiri.variable} ${geistMono.variable}`}>
      <body
        className="font-sans antialiased min-h-screen flex flex-col"
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          <AppDirectionProvider dir={dir}>
            <RouteProgressBar />
            <GlobalLoadingBar />
            <AuthNotification />
            {children}
            <Toaster position="top-center" />
          </AppDirectionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
