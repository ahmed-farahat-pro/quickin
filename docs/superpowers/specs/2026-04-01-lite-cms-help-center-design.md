# Lite-CMS and Help Center Design Specification

## Overview
This document outlines the architectural and technical design for extending the existing custom pages functionality into a "Lite-CMS" widget-based system. The Help Center (`/help`) will be built entirely using this CMS, leveraging specialized widgets for standard content, FAQs, an AI Chatbot, and an Async Support Ticket system.

## 1. Database Schema Updates

### `custom_pages` Table
- The `content` column will be migrated from plain text to a `JSONB` structure to support an array of widgets.
- **Migration Strategy:** A safe migration script will be created to wrap existing markdown content into a single markdown widget array to ensure no data is lost or broken.
- **Data Structure:**
  ```json
  [
    {
      "id": "uuid-or-unique-string",
      "type": "markdown",
      "content": { "en": "...", "ar": "..." }
    },
    {
      "id": "uuid-or-unique-string",
      "type": "faq",
      "items": [
        { "question": { "en": "...", "ar": "..." }, "answer": { "en": "...", "ar": "..." } }
      ]
    },
    {
      "id": "uuid-or-unique-string",
      "type": "ai_chatbot",
      "config": { "prompt": "...", "title": { "en": "...", "ar": "..." } }
    },
    {
      "id": "uuid-or-unique-string",
      "type": "support_tickets",
      "config": { "title": { "en": "...", "ar": "..." } }
    }
  ]
  ```

### New Tables for Async Support
- **`support_tickets`**
  - `id`: UUID (Primary Key)
  - `user_id`: UUID (Foreign Key to users)
  - `subject`: String
  - `status`: Enum ('open', 'closed')
  - `created_at`: Timestamp
  - `updated_at`: Timestamp
- **`support_messages`**
  - `id`: UUID (Primary Key)
  - `ticket_id`: UUID (Foreign Key to support_tickets)
  - `sender_id`: UUID (Foreign Key to users, null if sent by system/admin)
  - `message`: Text
  - `created_at`: Timestamp

## 2. Admin Site Settings (Lite-CMS)

### Widget Engine
- The Page Editor will be refactored to handle the new JSON array structure instead of a single markdown text area.
- **Supported Widgets:**
  - **Markdown Widget:** The existing editor, adapted to be an item in the array.
  - **FAQ Widget:** A specialized editor for adding Question & Answer pairs.
  - **AI Chatbot Widget:** A specialized widget allowing admins to insert the Gemini AI Chatbot, with options to configure its base prompt/behavior.
  - **Support Tickets Widget:** A widget to embed the Async Support Ticket system, accessible only to authenticated users.

### Drag and Drop Reordering
- We will integrate **`@dnd-kit/core`** and **`@dnd-kit/sortable`** to provide a smooth, accessible drag-and-drop experience for reordering widgets. 
- It plays excellently with Radix UI (which Shadcn is built on) and provides a much better UX than simple up/down arrows.

## 3. Help Center Page (`/help`)

The Help Center will become a "pure" custom page managed entirely via the CMS. The admins will construct it by arranging the following widgets:

### A. Inline AI Chatbot Widget
- Renders an inline chat interface powered by Gemini AI.
- An API route (`/api/ai/help-chat`) will handle queries, using a strict system prompt (configurable via the CMS) containing public info and explicitly prohibiting the sharing of sensitive, secret, or internal system information.

### B. FAQ Display Widget
- Iterates through Q&A items defined in the CMS and renders an interactive Shadcn Accordion.

### C. Async Support Tickets Widget
- Requires the user to be authenticated.
- If logged in, users can view their past ticket history and submit new tickets.
- If not logged in, they are prompted to sign in to use this feature.
- Provides a threaded view of messages for a selected ticket.

## Implementation Phasing
1. **Phase 1: Database Foundation & Admin CMS** - Update the `custom_pages` schema, implement the Widget Engine with `dnd-kit`, and adapt the admin frontend. Create the basic Markdown and FAQ widgets.
2. **Phase 2: Interactive Widgets & Frontend Engine** - Build the dynamic frontend rendering engine for the CMS pages. Implement the AI Chatbot Widget and the API route.
3. **Phase 3: Async Support System** - Create the support tables, implement the backend logic, and wire up the Support Tickets Widget for both users and admins.
