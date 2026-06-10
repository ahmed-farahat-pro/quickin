'use client'

import { useState, useEffect } from 'react'
import { createTicket, addMessageToTicket, getUserTickets, getTicketMessages } from '@/app/actions/support-actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Plus, ArrowLeft, Send } from 'lucide-react'
import { toast } from 'sonner'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Database } from '@/types/supabase'
import { formatDistanceToNow } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

type Ticket = Database['public']['Tables']['support_tickets']['Row']
type Message = Database['public']['Tables']['support_messages']['Row']

interface SupportTicketsWidgetProps {
  config: {
    title?: { en: string; ar: string }
  }
  language: 'en' | 'ar'
}

export function SupportTicketsWidget({ config, language }: SupportTicketsWidgetProps) {
  const [user, setUser] = useState<User | null>(null)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [view, setView] = useState<'list' | 'create' | 'ticket'>('list')
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  
  const isRtl = language === 'ar'
  const defaultTitle = language === 'en' ? 'Support Tickets' : 'تذاكر الدعم'
  const title = config?.title?.[language] || config?.title?.en || config?.title?.ar || defaultTitle

  const supabase = createClient()

  useEffect(() => {
    let mounted = true

    async function checkAuthAndLoad() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!mounted) return
      
      setUser(user)
      if (user) {
        await loadTickets()
      } else {
        setIsLoading(false)
      }
    }

    checkAuthAndLoad()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        const newUser = session?.user ?? null
        setUser(newUser)
        if (newUser) {
          loadTickets()
        } else {
          setTickets([])
          setView('list')
        }
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function loadTickets() {
    setIsLoading(true)
    try {
      const data = await getUserTickets()
      if (data) setTickets(data)
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <Card className="w-full shadow-sm border">
        <CardHeader className="bg-primary/5 pb-4 border-b">
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent className="p-12 flex justify-center items-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (!user) {
    return (
      <Card className="w-full shadow-sm border text-center">
        <CardHeader className="bg-primary/5 pb-4 border-b">
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent className="p-12">
          <p className="text-muted-foreground mb-4">
            {language === 'en' 
              ? 'Please sign in to view or create support tickets.' 
              : 'يرجى تسجيل الدخول لعرض أو إنشاء تذاكر الدعم.'}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full shadow-sm border overflow-hidden">
      <CardHeader className="bg-primary/5 pb-4 border-b flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg flex items-center gap-2">
          {view !== 'list' && (
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setView('list')}>
              <ArrowLeft className={`h-4 w-4 ${isRtl ? 'rotate-180' : ''}`} />
            </Button>
          )}
          {title}
        </CardTitle>
        {view === 'list' && (
          <Button size="sm" onClick={() => setView('create')}>
            <Plus className="mr-2 h-4 w-4" />
            {language === 'en' ? 'New Ticket' : 'تذكرة جديدة'}
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-0" dir={isRtl ? 'rtl' : 'ltr'}>
        {view === 'list' && <TicketList tickets={tickets} onSelect={(t) => { setSelectedTicket(t); setView('ticket'); }} language={language} />}
        {view === 'create' && <CreateTicketForm onCreated={loadTickets} onCancel={() => setView('list')} language={language} />}
        {view === 'ticket' && selectedTicket && <TicketDetail ticket={selectedTicket} userId={user.id} language={language} />}
      </CardContent>
    </Card>
  )
}

function TicketList({ tickets, onSelect, language }: { tickets: Ticket[], onSelect: (t: Ticket) => void, language: 'en' | 'ar' }) {
  if (tickets.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        {language === 'en' ? 'No support tickets found.' : 'لا توجد تذاكر دعم.'}
      </div>
    )
  }

  return (
    <div className="divide-y">
      {tickets.map(ticket => (
        <div 
          key={ticket.id} 
          onClick={() => onSelect(ticket)}
          className="p-4 hover:bg-muted/50 cursor-pointer transition-colors flex items-center justify-between"
        >
          <div>
            <h4 className="font-medium text-sm">{ticket.subject}</h4>
            <p className="text-xs text-muted-foreground mt-1">
              {formatDistanceToNow(new Date(ticket.created_at || new Date()), { addSuffix: true })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-1 rounded-full capitalize ${ticket.status === 'open' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
              {ticket.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

function CreateTicketForm({ onCreated, onCancel, language }: { onCreated: () => void, onCancel: () => void, language: 'en' | 'ar' }) {
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!subject.trim() || !message.trim()) return

    setIsSubmitting(true)
    try {
      await createTicket(subject, message)
      toast.success(language === 'en' ? 'Ticket created successfully' : 'تم إنشاء التذكرة بنجاح')
      onCreated()
      onCancel()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">{language === 'en' ? 'Subject' : 'الموضوع'}</label>
        <Input 
          value={subject} 
          onChange={e => setSubject(e.target.value)} 
          required
          placeholder={language === 'en' ? 'Brief summary of your issue' : 'ملخص موجز لمشكلتك'}
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">{language === 'en' ? 'Message' : 'الرسالة'}</label>
        <Textarea 
          value={message} 
          onChange={e => setMessage(e.target.value)} 
          required
          className="min-h-[150px]"
          placeholder={language === 'en' ? 'Describe your issue in detail...' : 'صف مشكلتك بالتفصيل...'}
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          {language === 'en' ? 'Cancel' : 'إلغاء'}
        </Button>
        <Button type="submit" disabled={isSubmitting || !subject.trim() || !message.trim()}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {language === 'en' ? 'Submit Ticket' : 'إرسال التذكرة'}
        </Button>
      </div>
    </form>
  )
}

function TicketDetail({ ticket, userId, language }: { ticket: Ticket, userId: string, language: 'en' | 'ar' }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const isRtl = language === 'ar'

  useEffect(() => {
    loadMessages()
  }, [ticket.id])

  async function loadMessages() {
    try {
      const data = await getTicketMessages(ticket.id)
      if (data) setMessages(data)
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!newMessage.trim()) return

    setIsSending(true)
    try {
      await addMessageToTicket(ticket.id, newMessage)
      setNewMessage('')
      await loadMessages()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsSending(false)
    }
  }

  if (isLoading) {
    return <div className="p-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  }

  return (
    <div className="flex flex-col h-[500px]">
      <div className="p-4 border-b bg-muted/20">
        <h3 className="font-semibold">{ticket.subject}</h3>
        <p className="text-xs text-muted-foreground mt-1">
          {language === 'en' ? 'Status: ' : 'الحالة: '}
          <span className="capitalize font-medium">{ticket.status}</span>
        </p>
      </div>
      
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-6">
          {messages.map(msg => {
            const isMe = msg.sender_id === userId
            return (
              <div 
                key={msg.id} 
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    {isMe ? (language === 'en' ? 'You' : 'أنت') : (language === 'en' ? 'Support Staff' : 'فريق الدعم')}
                  </span>
                  <span className="text-[10px] text-muted-foreground/60">
                    {new Date(msg.created_at || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div 
                  className={`px-4 py-2 rounded-2xl max-w-[85%] text-sm whitespace-pre-wrap ${
                    isMe 
                      ? 'bg-primary text-primary-foreground rounded-tr-sm' 
                      : 'bg-muted text-foreground rounded-tl-sm'
                  }`}
                >
                  {msg.message}
                </div>
              </div>
            )
          })}
        </div>
      </ScrollArea>

      {ticket.status === 'open' && (
        <div className="p-4 border-t bg-card">
          <form onSubmit={handleSendMessage} className={`flex gap-2 ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
            <Textarea
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              placeholder={language === 'en' ? 'Type a reply...' : 'اكتب رداً...'}
              className="min-h-[80px] resize-none"
              disabled={isSending}
            />
            <Button type="submit" disabled={isSending || !newMessage.trim()} className="h-auto shrink-0 px-4">
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className={`h-4 w-4 ${isRtl ? 'rotate-180' : ''}`} />}
            </Button>
          </form>
        </div>
      )}
    </div>
  )
}
