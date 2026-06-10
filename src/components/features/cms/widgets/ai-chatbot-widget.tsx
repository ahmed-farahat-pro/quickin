'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'

interface AIChatbotWidgetProps {
  config: {
    prompt?: string
    title?: { en: string; ar: string }
  }
  language: 'en' | 'ar'
}

type Message = { id: string; role: 'user' | 'assistant'; content: string }

export function AIChatbotWidget({ config, language }: AIChatbotWidgetProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const isRtl = language === 'ar'
  
  const title = config?.title?.[language] || config?.title?.en || config?.title?.ar || 
                (language === 'en' ? 'How can we help?' : 'كيف يمكننا مساعدتك؟')

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }, [messages])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: input }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/ai/help-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          systemPrompt: config?.prompt
        })
      })

      if (!response.body) throw new Error('No response body')
      
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let assistantMessage = ''
      
      setMessages(prev => [...prev, { id: Date.now().toString() + 'a', role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        const chunk = decoder.decode(value, { stream: true })
        
        // Vercel AI SDK toTextStreamResponse emits formatted chunks. Usually starting with '0:' for text.
        // We will do a simple parse of lines starting with '0:'
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (line.startsWith('0:')) {
            try {
              assistantMessage += JSON.parse(line.substring(2))
            } catch (e) {
              assistantMessage += line.substring(3).replace(/"/g, '') // Fallback
            }
          } else if (!line.match(/^[0-9]+:/) && line.trim()) {
            assistantMessage += chunk // if it's not a standard stream format, append it
            break;
          }
        }
        
        setMessages(prev => {
          const newMessages = [...prev]
          newMessages[newMessages.length - 1].content = assistantMessage
          return newMessages
        })
      }
    } catch (error) {
      console.error(error)
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: language === 'en' ? 'An error occurred.' : 'حدث خطأ.' }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full shadow-sm border overflow-hidden">
      <CardHeader className="bg-primary/5 pb-4 border-b">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bot className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px] w-full p-4" ref={scrollAreaRef}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4 text-muted-foreground p-8">
              <Bot className="h-12 w-12 opacity-20" />
              <p>{language === 'en' ? "Hi! I'm your AI assistant. Ask me anything." : "مرحباً! أنا المساعد الذكي. اسألني أي شيء."}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((m: any) => (
                <div 
                  key={m.id} 
                  className={`flex gap-3 ${m.role === 'user' ? (isRtl ? 'flex-row-reverse' : 'flex-row-reverse') : (isRtl ? 'flex-row' : 'flex-row')}`}
                  dir={isRtl ? 'rtl' : 'ltr'}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    {m.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>
                  <div 
                    className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                      m.role === 'user' 
                        ? 'bg-primary text-primary-foreground rounded-tr-sm' 
                        : 'bg-muted rounded-tl-sm text-foreground'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.content}</p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className={`flex gap-3 ${isRtl ? 'flex-row' : 'flex-row'}`} dir={isRtl ? 'rtl' : 'ltr'}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-muted">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-foreground/50 rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 bg-foreground/50 rounded-full animate-bounce delay-75"></div>
                    <div className="w-1.5 h-1.5 bg-foreground/50 rounded-full animate-bounce delay-150"></div>
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
        
        <div className="p-4 border-t bg-card">
          <form 
            onSubmit={handleSubmit} 
            className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}
            dir={isRtl ? 'rtl' : 'ltr'}
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={language === 'en' ? "Type your message..." : "اكتب رسالتك هنا..."}
              className={`flex-1 rounded-full ${isRtl ? 'text-right' : 'text-left'}`}
              disabled={isLoading}
            />
            <Button 
              type="submit" 
              size="icon" 
              disabled={isLoading || !input.trim()} 
              className="rounded-full h-10 w-10 shrink-0"
            >
              <Send className={`h-4 w-4 ${isRtl ? 'rotate-180' : ''}`} />
              <span className="sr-only">Send</span>
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  )
}
