import { create } from 'zustand'

interface DateRange {
  from: Date | undefined
  to: Date | undefined
}

interface SearchState {
  location: string
  dates: DateRange
  guests: number
  category: string | null
  minPrice: number | null
  maxPrice: number | null
  setLocation: (location: string) => void
  setDates: (dates: DateRange) => void
  setGuests: (guests: number) => void
  setCategory: (category: string | null) => void
  setPriceRange: (min: number | null, max: number | null) => void
  reset: () => void
}

const initialState = {
  location: '',
  dates: { from: undefined, to: undefined },
  guests: 1,
  category: null,
  minPrice: null,
  maxPrice: null,
}

export const useSearchStore = create<SearchState>((set) => ({
  ...initialState,
  setLocation: (location) => set({ location }),
  setDates: (dates) => set({ dates }),
  setGuests: (guests) => set({ guests }),
  setCategory: (category) => set({ category }),
  setPriceRange: (minPrice, maxPrice) => set({ minPrice, maxPrice }),
  reset: () => set(initialState),
}))
