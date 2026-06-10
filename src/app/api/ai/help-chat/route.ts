import { streamText } from 'ai'
import { google } from '@ai-sdk/google'

export async function POST(req: Request) {
  const { messages, systemPrompt } = await req.json()
  
  const result = await streamText({
    model: google('gemini-1.5-flash'),
    system: systemPrompt || "You are a helpful support assistant for an accommodation booking platform. Do not share secrets, passwords, or internal system details. Keep answers concise.",
    messages,
  })

  return result.toTextStreamResponse()
}
