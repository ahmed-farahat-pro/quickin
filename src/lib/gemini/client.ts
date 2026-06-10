// =============================================================================
// GEMINI AI CLIENT
// =============================================================================
// Description: Configuration and utilities for Google Gemini AI integration
// Model: gemini-2.0-flash (latest fast model for chat interactions)
// =============================================================================

import { GoogleGenerativeAI } from '@google/generative-ai'

// Initialize Gemini AI with API key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

// Export the generative model for chat
// Using gemini-2.0-flash for fast, efficient responses
export const geminiModel = genAI.getGenerativeModel({ 
  model: 'gemini-2.0-flash',
})

/**
 * Context provided to the AI for more relevant responses
 */
export interface ChatContext {
  locale?: 'en' | 'ar'
  currentPage?: string
  listingDetails?: {
    title: string
    location: string
    price: number
    description: string
  } | null
  searchQuery?: string
  userLoggedIn?: boolean
  availableListings?: {
    id: string
    title: string
    location: string
    price: number
    rating?: number
  }[]
}

/**
 * Builds a system prompt with context awareness
 * @param context - Current user context
 * @returns Formatted system prompt string
 */
export function buildSystemPrompt(context: ChatContext): string {
  const locale = context.locale === 'ar' ? 'ar' : 'en'
  const localePrefix = locale === 'ar' ? '/ar' : '/en'
  const listingsContext = context.availableListings?.length 
    ? `\nHere are the current available listings on the platform (recommend these when relevant):
${context.availableListings.map(l => 
  `- "${l.title}" in ${l.location} ($${l.price}/night) - Rating: ${l.rating || 'New'} - ID: ${l.id}`
).join('\n')}`
    : '\nNo specific listings are currently loaded in context.'

  return `You are a helpful travel assistant for QuickIn, an Airbnb-like vacation rental platform.
You help users find perfect accommodations, answer questions about listings, and provide travel recommendations.

Current context:
- Page: ${context.currentPage || 'Home'}
- Viewing listing: ${context.listingDetails ? `${context.listingDetails.title} in ${context.listingDetails.location} ($${context.listingDetails.price}/night)` : 'None'}
- Search query: ${context.searchQuery || 'None'}
- User logged in: ${context.userLoggedIn ? 'Yes' : 'No'}
- Locale: ${locale}
${listingsContext}

Guidelines:
- Be concise, friendly, and helpful
- ${locale === 'ar' ? 'Respond in Arabic.' : 'Respond in English.'}
- When recommending a listing, ALWAYS use a markdown link in this format: [Listing Title](${localePrefix}/listings/LISTING_ID)
- If asked about specific listing details you don't have, suggest checking the listing page
- For booking questions, guide users to use the booking widget
- Provide travel tips and local recommendations when relevant
- Keep responses under 150 words unless detailed information is requested`
}
