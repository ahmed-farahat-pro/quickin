'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Check, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface CodeBadgeProps {
  code: string
  label?: string
  variant?: 'default' | 'secondary' | 'destructive' | 'outline'
  className?: string
  showIcon?: boolean
}

export function CodeBadge({ 
  code, 
  label, 
  variant = 'secondary', 
  className,
  showIcon = true
}: CodeBadgeProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent triggering parent click handlers (e.g., card click)
    
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      toast.success('Code copied to clipboard')
      
      setTimeout(() => {
        setCopied(false)
      }, 2000)
    } catch {
      toast.error('Failed to copy code')
    }
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant={variant} 
            className={cn(
              "font-mono cursor-pointer hover:opacity-80 transition-opacity gap-1.5 pr-2", 
              className
            )}
            onClick={handleCopy}
          >
            {label && <span className="text-muted-foreground font-sans">{label}:</span>}
            <span className="select-all">{code}</span>
            {showIcon && (
              copied ? (
                <Check className="h-3 w-3 text-green-500 animate-in zoom-in" />
              ) : (
                <Copy className="h-3 w-3 text-muted-foreground opacity-50" />
              )
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs">{copied ? 'Copied!' : 'Click to copy'}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
