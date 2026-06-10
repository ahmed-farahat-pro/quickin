'use client'

import { DirectionProvider } from '@radix-ui/react-direction'

interface AppDirectionProviderProps {
  dir: 'ltr' | 'rtl'
  children: React.ReactNode
}

export function AppDirectionProvider({
  dir,
  children,
}: AppDirectionProviderProps) {
  return <DirectionProvider dir={dir}>{children}</DirectionProvider>
}

