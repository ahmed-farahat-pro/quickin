'use client'

// Mobile header menu: a hamburger button that slides out a panel (shadcn Sheet)
// containing the nav links + the language switcher. Shown only on small screens.

import { useState } from 'react'
import { Menu } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { LocaleSwitcher } from '@/components/layout/locale-switcher'

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
        <nav className="mt-6 flex flex-col gap-1 text-[15px]">
          <a href="/host" onClick={close} className="rounded-xl px-3 py-3 font-semibold text-[#2A2220] hover:bg-black/5">
            {t('nav.becomeHost')}
          </a>
          {firstName ? (
            <>
              <span className="px-3 py-2 text-sm text-[#6B6055]">{t('nav.greeting', { name: firstName })}</span>
              <a href="/api/auth/logout" onClick={close} className="rounded-xl px-3 py-3 font-semibold text-[#2A2220] hover:bg-black/5">
                {t('nav.logout')}
              </a>
            </>
          ) : (
            <>
              <a href="/login" onClick={close} className="rounded-xl px-3 py-3 font-semibold text-[#2A2220] hover:bg-black/5">
                {t('nav.login')}
              </a>
              <a href="/signup" onClick={close} className="mt-1 rounded-full bg-[#5B0F16] px-3 py-3 text-center font-semibold text-white">
                {t('nav.signup')}
              </a>
            </>
          )}
          <div className="mt-4 border-t border-[#5B0F16]/10 pt-4">
            <LocaleSwitcher className="font-semibold text-[#2A2220]" />
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  )
}
