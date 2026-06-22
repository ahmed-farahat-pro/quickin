import arMessages from '@/messages/ar.json'
import enMessages from '@/messages/en.json'
import frMessages from '@/messages/fr.json'
import esMessages from '@/messages/es.json'
import type { Locale } from '@/i18n/config'

const messages = {
  en: enMessages,
  ar: arMessages,
  fr: frMessages,
  es: esMessages,
} as const

export type AppMessages = typeof enMessages

export function getMessages(locale: Locale): AppMessages {
  return messages[locale]
}

