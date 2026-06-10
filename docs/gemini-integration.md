# Gemini AI Integration

## Overview
The Airbnb clone will feature an intelligent AI assistant powered by Google's Gemini API. This assistant will be available throughout the app to help users with various tasks.

---

## Use Cases

### 1. Search & Discovery
- "Find me beachfront properties in Miami for 4 guests"
- "What's a good place for a romantic getaway in Europe?"
- "Show me pet-friendly cabins near mountains"

### 2. Listing Questions
- "Does this place have a pool?"
- "Is the kitchen fully equipped?"
- "How far is this from the airport?"

### 3. Booking Assistance
- "What dates are available in February?"
- "Can you calculate the total for a 5-night stay?"
- "What's the cancellation policy?"

### 4. Recommendations
- "What are the best restaurants near this listing?"
- "What should I pack for a trip to Thailand?"
- "What activities are popular in this area?"

### 5. Host Assistance
- "Help me write a compelling listing description"
- "What amenities should I highlight?"
- "Suggest competitive pricing for my area"

---

## Technical Implementation

### API Setup
```typescript
// lib/gemini/client.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export const geminiModel = genAI.getGenerativeModel({ 
  model: 'gemini-1.5-flash' // Fast responses for chat
});
```

### Chat Context
The assistant will receive context about:
- Current page/view the user is on
- Selected listing details (if viewing a listing)
- Search filters applied
- User preferences (if logged in)
- Booking dates/guests selected

### System Prompt Structure
```typescript
const systemPrompt = `
You are a helpful travel assistant for an Airbnb-like platform.
You help users find perfect accommodations, answer questions about listings,
and provide travel recommendations.

Current context:
- Page: ${currentPage}
- Listing: ${listingDetails ?? 'None selected'}
- Search: ${searchContext}
- User: ${userContext}

Be concise, friendly, and helpful. If you don't know something specific
about a listing, suggest the user check the listing details or contact the host.
`;
```

---

## UI Components

### Chat Widget
- Floating button in bottom-right corner
- Expandable chat interface
- Message history within session
- Typing indicators
- Mobile-responsive

### Quick Actions
- Suggested prompts based on context
- One-click common questions
- Voice input (future enhancement)

---

## Environment Variables
```env
GEMINI_API_KEY=your_gemini_api_key
```

---

## Rate Limiting & Safety
- Implement rate limiting per user session
- Use Gemini's built-in safety filters
- Fallback responses for API errors
- Message length limits
