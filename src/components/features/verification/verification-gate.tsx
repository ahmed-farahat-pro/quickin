'use client'

import { ReactNode } from 'react'
import Link from 'next/link'
import { ShieldAlert, ShieldCheck, Clock, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected'

interface VerificationGateProps {
  /** User's current verification status */
  status: VerificationStatus
  /** Content to render if user is verified */
  children: ReactNode
  /** Action being gated (for messaging) */
  action?: 'book' | 'host' | 'default'
  /** Whether to show inline alert or full card */
  variant?: 'card' | 'inline'
}

const STATUS_CONFIG = {
  unverified: {
    icon: ShieldAlert,
    title: 'Identity Verification Required',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50 dark:bg-yellow-950/20',
    borderColor: 'border-yellow-200 dark:border-yellow-800',
  },
  pending: {
    icon: Clock,
    title: 'Verification Pending',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-950/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
  },
  rejected: {
    icon: XCircle,
    title: 'Verification Rejected',
    color: 'text-red-600',
    bgColor: 'bg-red-50 dark:bg-red-950/20',
    borderColor: 'border-red-200 dark:border-red-800',
  },
  verified: {
    icon: ShieldCheck,
    title: 'Verified',
    color: 'text-green-600',
    bgColor: 'bg-green-50 dark:bg-green-950/20',
    borderColor: 'border-green-200 dark:border-green-800',
  },
}

const ACTION_MESSAGES = {
  book: {
    unverified: 'You need to verify your identity before you can book this property.',
    pending: 'Your identity verification is being reviewed. You can book once it\'s approved.',
    rejected: 'Your verification was rejected. Please submit new documents to book.',
  },
  host: {
    unverified: 'You need to verify your identity before you can list a property.',
    pending: 'Your identity verification is being reviewed. You can list once it\'s approved.',
    rejected: 'Your verification was rejected. Please submit new documents to list.',
  },
  default: {
    unverified: 'Please verify your identity to continue.',
    pending: 'Your identity verification is being reviewed by our team.',
    rejected: 'Your verification was rejected. Please submit new documents.',
  },
}

/**
 * Verification Gate Component
 * 
 * Wraps content that requires identity verification.
 * Shows appropriate messaging based on verification status.
 */
export function VerificationGate({ 
  status, 
  children, 
  action = 'default',
  variant = 'card'
}: VerificationGateProps) {
  // If verified, render children directly
  if (status === 'verified') {
    return <>{children}</>
  }

  const config = STATUS_CONFIG[status]
  const message = ACTION_MESSAGES[action][status]
  const Icon = config.icon

  if (variant === 'inline') {
    return (
      <Alert className={`${config.bgColor} ${config.borderColor}`}>
        <Icon className={`h-4 w-4 ${config.color}`} />
        <AlertTitle className={config.color}>{config.title}</AlertTitle>
        <AlertDescription>
          {message}
          {status === 'unverified' && (
            <Button asChild variant="link" className="p-0 h-auto ml-1">
              <Link href="/dashboard/profile?tab=verification">Verify now →</Link>
            </Button>
          )}
          {status === 'rejected' && (
            <Button asChild variant="link" className="p-0 h-auto ml-1">
              <Link href="/dashboard/profile?tab=verification">Resubmit documents →</Link>
            </Button>
          )}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Card className={`${config.bgColor} ${config.borderColor} border-2`}>
      <CardHeader className="text-center pb-2">
        <div className="mx-auto mb-2">
          <Icon className={`h-12 w-12 ${config.color}`} />
        </div>
        <CardTitle className={config.color}>{config.title}</CardTitle>
        <CardDescription className="text-base">
          {message}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        {status === 'unverified' && (
          <Button asChild size="lg">
            <Link href="/dashboard/profile?tab=verification">
              <ShieldAlert className="mr-2 h-4 w-4" />
              Verify Your Identity
            </Link>
          </Button>
        )}
        {status === 'pending' && (
          <p className="text-sm text-muted-foreground">
            This usually takes 1-2 business days. We&apos;ll notify you when complete.
          </p>
        )}
        {status === 'rejected' && (
          <Button asChild size="lg" variant="destructive">
            <Link href="/dashboard/profile?tab=verification">
              <XCircle className="mr-2 h-4 w-4" />
              Resubmit Documents
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Verification Status Badge
 * 
 * Small inline badge showing verification status
 */
interface VerificationBadgeProps {
  status: VerificationStatus
  showLabel?: boolean
}

export function VerificationBadge({ status, showLabel = true }: VerificationBadgeProps) {
  const config = STATUS_CONFIG[status]
  const Icon = config.icon

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${config.color}`}>
      <Icon className="h-3 w-3" />
      {showLabel && <span>{config.title}</span>}
    </span>
  )
}
