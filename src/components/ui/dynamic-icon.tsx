'use client'

import * as LucideIcons from 'lucide-react'
import { LucideProps } from 'lucide-react'

interface DynamicIconProps extends LucideProps {
  name: string  // e.g., "lucide:wifi", "lucide:car"
}

/**
 * Dynamic icon component that renders Lucide icons by name.
 * Format: "lucide:icon-name" or just "icon-name"
 */
export function DynamicIcon({ name, ...props }: DynamicIconProps) {
  if (!name) return null

  // Parse the icon name - remove "lucide:" prefix if present
  let iconName = name.replace('lucide:', '').trim()
  
  // Convert kebab-case to PascalCase for Lucide icon lookup
  // e.g., "arrow-up-down" -> "ArrowUpDown"
  const pascalName = iconName
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('')

  // Get the icon from Lucide
  const IconComponent = (LucideIcons as any)[pascalName]

  if (!IconComponent) {
    // Fallback to a default icon if not found
    return <LucideIcons.Package {...props} />
  }

  return <IconComponent {...props} />
}
