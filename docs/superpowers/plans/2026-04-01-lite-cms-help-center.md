# Lite-CMS and Help Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the custom pages system into a widget-based Lite-CMS, and build a dynamic 3-layer Help Center including an inline AI chatbot and an async support ticket system.

**Architecture:** We will migrate the `custom_pages.content` column to JSONB to store an ordered array of widgets. The admin interface will be upgraded with `@dnd-kit` to support reordering these widgets. The frontend `/help` page will dynamically render these widgets (Markdown, FAQ, AI Chatbot, Support Tickets). The Async Support system adds two new tables for tracking tickets and messages.

**Tech Stack:** Next.js (App Router), Supabase (PostgreSQL, JSONB), Shadcn UI, `@dnd-kit` for drag-and-drop, Tailwind CSS, Zod, React Hook Form, AI SDK (Gemini).

---

### Task 1: Database Migration for CMS and Support Tickets

**Files:**
- Create: `supabase/migrations/<timestamp>_lite_cms_and_support.sql`

- [ ] **Step 1: Write the migration script**
Create a new migration file to modify `custom_pages` and add support tables.

```sql
-- 1. Modify custom_pages table to use JSONB instead of JSON (if not already) or just migrate existing data.
-- Assuming 'content' is already JSON in the database, we'll write a script to wrap existing plain text/simple json into the new widget array format.

UPDATE public.custom_pages
SET content = jsonb_build_array(
  jsonb_build_object(
    'id', gen_random_uuid(),
    'type', 'markdown',
    'content', content
  )
)
WHERE jsonb_typeof(content) != 'array';

-- 2. Create support_tickets table
CREATE TABLE public.support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create support_messages table
CREATE TABLE public.support_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Null implies system or admin if we don't link directly to staff_profiles
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. RLS Policies for support_tickets
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own tickets" ON public.support_tickets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own tickets" ON public.support_tickets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own tickets" ON public.support_tickets FOR UPDATE USING (auth.uid() = user_id);

-- 5. RLS Policies for support_messages
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view messages of their tickets" ON public.support_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.support_tickets st WHERE st.id = ticket_id AND st.user_id = auth.uid())
);
CREATE POLICY "Users can insert messages to their tickets" ON public.support_messages FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.support_tickets st WHERE st.id = ticket_id AND st.user_id = auth.uid())
  AND auth.uid() = sender_id
);
```

- [ ] **Step 2: Run the migration**
Run: `npm run supabase migration up` (or appropriate Supabase CLI command like `npx supabase db push` / `npx supabase db reset` depending on local setup). Ensure the local DB reflects the changes.

- [ ] **Step 3: Update Types**
Run the Supabase types generator to update `src/types/supabase.ts`.
Run: `npx supabase gen types typescript --local > src/types/supabase.ts`

- [ ] **Step 4: Commit**
```bash
git add supabase/migrations/ src/types/supabase.ts
git commit -m "feat: add lite-cms json schema and async support tables"
```

---

### Task 2: Refactor `PageEditor` for Widget Array support

**Files:**
- Modify: `src/app/admin/settings/site/pages/[id]/_components/page-editor.tsx`
- Modify: `package.json`

- [ ] **Step 1: Install `@dnd-kit`**
Run: `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`

- [ ] **Step 2: Update Zod Schema**
In `page-editor.tsx`, update the `content` schema to expect an array of widgets.

```typescript
const widgetSchema = z.discriminatedUnion('type', [
  z.object({
    id: z.string(),
    type: z.literal('markdown'),
    content: z.object({ en: z.string(), ar: z.string() })
  }),
  z.object({
    id: z.string(),
    type: z.literal('faq'),
    items: z.array(z.object({
      question: z.object({ en: z.string(), ar: z.string() }),
      answer: z.object({ en: z.string(), ar: z.string() })
    }))
  }),
  z.object({
    id: z.string(),
    type: z.literal('ai_chatbot'),
    config: z.object({
      prompt: z.string().optional(),
      title: z.object({ en: z.string(), ar: z.string() }).optional()
    })
  }),
  z.object({
    id: z.string(),
    type: z.literal('support_tickets'),
    config: z.object({
      title: z.object({ en: z.string(), ar: z.string() }).optional()
    })
  })
])

// inside pageSchema
content: z.array(widgetSchema).default([]),
```

- [ ] **Step 3: Build the Draggable Widget List UI**
Replace the static `ContentEditor` with a list that maps over `form.watch('content')`. Wrap it in a `DndContext` and `SortableContext` from `@dnd-kit`. Create a custom SortableItem component for each widget type, rendering inputs based on `type`. Provide an "Add Widget" dropdown to append to the array.

- [ ] **Step 4: Commit**
```bash
git add package.json package-lock.json src/app/admin/settings/site/pages/[id]/_components/page-editor.tsx
git commit -m "feat: add dnd-kit and refactor PageEditor to support widget arrays"
```

---

### Task 3: Build Dynamic Frontend Renderer for Custom Pages

**Files:**
- Create: `src/components/features/cms/dynamic-page-renderer.tsx`
- Modify: `src/app/[slug]/page.tsx` (or wherever custom pages are rendered frontend-side, assume `src/app/[slug]/page.tsx` or similar).

