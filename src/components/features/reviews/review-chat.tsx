'use client'

import { useState, useTransition } from 'react'
import { Send, Loader2, User, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { addPrivateChatMessage } from '@/lib/supabase/reviews'
import { toast } from 'sonner'
import type { PrivateMessage } from '@/types/database'
import { useTranslations, useFormatter } from 'next-intl'

interface ReviewChatProps
{
    reviewId: string
    messages: PrivateMessage[]
    userRole: 'admin' | 'host' | 'guest'
}

export function ReviewChat({ reviewId, messages, userRole }: ReviewChatProps)
{
    const t = useTranslations('reviews.chat')
    const format = useFormatter()
    const [reply, setReply] = useState('')
    const [isPending, startTransition] = useTransition()

    const handleSend = () =>
    {
        if (!reply.trim()) return

        startTransition(async () =>
        {
            const result = await addPrivateChatMessage(reviewId, reply, userRole)
            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success(t('send'))
                setReply('')
            }
        })
    }

    return (
        <div className="bg-muted/50 rounded-lg border overflow-hidden">
            <div className="p-2 bg-muted border-b flex items-center justify-between">
                <span className="font-semibold text-muted-foreground uppercase text-[10px] flex items-center gap-1.5">
                    {t('threadTitle')}
                </span>
                <span className="text-[10px] text-muted-foreground italic">
                    {t('visibilityInfo')}
                </span>
            </div>

            <div className="p-3 space-y-3 max-h-[300px] overflow-y-auto">
                {messages.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2 italic">
                        {t('noFeedback')}
                    </p>
                ) : (
                    messages.map((msg, i) => (
                        <div
                            key={i}
                            className={`flex flex-col gap-1 ${msg.role === userRole ? 'items-end' : 'items-start'
                                }`}
                        >
                            <div
                                className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs shadow-sm ${msg.role === userRole
                                    ? 'bg-primary text-primary-foreground rounded-tr-none'
                                    : 'bg-background border rounded-tl-none'
                                    }`}
                            >
                                <div className="flex items-center gap-1.5 mb-1 opacity-80 font-bold uppercase text-[9px]">
                                    {msg.role === 'guest' ? (
                                        <User className="h-2.5 w-2.5" />
                                    ) : (
                                        <ShieldCheck className="h-2.5 w-2.5" />
                                    )}
                                    {msg.role}
                                </div>
                                <p className="leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                                <div className={`text-[8px] mt-1.5 opacity-60 ${msg.role === userRole ? 'text-right' : 'text-left'}`}>
                                    {format.dateTime(new Date(msg.created_at), { month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' })}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="p-2 bg-background border-t flex gap-2">
                <Textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder={t('typeReply')}
                    className="min-h-[40px] h-[40px] text-xs resize-none bg-muted/20 border-none focus-visible:ring-0"
                    onKeyDown={(e) =>
                    {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            handleSend()
                        }
                    }}
                />
                <Button
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    disabled={isPending || !reply.trim()}
                    onClick={handleSend}
                >
                    {isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Send className="h-4 w-4" />
                    )}
                </Button>
            </div>
        </div>
    )
}
