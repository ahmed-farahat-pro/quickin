'use client'

import { useState, useRef, useEffect } from 'react'
import { MessageSquare, Send, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useLocale, useTranslations } from 'next-intl'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useBookingChat } from '@/hooks/use-booking-chat'
import { cn } from '@/lib/utils'

interface ChatDrawerProps {
  bookingId: string
  trigger?: React.ReactNode
}

export function ChatDrawer({ bookingId, trigger }: ChatDrawerProps) {
  const t = useTranslations('chatDrawer')
  const locale = useLocale()
  const isRtl = locale === 'ar'
  const { messages, isLoading, currentUserId, bookingDetails, sendMessage } = useBookingChat(bookingId)
  const [inputText, setInputText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isOpen])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputText.trim() || isSending) return

    setIsSending(true)
    const success = await sendMessage(inputText)
    if (success) {
      setInputText('')
    }
    setIsSending(false)
  }

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const isToday = new Date().toDateString() === date.toDateString()
    const timeStr = date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    if (isToday) return timeStr
    const datePart = date.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
    return `${datePart} - ${timeStr}`
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2 w-full mt-2">
            <MessageSquare className="h-4 w-4" />
            {t('chatWithHost')}
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md flex flex-col h-full p-6 pt-12">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle>{t('title')}</SheetTitle>
          <SheetDescription>
            {t('description')}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-4" ref={scrollRef}>
          {isLoading ? (
            <div className="flex justify-center items-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground space-y-2">
              <MessageSquare className="h-8 w-8 opacity-20" />
              <p>{t('noMessages')}</p>
              <p className="text-sm">{t('startConversation')}</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.sender_id === currentUserId
              const isAdmin = bookingDetails && msg.sender_id !== bookingDetails.guest_id && msg.sender_id !== bookingDetails.host_id
              
              let senderLabel = ""
              if (isMe) senderLabel = t('labels.you')
              else if (isAdmin) senderLabel = t('labels.admin')
              else {
                // Determine label for the other party
                const amIGuest = currentUserId === bookingDetails?.guest_id
                senderLabel = amIGuest ? t('labels.host') : t('labels.guest')
              }

              if (isAdmin) {
                return (
                  <div key={msg.id} className="flex flex-col w-full rounded-lg px-4 py-2 bg-primary text-primary-foreground text-center">
                    <span dir="auto" className="text-sm break-words whitespace-pre-wrap mb-1">{msg.message}</span>
                    <div className="flex items-center justify-center gap-2 opacity-70 text-[10px]">
                      <span className="font-medium uppercase tracking-wider">{senderLabel}</span>
                      <span>•</span>
                      <span>{formatDateTime(msg.created_at)}</span>
                    </div>
                  </div>
                )
              }

              return (
                <div
                  key={msg.id}
                  className={cn(
                    "flex flex-col min-w-[140px] max-w-[85%] rounded-lg px-4 py-2 shadow-sm",
                    isMe
                      ? "bg-primary/70 text-white self-end rounded-ee-none"
                      : "bg-muted text-foreground self-start rounded-es-none"
                  )}
                >
                  <span dir="auto" className="text-sm break-words whitespace-pre-wrap mb-1">{msg.message}</span>
                  <div className={cn(
                    "flex items-center justify-between gap-4 opacity-70 text-[10px] mt-1 border-t pt-1",
                    isMe ? "border-white/10" : "border-black/5"
                  )}>
                    <span className="font-medium">{senderLabel}</span>
                    <span className="whitespace-nowrap">{formatDateTime(msg.created_at)}</span>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <form onSubmit={handleSend} className="pt-4 pb-2 border-t flex gap-2 mt-auto">
          <Input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={t('placeholder')}
            disabled={isSending || isLoading}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={!inputText.trim() || isSending || isLoading}>
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className={cn("h-4 w-4", isRtl && "rotate-180")} />
            )}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
