# Social Authentication Setup Guide

This guide explains how to enable Google and Apple Sign-In for the platform.

## Prerequisites

- Access to [Supabase Dashboard](https://supabase.com/dashboard)
- Google Cloud Console account (for Google Sign-In)
- Apple Developer Program membership (for Apple Sign-In)

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

## Apple Sign-In Setup

> ⚠️ **Requires Apple Developer Program** ($99/year)

### Step 1: Configure Apple Developer Account

1. Go to [Apple Developer Portal](https://developer.apple.com/)
2. Navigate to **Certificates, Identifiers & Profiles**
3. Create a new **App ID** with "Sign In with Apple" capability
4. Create a **Services ID** for web authentication
5. Configure the web domain and return URL:
   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```
6. Generate a **Key** for Sign In with Apple

### Step 2: Configure Supabase

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Authentication → Providers**
4. Find **Apple** and toggle it **ON**
5. Fill in the required fields:
   - **Service ID** (from Services ID)
   - **Team ID** (from Apple Developer account)
   - **Key ID** (from the key you created)
   - **Private Key** (contents of the .p8 file)
6. Click **Save**

### Step 3: Test

1. Run the app locally: `npm run dev`
2. Click "Log in" in the navbar
3. Click "Continue with Apple"
4. Complete the Apple OAuth flow
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

### Apple Sign-In not working

- Apple Sign-In requires HTTPS, so it won't work on `localhost` without additional setup
- Consider using a service like ngrok for local testing

---

## Environment Variables

No new environment variables are needed - the OAuth configuration is stored in Supabase Dashboard.

The existing callback route at `/auth/callback` handles all OAuth providers automatically.
