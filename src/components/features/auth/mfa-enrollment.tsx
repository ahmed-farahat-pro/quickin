'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { enrollMfa, verifyAndEnableMfa } from '@/lib/supabase/auth-actions'
import { QRCodeSVG } from 'qrcode.react'

interface MfaEnrollmentProps
{
    onSuccess?: () => void
    onCancel?: () => void
}

export function MfaEnrollment({ onSuccess, onCancel }: MfaEnrollmentProps)
{
    const t = useTranslations('auth')
    const [enrollData, setEnrollData] = useState<any>(null)
    const [code, setCode] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isSuccess, setIsSuccess] = useState(false)

    useEffect(() =>
    {
        startEnrollment()
    }, [])

    const startEnrollment = async () =>
    {
        setIsLoading(true)
        setError(null)
        try {
            const result = await enrollMfa()
            if (result.error) {
                setError(result.error)
                return
            }
            setEnrollData(result.data)
        } catch (err) {
            console.error('MFA Enrollment error:', err)
            setError(t('unexpectedError'))
        } finally {
            setIsLoading(false)
        }
    }

    const handleVerify = async (e: React.FormEvent) =>
    {
        e.preventDefault()
        if (!enrollData || code.length !== 6) return

        setIsLoading(true)
        setError(null)
        try {
            const result = await verifyAndEnableMfa(enrollData.id, code)
            if (result.error) {
                toast.error(result.error)
                return
            }

            setIsSuccess(true)
            toast.success(t('mfaEnrollSuccess'))
            if (onSuccess) {
                setTimeout(onSuccess, 2000)
            }
        } catch (err) {
            console.error('MFA Verify error:', err)
            setError(t('unexpectedError'))
        } finally {
            setIsLoading(false)
        }
    }

    if (isSuccess) {
        return (
            <div className="flex flex-col items-center justify-center space-y-4 py-8 text-center">
                <CheckCircle2 className="h-16 w-16 text-green-500" />
                <h3 className="text-xl font-semibold">{t('mfaEnrollSuccess')}</h3>
                <p className="text-muted-foreground">{t('welcomeBack')}</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center space-y-4 py-8 text-center">
                <AlertCircle className="h-16 w-16 text-destructive" />
                <h3 className="text-xl font-semibold">{t('mfaEnrollFailure')}</h3>
                <p className="text-muted-foreground">{error}</p>
                <Button onClick={startEnrollment}>{t('retry')}</Button>
                {onCancel && (
                    <Button variant="ghost" onClick={onCancel}>{t('backToLogin')}</Button>
                )}
            </div>
        )
    }

    return (
        <div className="space-y-6 py-4">
            <div className="space-y-2 text-center">
                <h3 className="text-lg font-medium">{t('mfaEnrollTitle')}</h3>
                <p className="text-sm text-muted-foreground">
                    {t('mfaEnrollDescription')}
                </p>
            </div>

            {enrollData && (
                <div className="flex flex-col items-center space-y-6">
                    <div className="bg-white p-4 rounded-xl shadow-inner inline-block">
                        <QRCodeSVG
                            value={enrollData.totp.uri}
                            size={200}
                            level="M"
                            includeMargin={true}
                        />
                    </div>

                    <div className="w-full max-w-[200px] text-center">
                        <p className="text-xs font-mono bg-muted p-2 rounded select-all break-all">
                            {enrollData.totp.secret}
                        </p>
                    </div>

                    <form onSubmit={handleVerify} className="w-full space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="enroll-code">{t('mfaVerifyButton')}</Label>
                            <Input
                                id="enroll-code"
                                type="text"
                                inputMode="numeric"
                                maxLength={6}
                                placeholder={t('mfaPlaceholder')}
                                value={code}
                                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                                disabled={isLoading}
                                className="text-center text-xl tracking-widest h-12"
                            />
                        </div>
                        <Button type="submit" className="w-full h-11" disabled={isLoading || code.length !== 6}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {t('mfaVerifyButton')}
                        </Button>
                        {onCancel && (
                            <Button type="button" variant="ghost" className="w-full" onClick={onCancel}>
                                {t('common.retry')}
                            </Button>
                        )}
                    </form>
                </div>
            )}

            {isLoading && !enrollData && (
                <div className="flex justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            )}
        </div>
    )
}
