import { NextRequest, NextResponse } from 'next/server'
import { geminiModel, buildSystemPrompt, ChatContext } from '@/lib/gemini/client'
import { getListings } from '@/lib/supabase/queries'

export const dynamic = 'force-dynamic'

const MAX_MESSAGE_LENGTH = 1000

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message: rawMessage, context } = body as {
      message: string
      context?: ChatContext
    }
    let message = rawMessage

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // Security: Limit message length to prevent DoS/token exhaustion
    if (message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters` },
        { status: 400 }
      )
    }

    // Security: Sanitize input
    message = message.trim()

    // Check for API key
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { 
          response: "I'm not configured yet! Please add your GEMINI_API_KEY to the environment variables.",
          isConfigError: true 
        },
        { status: 200 }
      )
    }

    // Fetch latest listings to provide context to the AI
    // In a real app, we might use vector search (RAG) here based on the user's message
    // For now, we'll feed the top 10 most recent listings as "active knowledge"
    let availableListings: { id: string; title: string; location: string; price: number; rating?: number }[] = []
    try {
      // Use getListings from our existing queries
      const listings = await getListings({ limit: 10 })
      availableListings = listings.map(l => ({
        id: l.id,
        title: l.title,
        location: l.location,
        price: l.price_per_night,
        rating: l.rating
      }))
    } catch (err) {
      console.warn('Failed to fetch listings for AI context:', err)
      // Continue without listings context if database is down/empty
    }

    // Enhance context with real data
    const inferredLocale: 'en' | 'ar' =
      context?.locale === 'ar' ||
      context?.currentPage?.startsWith('/ar')
        ? 'ar'
        : 'en'

    const enhancedContext: ChatContext = {
      ...(context ?? {}),
      locale: inferredLocale,
      availableListings
    }

    const systemPrompt = buildSystemPrompt(enhancedContext)
    
    // Start chat with history
    const chat = geminiModel.startChat({
      history: [
        {
          role: 'user',
          parts: [{ text: systemPrompt }],
        },
        {
          role: 'model',
          parts: [{ text: "I understand. I have access to the current listings context and will recommend them using markdown links when relevant." }],
        },
      ],
    })

    const result = await chat.sendMessage(message)
    const response = result.response.text()

    return NextResponse.json({ response })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'Failed to process chat message' },
      { status: 500 }
    )
  }
}
