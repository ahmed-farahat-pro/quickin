import arMessages from '@/messages/ar.json'
import enMessages from '@/messages/en.json'
import type { Locale } from '@/i18n/config'

const messages = {
  en: enMessages,
  ar: arMessages,
} as const

export type AppMessages = typeof enMessages

export function getMessages(locale: Locale): AppMessages {
  return messages[locale]
}

