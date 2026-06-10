'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getRequestLocale } from '@/i18n/request-locale'
import { localizePathname } from '@/lib/i18n/pathname'

export async function signUp(formData: FormData) {
  const supabase = await createClient()
  if (!supabase) return { error: 'Supabase not configured' }

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('fullName') as string

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  })

  if (error) return { error: error.message }
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function signIn(formData: FormData) {
  const supabase = await createClient()
  if (!supabase) return { error: 'Supabase not configured' }

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) return { error: error.message }
  
  // Check if MFA is required
  if (data?.user && !data.session) {
    return { mfaRequired: true }
  }

  revalidatePath('/', 'layout')
  return { success: true, user: data.user }
}

export async function signOut() {
  const supabase = await createClient()
  if (supabase) await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  const locale = await getRequestLocale()
  redirect(localizePathname('/', locale))
}

export async function getUser() {
  const supabase = await createClient()
  if (!supabase) return null
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

/**
 * MFA ACTIONS
 */

export async function enrollMfa() {
  const supabase = await createClient()
  if (!supabase) return { error: 'Supabase not configured' }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
  })

  if (error) return { error: error.message }
  return { data }
}

export async function verifyAndEnableMfa(factorId: string, code: string) {
  const supabase = await createClient()
  if (!supabase) return { error: 'Supabase not configured' }

  const { data, error } = await supabase.auth.mfa.challengeAndVerify({
    factorId,
    code,
  })

  if (error) return { error: error.message }
  return { data }
}

export async function unenrollMfa(factorId: string) {
  const supabase = await createClient()
  if (!supabase) return { error: 'Supabase not configured' }

  const { error } = await supabase.auth.mfa.unenroll({
    factorId,
  })

  if (error) return { error: error.message }
  return { success: true }
}

export async function verifyMfaFactor(challengeId: string, code: string) {
  const supabase = await createClient()
  if (!supabase) return { error: 'Supabase not configured' }

  const { data, error } = await supabase.auth.mfa.verify({
    factorId: challengeId, // This is often the factorId or the challengeId depending on the SDK version
    challengeId,
    code,
  })

  if (error) return { error: error.message }
  return { data }
}

export async function getAuthenticatorFactors() {
  const supabase = await createClient()
  if (!supabase) return { error: 'Supabase not configured' }

  const { data, error } = await supabase.auth.mfa.listFactors()
  if (error) return { error: error.message }

  return {
    all: data.all,
    totp: data.all.filter(f => f.factor_type === 'totp' && f.status === 'verified'),
    unverified: data.all.filter(f => f.status === 'unverified')
  }
}
