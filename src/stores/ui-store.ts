import { create } from 'zustand'

interface UIState {
  isMobileMenuOpen: boolean
  isSearchModalOpen: boolean
  isAuthModalOpen: boolean
  authModalView: 'login' | 'signup' | 'forgot-password' | 'reset-password' | 'mfa-verify' | 'signup-success'
  isChatOpen: boolean
  toggleMobileMenu: () => void
  toggleSearchModal: () => void
  openAuthModal: (view: 'login' | 'signup' | 'forgot-password' | 'reset-password' | 'mfa-verify' | 'signup-success') => void
  closeAuthModal: () => void
  toggleChat: () => void
  closeChat: () => void

  // Global loading state
  loadingKeys: Set<string>
  startLoading: (key: string) => void
  stopLoading: (key: string) => void
  isAnyLoading: () => boolean
}

export const useUIStore = create<UIState>((set, get) => ({
  isMobileMenuOpen: false,
  isSearchModalOpen: false,
  isAuthModalOpen: false,
  authModalView: 'login',
  isChatOpen: false,
  toggleMobileMenu: () => set((state) => ({ isMobileMenuOpen: !state.isMobileMenuOpen })),
  toggleSearchModal: () => set((state) => ({ isSearchModalOpen: !state.isSearchModalOpen })),
  openAuthModal: (view) => set({ isAuthModalOpen: true, authModalView: view }),
  closeAuthModal: () => set({ isAuthModalOpen: false }),
  toggleChat: () => set((state) => ({ isChatOpen: !state.isChatOpen })),
  closeChat: () => set({ isChatOpen: false }),

  // Global loading state
  loadingKeys: new Set(),
  startLoading: (key) => set((state) => {
    const next = new Set(state.loadingKeys)
    next.add(key)
    return { loadingKeys: next }
  }),
  stopLoading: (key) => set((state) => {
    const next = new Set(state.loadingKeys)
    next.delete(key)
    return { loadingKeys: next }
  }),
  isAnyLoading: () => get().loadingKeys.size > 0,
}))
