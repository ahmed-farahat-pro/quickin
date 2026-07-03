'use client'

// Mobile header menu: a hamburger button that slides out a panel (shadcn Sheet)
// containing the nav links + the language switcher. Shown only on small screens.

import { useState } from 'react'
import { Menu, Home, Ticket, Heart, User, MessageCircle, LogOut, LogIn, Mail } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { LocaleSwitcher } from '@/components/layout/locale-switcher'

// Nav row: icon + label, with padding so text never sits against the edge.
const ROW =
  'flex items-center gap-3 rounded-xl px-4 py-3.5 font-semibold text-[#2A2220] transition-colors hover:bg-black/5'

export function MobileMenu({ firstName }: { firstName: string | null }) {
  const t = useTranslations('explorePage')
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label={t('nav.menu')}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[#2A2220] transition-colors hover:bg-black/5"
        >
          <Menu className="h-6 w-6" />
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[82%] max-w-xs border-l border-[#5B0F16]/10 bg-[#F6F1E6]">
        <SheetHeader>
          <SheetTitle className="text-left text-[#5B0F16]">QuickIn</SheetTitle>
        </SheetHeader>
        <nav className="mt-6 flex flex-col gap-1 px-2 text-[15px]">
          <a href="/host" onClick={close} className={ROW}>
            <Home className="h-[18px] w-[18px] shrink-0 text-[#5B0F16]" />
            {t('nav.becomeHost')}
          </a>
          {firstName ? (
            <>
              <span className="px-4 py-2 text-sm text-[#6B6055]">{t('nav.greeting', { name: firstName })}</span>
              <a href="/reservations" onClick={close} className={ROW}>
                <Ticket className="h-[18px] w-[18px] shrink-0 text-[#5B0F16]" />
                {t('nav.trips')}
              </a>
              <a href="/messages" onClick={close} className={ROW}>
                <MessageCircle className="h-[18px] w-[18px] shrink-0 text-[#5B0F16]" />
                {t('nav.messages')}
              </a>
              <a href="/saved" onClick={close} className={ROW}>
                <Heart className="h-[18px] w-[18px] shrink-0 text-[#5B0F16]" />
                {t('nav.saved')}
              </a>
              <a href="/account" onClick={close} className={ROW}>
                <User className="h-[18px] w-[18px] shrink-0 text-[#5B0F16]" />
                {t('nav.account')}
              </a>
              <a href="/contact" onClick={close} className={ROW}>
                <Mail className="h-[18px] w-[18px] shrink-0 text-[#5B0F16]" />
                {t('nav.contact')}
              </a>
              <a href="/api/auth/logout" onClick={close} className={ROW}>
                <LogOut className="h-[18px] w-[18px] shrink-0 text-[#5B0F16]" />
                {t('nav.logout')}
              </a>
            </>
          ) : (
            <>
              <a href="/messages" onClick={close} className={ROW}>
                <MessageCircle className="h-[18px] w-[18px] shrink-0 text-[#5B0F16]" />
                {t('nav.messages')}
              </a>
              <a href="/contact" onClick={close} className={ROW}>
                <Mail className="h-[18px] w-[18px] shrink-0 text-[#5B0F16]" />
                {t('nav.contact')}
              </a>
              <a href="/login" onClick={close} className={ROW}>
                <LogIn className="h-[18px] w-[18px] shrink-0 text-[#5B0F16]" />
                {t('nav.login')}
              </a>
              <a href="/signup" onClick={close} className="mt-1 rounded-full bg-[#5B0F16] px-4 py-3 text-center font-semibold text-white">
                {t('nav.signup')}
              </a>
            </>
          )}
          <div className="mt-4 border-t border-[#5B0F16]/10 px-2 pt-4">
            <LocaleSwitcher className="font-semibold text-[#2A2220]" />
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  )
}