- [ ] **Step 1: Create `dynamic-page-renderer.tsx`**

```tsx
import ReactMarkdown from 'react-markdown'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
// Import Chatbot and Support widgets later

export function DynamicPageRenderer({ content, language }: { content: any[], language: 'en' | 'ar' }) {
  return (
    <div className="flex flex-col gap-8">
      {content.map((widget) => {
        if (widget.type === 'markdown') {
          return <ReactMarkdown key={widget.id} className="prose dark:prose-invert max-w-none">{widget.content[language]}</ReactMarkdown>
        }
        if (widget.type === 'faq') {
          return (
            <Accordion key={widget.id} type="single" collapsible className="w-full">
              {widget.items.map((item: any, i: number) => (
                <AccordionItem key={i} value={`item-${i}`}>
                  <AccordionTrigger>{item.question[language]}</AccordionTrigger>
                  <AccordionContent>{item.answer[language]}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )
        }
        if (widget.type === 'ai_chatbot') {
          return <div key={widget.id} className="ai-chatbot-placeholder border p-4">AI Chatbot Placeholder</div>
        }
        if (widget.type === 'support_tickets') {
          return <div key={widget.id} className="support-tickets-placeholder border p-4">Support Tickets Placeholder</div>
        }
        return null;
      })}
    </div>
  )
}
```

- [ ] **Step 2: Integrate into public page view**
Find the route responsible for displaying custom pages (e.g. `src/app/pages/[slug]/page.tsx` or `src/app/(main)/[slug]/page.tsx`) and replace the old `ReactMarkdown` render with `<DynamicPageRenderer content={page.content as any[]} language={locale} />`.

- [ ] **Step 3: Commit**
```bash
git add src/components/features/cms/dynamic-page-renderer.tsx src/app/
git commit -m "feat: implement dynamic widget renderer for cms pages"
```

---

### Task 4: Implement AI Chatbot Widget & API

**Files:**
- Create: `src/app/api/ai/help-chat/route.ts`
- Create: `src/components/features/cms/widgets/ai-chatbot-widget.tsx`
- Modify: `src/components/features/cms/dynamic-page-renderer.tsx`

- [ ] **Step 1: Install AI SDK** (If not already installed)
Run: `npm install ai @google/generative-ai`

- [ ] **Step 2: Create API Route**
In `src/app/api/ai/help-chat/route.ts`:

```typescript
import { streamText } from 'ai'
import { google } from '@google/generative-ai'

export async function POST(req: Request) {
  const { messages, systemPrompt } = await req.json()
  
  const result = await streamText({
    model: google('gemini-1.5-flash'),
    system: systemPrompt || "You are a helpful support assistant for an accommodation booking platform. Do not share secrets, passwords, or internal system details. Keep answers concise.",
    messages,
  })

  return result.toDataStreamResponse()
}
```

- [ ] **Step 3: Create UI Component**
In `src/components/features/cms/widgets/ai-chatbot-widget.tsx`: Use `useChat` from `ai/react` to build an inline chat interface. Send `widget.config.prompt` as `systemPrompt` in the request body.

- [ ] **Step 4: Hook into Renderer**
Update `dynamic-page-renderer.tsx` to render `<AIChatbotWidget config={widget.config} />` when `type === 'ai_chatbot'`.

- [ ] **Step 5: Commit**
```bash
git add package.json package-lock.json src/app/api/ai/help-chat/route.ts src/components/features/cms/widgets/ai-chatbot-widget.tsx src/components/features/cms/dynamic-page-renderer.tsx
git commit -m "feat: implement inline AI chatbot widget using Gemini"
```

---

### Task 5: Implement Async Support Tickets Widget

**Files:**
- Create: `src/components/features/cms/widgets/support-tickets-widget.tsx`
- Create: `src/app/actions/support-actions.ts`
- Modify: `src/components/features/cms/dynamic-page-renderer.tsx`

- [ ] **Step 1: Create Server Actions**
In `support-actions.ts`, implement:
- `createTicket(subject: string, message: string)`
- `addMessageToTicket(ticketId: string, message: string)`
- `getUserTickets()`
- `getTicketMessages(ticketId: string)`

Use Supabase server client to interact with `support_tickets` and `support_messages`. Require authentication.

- [ ] **Step 2: Create UI Component**
In `support-tickets-widget.tsx`:
- Check authentication status using a client auth store or context. If logged out, show "Please log in to submit a support ticket".
- If logged in, fetch `getUserTickets()` and display a list.
- Provide a form to create a new ticket.
- When a ticket is clicked, display its messages and a form to reply.

- [ ] **Step 3: Hook into Renderer**
Update `dynamic-page-renderer.tsx` to render `<SupportTicketsWidget config={widget.config} />` when `type === 'support_tickets'`.

- [ ] **Step 4: Commit**
```bash
git add src/app/actions/support-actions.ts src/components/features/cms/widgets/support-tickets-widget.tsx src/components/features/cms/dynamic-page-renderer.tsx
git commit -m "feat: implement async support tickets widget and actions"
```
