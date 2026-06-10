'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Eye, EyeOff, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'

export default function InviteCallbackPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [needsPassword, setNeedsPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const handleInviteCallback = async () => {
      try {
        // Get the hash fragment from the URL
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')
        const type = hashParams.get('type')

        if (accessToken && refreshToken) {
          // Set the session from the tokens
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })

          if (error) {
            toast.error('Failed to authenticate: ' + error.message)
            router.push('/login')
            return
          }

          if (data.user) {
            setUserEmail(data.user.email || '')
            
            // Check if this is an invite (new user who needs to set password)
            if (type === 'invite') {
              setNeedsPassword(true)
              setIsLoading(false)
              return
            }

            // Check if user is staff and redirect accordingly
            const { data: staffProfile } = await supabase
              .from('staff_profiles')
              .select('id')
              .eq('id', data.user.id)
              .eq('is_active', true)
              .single()

            if (staffProfile) {
              toast.success('Welcome! You are now logged in.')
              router.push('/admin')
            } else {
              router.push('/dashboard')
            }
          }
        } else {
          // No tokens found, redirect to login
          router.push('/login')
        }
      } catch (error) {
        console.error('Invite callback error:', error)
        toast.error('An error occurred during authentication')
        router.push('/login')
      }
    }

    handleInviteCallback()
  }, [router, supabase])

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }

    setIsSubmitting(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      })

      if (error) {
        toast.error('Failed to set password: ' + error.message)
        return
      }

      setIsSuccess(true)
      toast.success('Password set successfully!')

      // Redirect to admin after a short delay
      setTimeout(() => {
        router.push('/admin')
      }, 2000)
    } catch (error) {
      console.error('Set password error:', error)
      toast.error('An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Loading state
  if (isLoading && !needsPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Processing your invitation...</p>
        </div>
      </div>
    )
  }

  // Success state
  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle>Welcome to the Team!</CardTitle>
            <CardDescription>
              Your password has been set. Redirecting you to the admin dashboard...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  // Password setup form for new invited users
  if (needsPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Welcome to QuickIn</CardTitle>
            <CardDescription>
              You&apos;ve been invited as a staff member. Please set your password to continue.
              {userEmail && (
                <span className="block mt-2 font-medium text-foreground">{userEmail}</span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isSubmitting}
                    minLength={8}
                    required
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
                <p className="text-xs text-muted-foreground">
                  Must be at least 8 characters
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>

              <Button type="submit" className="w-full h-11" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Set Password & Continue
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return null
}
