'use client'

import ReactMarkdown from 'react-markdown'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { AIChatbotWidget } from './widgets/ai-chatbot-widget'
import { SupportTicketsWidget } from './widgets/support-tickets-widget'

export function DynamicPageRenderer({ content, language }: { content: any[], language: 'en' | 'ar' }) {
  if (!Array.isArray(content)) {
    // Fallback for non-migrated single string or object content (should be migrated, but just in case)
    let fallbackText = ''
    if (typeof content === 'string') {
      fallbackText = content
    } else if (content && typeof content === 'object') {
      fallbackText = content[language] || content['en'] || content['ar'] || ''
    }

    return (
      <div className="prose dark:prose-invert max-w-none">
        <ReactMarkdown>{fallbackText}</ReactMarkdown>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      {content.map((widget) => {
        if (widget.type === 'markdown') {
          return (
            <div key={widget.id} className="prose dark:prose-invert max-w-none">
              <ReactMarkdown>{widget.content[language] || widget.content.en || widget.content.ar || ''}</ReactMarkdown>
            </div>
          )
        }
        if (widget.type === 'faq') {
          return (
            <Accordion key={widget.id} type="single" collapsible className="w-full">
              {widget.items?.map((item: any, i: number) => (
                <AccordionItem key={`${widget.id}-${i}`} value={`item-${i}`}>
                  <AccordionTrigger className="text-left font-medium text-lg">
                    {item.question[language] || item.question.en || item.question.ar || ''}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground leading-relaxed">
                    {item.answer[language] || item.answer.en || item.answer.ar || ''}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )
        }
        if (widget.type === 'ai_chatbot') {
          return (
            <div key={widget.id} className="w-full max-w-3xl mx-auto">
              <AIChatbotWidget config={widget.config} language={language} />
            </div>
          )
        }
        if (widget.type === 'support_tickets') {
          return (
            <div key={widget.id} className="w-full max-w-3xl mx-auto">
              <SupportTicketsWidget config={widget.config} language={language} />
            </div>
          )
        }
        return null;
      })}
    </div>
  )
}
