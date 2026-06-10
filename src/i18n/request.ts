import { getRequestConfig } from 'next-intl/server'
import { getMessages } from '@/i18n/messages'
import { getRequestLocale } from '@/i18n/request-locale'

export default getRequestConfig(async () => {
  const locale = await getRequestLocale()

  return {
    locale,
    messages: getMessages(locale),
  }
})

