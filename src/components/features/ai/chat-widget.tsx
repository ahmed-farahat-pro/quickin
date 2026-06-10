'use client'

import { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send, Sparkles } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useUIStore } from '@/stores'
import type { Locale } from '@/i18n/config'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export function ChatWidget() {
  const locale = useLocale() as Locale
  const t = useTranslations('chat')
  const { isChatOpen, toggleChat, closeChat } = useUIStore()
  const suggestedPrompts = [
    t('suggested.beach'),
    t('suggested.included'),
    t('suggested.destination'),
    t('suggested.plan'),
  ]
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: t('welcome'),
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          context: {
            currentPage: window.location.pathname,
            locale,
          },
        }),
      })

      const data = await response.json()

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || data.error || t('fallbackError'),
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: t('networkError'),
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSuggestedPrompt = (prompt: string) => {
    setInput(prompt)
  }

  const isRtl = locale === 'ar'

  return (
    <>
      {/* Floating Button */}
      <Button
        onClick={toggleChat}
        className={`fixed bottom-6 z-50 h-14 w-14 rounded-full shadow-lg transition-all duration-300 ${
          isRtl ? 'left-6' : 'right-6'
        } ${
          isChatOpen ? 'scale-0' : 'scale-100'
        }`}
        size='icon'
        aria-label={isChatOpen ? t('ariaCloseChat') : t('ariaOpenChat')}
      >
        <MessageCircle className='h-6 w-6' />
      </Button>

      {/* Chat Window */}
      <div
        className={`fixed bottom-6 z-50 w-[calc(100vw-3rem)] sm:w-[380px] h-[calc(100vh-8rem)] sm:h-[550px] max-h-[700px] bg-background border rounded-2xl shadow-2xl flex flex-col transition-all duration-300 ${
          isRtl ? 'left-6 origin-bottom-left' : 'right-6 origin-bottom-right'
        } ${
          isChatOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
        }`}
      >
        {/* Header */}
        <div className='flex items-center justify-between p-4 border-b bg-primary/5 rounded-t-2xl'>
          <div className='flex items-center gap-2'>
            <div className='h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center'>
              <Sparkles className='h-5 w-5 text-primary' />
            </div>
            <div>
              <h3 className='font-semibold'>{t('title')}</h3>
              <p className='text-xs text-muted-foreground'>{t('poweredBy')}</p>
            </div>
          </div>
          <Button variant='ghost' size='icon' onClick={closeChat} className='rounded-full' aria-label={t('ariaCloseChat')}>
            <X className='h-5 w-5' />
          </Button>
        </div>

        {/* Messages */}
        <ScrollArea className='flex-1 p-4' ref={scrollRef}>
          <div className='space-y-4'>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <p className='text-sm whitespace-pre-wrap'>{message.content}</p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className='flex justify-start'>
                <div className='bg-muted rounded-2xl px-4 py-2.5'>
                  <div className='flex gap-1'>
                    <span className='h-2 w-2 bg-muted-foreground/50 rounded-full animate-bounce' />
                    <span className='h-2 w-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:0.2s]' />
                    <span className='h-2 w-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:0.4s]' />
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Suggested Prompts */}
        {messages.length === 1 && (
          <div className='px-4 pb-2'>
            <div className='flex flex-wrap gap-2'>
              {suggestedPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleSuggestedPrompt(prompt)}
                  className='text-xs bg-muted hover:bg-muted/80 rounded-full px-3 py-1.5 transition-colors'
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleSubmit} className='p-4 border-t'>
          <div className='flex gap-2'>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('placeholder')}
              className='rounded-full'
              disabled={isLoading}
            />
            <Button
              type='submit'
              size='icon'
              className='rounded-full shrink-0'
              disabled={!input.trim() || isLoading}
              aria-label={t('ariaSendMessage')}
            >
              <Send className='h-4 w-4' />
            </Button>
          </div>
        </form>
      </div>
    </>
  )
}
