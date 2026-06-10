# Deployment Guide for Vercel

This project is built with Next.js and is ready to be deployed to Vercel.

## Prerequisites

- A [Vercel](https://vercel.com) account
- A [Supabase](https://supabase.com) project
- A [Google Gemini API Key](https://ai.google.dev/)

## Environment Variables

The following environment variables are required for the application to function correctly. You must set these in your Vercel Project Settings under **Settings > Environment Variables**.

| Variable Name | Description | Value Source |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase Project URL | Supabase Dashboard > Settings > API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase Anonymous Key | Supabase Dashboard > Settings > API |
| `GEMINI_API_KEY` | Google Gemini API Key for AI features | Google AI Studio |

## Deployment Steps

### Option 1: Vercel CLI

1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel login`
3. Run `vercel` in the project root
4. Follow the prompts (e.g., Set up and deploy? [Y/n] -> Y)

### Option 2: GitHub Integration (Recommended)

1. Push this code to a GitHub repository.
2. Go to your Vercel Dashboard and click "Add New... > Project".
3. Import your GitHub repository.
4. Add the **Environment Variables** listed above.
5. Click **Deploy**.

## Post-Deployment Verification

After deployment:
1. Visit the deployed URL.
2. Verify that listings load (checks Supabase connection).
3. Try asking the AI Assistant a question (checks Gemini integration).
4. Try logging in/signing up (checks Supabase Auth).
