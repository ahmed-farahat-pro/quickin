'use client'

import { useEffect, Suspense } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'

function AuthNotificationInner()
{
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()
    const t = useTranslations('auth')

    useEffect(() =>
    {
        const authSuccess = searchParams.get('auth_success')

        if (authSuccess === 'verified') {
            // Small timeout to ensure the UI is ready and toast doesn't get skipped
            const timer = setTimeout(() =>
            {
                toast.success(t('verificationSuccess'), {
                    duration: 6000,
                })

                // Clean up the URL
                const params = new URLSearchParams(searchParams.toString())
                params.delete('auth_success')
                const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname
                router.replace(newUrl)
            }, 500)

            return () => clearTimeout(timer)
        }
    }, [searchParams, router, pathname, t])

    return null
}

/**
 * Global component to handle authentication-related notifications
 * (e.g. Email verification success)
 */
export function AuthNotification()
{
    return (
        <Suspense fallback={null}>
            <AuthNotificationInner />
        </Suspense>
    )
}
