// =============================================================================
// AUTH MODAL COMPONENT
// =============================================================================
// Description: Modal dialog for user authentication (login/signup)
// Features:
//   - Email/password authentication via Supabase
//   - OAuth support (Google, Apple)
//   - Form validation with Zod
//   - Toggle between login and signup views
// =============================================================================

'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Loader2, Info } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import Link from 'next/link'
import
{
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import
{
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'
import { useUIStore } from '@/stores'
import { signInSchema, signUpSchema, type SignInInput, type SignUpInput } from '@/lib/validations/schemas'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { Locale } from '@/i18n/config'
import { localizePathname } from '@/lib/i18n/pathname'
import { MfaVerificationForm } from './mfa-verification-form'
import { signIn } from '@/lib/supabase/auth-actions'
import { getBaseUrl } from '@/lib/utils'

// -----------------------------------------------------------------------------
// LOGIN FORM COMPONENT
// -----------------------------------------------------------------------------
// Handles user login with email/password via Supabase Auth
// -----------------------------------------------------------------------------
function LoginForm({ onSuccess, onForgotPassword, isLoading, setIsLoading }: {
  onSuccess: () => void
  onForgotPassword: () => void
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
})
{
  const t = useTranslations('auth')
  const [showPassword, setShowPassword] = useState(false)
  const supabase = createClient()

  const form = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  })

  /**
   * Handle login form submission
   * Authenticates user with Supabase and handles errors
   */
  const onSubmit = async (data: SignInInput) =>
  {
    setIsLoading(true)

    try {
      const { openAuthModal } = useUIStore.getState()

      const formData = new FormData()
      formData.append('email', data.email)
      formData.append('password', data.password)

      const result = await signIn(formData)

      if (result.error) {
        toast.error(result.error)
        return
      }

      if (result.mfaRequired) {
        openAuthModal('mfa-verify')
        return
      }

      toast.success(t('welcomeBack'))
      onSuccess()

      // Check if user is staff and redirect to admin
      if (result.user && supabase) {
        const { data: staffProfile } = await supabase
          .from('staff_profiles')
          .select('id')
          .eq('id', result.user.id)
          .eq('is_active', true)
          .single()

        if (staffProfile) {
          window.location.href = '/admin'
          return
        }
      }

      // Regular user - reload page
      window.location.reload()
    } catch (error) {
      console.error('Login error:', error)
      toast.error(t('unexpectedError'), {
        action: { label: t('loginButton'), onClick: () => form.handleSubmit(onSubmit)() }
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="login-email">{t('email')}</Label>
        <Input
          id="login-email"
          type="email"
          placeholder={t('placeholderEmail')}
          {...form.register('email')}
          disabled={isLoading}
        />
        {form.formState.errors.email && (
          <p className="text-sm text-destructive">
            {form.formState.errors.email.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="login-password">{t('password')}</Label>
          <button
            type="button"
            className="text-xs text-primary hover:underline"
            onClick={onForgotPassword}
          >
            {t('forgotPassword')}
          </button>
        </div>
        <div className="relative">
          <Input
            id="login-password"
            type={showPassword ? 'text' : 'password'}
            placeholder={t('placeholderPassword')}
            {...form.register('password')}
            disabled={isLoading}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute end-0 top-0 h-full px-3"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
        {form.formState.errors.password && (
          <p className="text-sm text-destructive">
            {form.formState.errors.password.message}
          </p>
        )}
      </div>

      <Button type="submit" className="w-full h-11" disabled={isLoading}>
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {t('loginButton')}
      </Button>
    </form>
  )
}

// -----------------------------------------------------------------------------
// FORGOT PASSWORD FORM COMPONENT
// -----------------------------------------------------------------------------
// Handles password reset request via Supabase Auth
// -----------------------------------------------------------------------------
function ForgotPasswordForm({ onSuccess, onBack, isLoading, setIsLoading }: {
  onSuccess: () => void
  onBack: () => void
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
})
{
  const locale = useLocale() as Locale
  const t = useTranslations('auth')
  const [email, setEmail] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const supabase = createClient()

  const resetPassword = async () =>
  {
    if (!email) {
      toast.error(t('pleaseEnterEmail'))
      return
    }

    setIsLoading(true)

    try {
      if (!supabase) {
        toast.error('Database not configured — please add Supabase credentials to .env.local')
        return
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${getBaseUrl()}${localizePathname('/auth/reset-password', locale)}`,
      })

      if (error) {
        toast.error(error.message)
        return
      }

      setEmailSent(true)
      toast.success(t('resetEmailSent'))
    } catch (error) {
      console.error('Reset password error:', error)
      toast.error(t('unexpectedError'), {
        action: { label: t('retry'), onClick: () => resetPassword() }
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) =>
  {
    e.preventDefault()
    await resetPassword()
  }

  if (emailSent) {
    return (
      <div className="text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
          <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="font-medium">{t('checkYourEmail')}</h3>
        <p className="text-sm text-muted-foreground">{t('resetLinkSentTo', { email })}</p>
        <Button variant="outline" className="w-full" onClick={onBack}>
          {t('backToLogin')}
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="reset-email">{t('email')}</Label>
        <Input
          id="reset-email"
          type="email"
          placeholder={t('placeholderEmail')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
        />
        <p className="text-xs text-muted-foreground">
          {t('resetEmailHelp')}
        </p>
      </div>

      <Button type="submit" className="w-full h-11" disabled={isLoading}>
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {t('sendResetLink')}
      </Button>

      <Button type="button" variant="ghost" className="w-full" onClick={onBack}>
        {t('backToLogin')}
      </Button>
    </form>
  )
}

// -----------------------------------------------------------------------------
// SIGNUP FORM COMPONENT
// -----------------------------------------------------------------------------
// Handles new user registration with email/password via Supabase Auth
// Profile is automatically created via database trigger (on_auth_user_created)
// -----------------------------------------------------------------------------
function SignupForm({ onSuccess, isLoading, setIsLoading, onEmailSent }: {
  onSuccess: () => void
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
  onEmailSent: (email: string) => void
})
{
  const t = useTranslations('auth')
  const [showPassword, setShowPassword] = useState(false)
  const supabase = createClient()

  const form = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    mode: 'onChange',
    defaultValues: { email: '', password: '', fullName: '', acceptTerms: false as any },
  })

  /**
   * Handle signup form submission
   * Creates new user in Supabase Auth
   * Profile is auto-created via database trigger
   */
  const onSubmit = async (data: SignUpInput) =>
  {
    setIsLoading(true)

    try {
      if (!supabase) {
        toast.error('Database not configured — please add Supabase credentials to .env.local')
        return
      }

      const { error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.fullName,
          },
        },
      })

      if (error) {
        toast.error(error.message)
        return
      }

      toast.success(t('signupSuccess'))
      onEmailSent(data.email)
    } catch (error) {
      console.error('Signup error:', error)
      toast.error(t('unexpectedError'), {
        action: { label: t('signupButton'), onClick: () => form.handleSubmit(onSubmit)() }
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <TooltipProvider>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="signup-fullName">{t('fullName')}</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-muted-foreground hover:text-foreground">
                  <Info className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs max-w-[200px]">{t('changeInfoTip')}</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <Input
            id="signup-fullName"
            placeholder={t('placeholderFullName')}
            {...form.register('fullName')}
            disabled={isLoading}
          />
          {form.formState.errors.fullName && (
            <p className="text-sm text-destructive">
              {form.formState.errors.fullName.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="signup-email">{t('email')}</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-muted-foreground hover:text-foreground">
                  <Info className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs max-w-[200px]">{t('changeInfoTip')}</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <Input
            id="signup-email"
            type="email"
            placeholder={t('placeholderEmail')}
            {...form.register('email')}
            disabled={isLoading}
          />
          {form.formState.errors.email && (
            <p className="text-sm text-destructive">
              {form.formState.errors.email.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="signup-password">{t('password')}</Label>
          <div className="relative">
            <Input
              id="signup-password"
              type={showPassword ? 'text' : 'password'}
              placeholder={t('placeholderPassword')}
              {...form.register('password')}
              disabled={isLoading}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full px-3"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          {form.formState.errors.password && (
            <p className="text-sm text-destructive">
              {form.formState.errors.password.message}
            </p>
          )}
        </div>

        <div className="space-y-2 pt-2">
          <div className="flex flex-row items-start space-x-2">
            <Checkbox 
              id="acceptTerms" 
              checked={form.watch('acceptTerms')}
              onCheckedChange={(checked) => form.setValue('acceptTerms', checked === true, { shouldValidate: true })}
              className="mt-1"
            />
            <div className="space-y-1 leading-none ps-2">
              <Label htmlFor="acceptTerms" className="text-sm font-normal">
                {t('acceptTermsPrefix')} <Link href="/terms" target="_blank" className="text-primary hover:underline">{t('acceptTermsLink')}</Link>
              </Label>
            </div>
          </div>
          {form.formState.errors.acceptTerms && (
            <p className="text-sm text-destructive">
              {form.formState.errors.acceptTerms.message}
            </p>
          )}
        </div>

        <Button type="submit" className="w-full h-11" disabled={isLoading || !form.formState.isValid}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('signupButton')}
        </Button>
      </form>
    </TooltipProvider>
  )
}

// -----------------------------------------------------------------------------
// AUTH MODAL COMPONENT
// -----------------------------------------------------------------------------
// Main authentication modal with login/signup forms and OAuth buttons
// -----------------------------------------------------------------------------
export function AuthModal()
{
  const t = useTranslations('auth')
  const { isAuthModalOpen, authModalView, closeAuthModal, openAuthModal } = useUIStore()
  const [isLoading, setIsLoading] = useState(false)
  const supabase = createClient()

  const isLogin = authModalView === 'login'
  const isSignup = authModalView === 'signup'
  const isForgotPassword = authModalView === 'forgot-password'
  const isMfaVerify = authModalView === 'mfa-verify'
  const isSignupSuccess = authModalView === 'signup-success'
  const [signupEmail, setSignupEmail] = useState('')

  /**
   * Handle OAuth login with external providers
   * Redirects to provider's auth page
   */
  const handleOAuthLogin = async (provider: 'google' | 'apple') =>
  {
    setIsLoading(true)

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${getBaseUrl()}/auth/callback?next=${encodeURIComponent(window.location.pathname + window.location.search)}`,
        },
      })

      if (error) {
        toast.error(error.message, {
          action: { label: t('retry'), onClick: () => handleOAuthLogin(provider) }
        })
      }
    } catch (error) {
      console.error('OAuth error:', error)
      toast.error(t('failedProvider'), {
        action: { label: t('retry'), onClick: () => handleOAuthLogin(provider) }
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Get title and description based on current view
  const getModalContent = () =>
  {
    if (isForgotPassword) {
      return {
        title: t('resetTitle'),
        description: t('resetDescription'),
      }
    }
    if (isMfaVerify) {
      return {
        title: t('mfaTitle'),
        description: t('mfaDescription'),
      }
    }
    if (isSignupSuccess) {
      return {
        title: t('checkYourEmail'),
        description: '',
      }
    }
    return {
      title: isLogin ? t('loginTitle') : t('signupTitle'),
      description: isLogin ? t('loginDescription') : t('signupDescription'),
    }
  }

  const { title, description } = getModalContent()

  return (
    <Dialog open={isAuthModalOpen} onOpenChange={closeAuthModal}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader className='ar:text-center'>
          <DialogTitle className='text-2xl'>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* Forgot Password Form */}
          {isForgotPassword ? (
            <ForgotPasswordForm
              onSuccess={closeAuthModal}
              onBack={() => openAuthModal('login')}
              isLoading={isLoading}
              setIsLoading={setIsLoading}
            />
          ) : isMfaVerify ? (
            <MfaVerificationForm
              onSuccess={closeAuthModal}
              onBack={() => openAuthModal('login')}
            />
          ) : isSignupSuccess ? (
            <div className="text-center space-y-6 py-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002 -2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {t('checkEmailDescription', { email: signupEmail })}
                </p>
              </div>
              <Button className="w-full" onClick={closeAuthModal}>
                {t('backToLogin')}
              </Button>
            </div>
          ) : (
            <>
              {/* OAuth Buttons */}
              <div className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full h-11"
                  onClick={() => handleOAuthLogin('google')}
                  disabled={isLoading}
                >
                  <svg className="me-2 h-4 w-4" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  {t('continueGoogle')}
                </Button>
                <Button
                  variant="outline"
                  className="w-full h-11"
                  onClick={() => handleOAuthLogin('apple')}
                  disabled={isLoading}
                >
                  <svg className="me-2 h-[1.1rem] w-[1.1rem]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12.152 6.896c-.221-1.958 1.466-3.738 3.31-3.894.186 2.072-1.895 3.932-3.31 3.894M15.867 7.062c-1.472-.086-2.502.835-3.23.835-.74 0-1.636-.78-2.736-.723-1.442.078-2.766.9-3.483 2.154-1.446 2.518-.37 6.223 1.037 8.243.687.994 1.51 2.11 2.57 2.07.986-.038 1.36-.638 2.545-.638 1.186 0 1.52.638 2.564.6 1.1-.04 1.802-1.01 2.483-2.003.784-1.144 1.11-2.25 1.126-2.31-.024-.01-2.162-.832-2.186-3.284 0-2.053 1.668-3.04 1.748-3.093-.974-1.424-2.47-1.564-3.438-1.65z" />
                  </svg>
                  {t('continueApple')}
                </Button>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">{t('or')}</span>
                </div>
              </div>

              {/* Email/Password Forms */}
              {isLogin ? (
                <LoginForm
                  onSuccess={closeAuthModal}
                  onForgotPassword={() => openAuthModal('forgot-password')}
                  isLoading={isLoading}
                  setIsLoading={setIsLoading}
                />
              ) : (
                <SignupForm
                  onSuccess={closeAuthModal}
                  isLoading={isLoading}
                  setIsLoading={setIsLoading}
                  onEmailSent={(email) =>
                  {
                    setSignupEmail(email)
                    openAuthModal('signup-success' as any)
                  }}
                />
              )}

              {/* Toggle Login/Signup */}
              <p className="text-center text-sm text-muted-foreground">
                {isLogin ? `${t('dontHaveAccount')} ` : `${t('alreadyHaveAccount')} `}
                <button
                  type="button"
                  className="text-primary underline-offset-4 hover:underline"
                  onClick={() => openAuthModal(isLogin ? 'signup' : 'login')}
                >
                  {isLogin ? t('signupButton') : t('loginButton')}
                </button>
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
