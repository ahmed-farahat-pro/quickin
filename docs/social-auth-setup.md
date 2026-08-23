# Social Authentication Setup Guide

> ⚠️ **Stale.** This describes the retired Supabase stack. The platform now runs on
> Neon and verifies ID tokens itself — see `OAUTH-SETUP.md`. **Sign in with Apple has
> been removed from every platform**; Google is the only social provider.

This guide explains how to enable Google Sign-In for the platform.

## Prerequisites

- Access to [Supabase Dashboard](https://supabase.com/dashboard)
- Google Cloud Console account (for Google Sign-In)

---

## Google Sign-In Setup

### Step 1: Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services → Credentials**
4. Click **Create Credentials → OAuth client ID**
5. Select **Web application**
6. Add authorized redirect URI:
   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```
   Replace `<your-project-ref>` with your Supabase project reference (found in Supabase dashboard URL)
7. Copy the **Client ID** and **Client Secret**

### Step 2: Configure Supabase

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Authentication → Providers**
4. Find **Google** and toggle it **ON**
5. Paste your **Client ID** and **Client Secret**
6. Click **Save**

### Step 3: Test

1. Run the app locally: `npm run dev`
2. Click "Log in" in the navbar
3. Click "Continue with Google"
4. Complete the Google OAuth flow
5. Verify you're logged in and a profile was created

---

## Troubleshooting

### "OAuth callback failed" error

- Verify the redirect URI matches exactly (including trailing slashes)
- Check that the provider is enabled in Supabase
- Ensure credentials are correctly copied

### User logged in but no profile

- Check the `on_auth_user_created` trigger exists in the database
- Verify RLS policies allow profile creation

---

## Environment Variables

No new environment variables are needed - the OAuth configuration is stored in Supabase Dashboard.

The existing callback route at `/auth/callback` handles all OAuth providers automatically.
