'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Shield, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { MfaEnrollment } from '@/components/features/auth/mfa-enrollment'
import { getAuthenticatorFactors, unenrollMfa } from '@/lib/supabase/auth-actions'

export default function SecurityPage()
{
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const router = useRouter()
    const supabase = createClient()

    const [mfaFactors, setMfaFactors] = useState<any[]>([])
    const [isRefreshingMfa, setIsRefreshingMfa] = useState(true)
    const [isEnrolling, setIsEnrolling] = useState(false)

    useEffect(() =>
    {
        refreshMfaStatus()
    }, [])

    const refreshMfaStatus = async () =>
    {
        setIsRefreshingMfa(true)
        try {
            const factors = await getAuthenticatorFactors()
            if (factors && 'totp' in factors) {
                setMfaFactors(factors.totp || [])
            }
        } catch (err) {
            console.error('Error refreshing MFA:', err)
        } finally {
            setIsRefreshingMfa(false)
        }
    }

    const handleUnenroll = async (factorId: string) =>
    {
        if (!confirm('Are you sure you want to disable 2FA?')) return

        try {
            const result = await unenrollMfa(factorId)
            if (result.error) throw new Error(result.error)
            toast.success('MFA disabled successfully')
            refreshMfaStatus()
        } catch (err: any) {
            toast.error(err.message)
        }
    }

    const handleUpdatePassword = async (e: React.FormEvent) =>
    {
        e.preventDefault()

        if (password !== confirmPassword) {
            toast.error('Passwords do not match')
            return
        }

        if (password.length < 8) {
            toast.error('Password must be at least 8 characters long')
            return
        }

        setIsSubmitting(true)

        try {
            const { error } = await supabase.auth.updateUser({
                password: password
            })

            if (error) throw error

            toast.success('Password updated successfully')
            setPassword('')
            setConfirmPassword('')
        } catch (error: any) {
            console.error('Error updating password:', error)
            toast.error(error.message || 'Failed to update password')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="space-y-6 max-w-2xl">
            <div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.back()}
                    className="mb-4 -ml-2 text-muted-foreground"
                >
                    &larr; Back to Profile
                </Button>
                <h1 className="text-2xl font-bold tracking-tight">Login & Security</h1>
                <p className="text-muted-foreground">
                    Manage your password and secure your account
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2">
                        <Shield className="h-5 w-5" />
                        Update Password
                    </CardTitle>
                    <CardDescription>
                        Ensure your account is using a long, random password to stay secure.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleUpdatePassword} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="password">New Password</Label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={8}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword">Confirm New Password</Label>
                            <Input
                                id="confirmPassword"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                minLength={8}
                            />
                        </div>

                        <Button type="submit" disabled={isSubmitting || !password || !confirmPassword}>
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Updating...
                                </>
                            ) : (
                                'Update Password'
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2">
                        <Shield className="h-5 w-5" />
                        Two-Factor Authentication (2FA)
                    </CardTitle>
                    <CardDescription>
                        Add an extra layer of security to your account by requiring a code from an authenticator app.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isRefreshingMfa ? (
                        <div className="flex justify-center p-4">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : mfaFactors.length > 0 ? (
                        <div className="space-y-4">
                            {mfaFactors.map((factor) => (
                                <div key={factor.id} className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                                    <div>
                                        <p className="font-medium">Authenticator App</p>
                                        <p className="text-xs text-muted-foreground">Added on {new Date(factor.created_at).toLocaleDateString()}</p>
                                    </div>
                                    <Button variant="destructive" size="sm" onClick={() => handleUnenroll(factor.id)}>
                                        Disable
                                    </Button>
                                </div>
                            ))}
                        </div>
                    ) : isEnrolling ? (
                        <MfaEnrollment
                            onSuccess={() =>
                            {
                                setIsEnrolling(false)
                                refreshMfaStatus()
                            }}
                            onCancel={() => setIsEnrolling(false)}
                        />
                    ) : (
                        <div className="text-center py-4">
                            <p className="text-sm text-muted-foreground mb-4">
                                Two-factor authentication is not enabled for your account yet.
                            </p>
                            <Button onClick={() => setIsEnrolling(true)}>
                                Set up 2FA
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Security Tip</AlertTitle>
                <AlertDescription>
                    We recommend using a password manager to generate and store a secure, unique password for your account.
                </AlertDescription>
            </Alert>
        </div>
    )
}
