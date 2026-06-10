import { z } from 'zod'

// Listing schemas
export const listingCategorySchema = z.enum([
  'beach',
  'mountain',
  'city',
  'countryside',
  'tropical',
  'lakefront',
  'skiing',
  'camping',
  'desert',
  'arctic',
])

export type ListingCategory = z.infer<typeof listingCategorySchema>

export const createListingSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(100),
  description: z.string().min(20, 'Description must be at least 20 characters').max(2000),
  pricePerNight: z.number().positive('Price must be positive').max(10000),
  location: z.string().min(1, 'Location is required'),
  country: z.string().min(1, 'Country is required'),
  maxGuests: z.number().int().min(1, 'At least 1 guest').max(16, 'Maximum 16 guests'),
  bedrooms: z.number().int().min(0).max(50),
  beds: z.number().int().min(1, 'At least 1 bed').max(50),
  bathrooms: z.number().int().min(0).max(50),
  category: listingCategorySchema,

  images: z.array(z.string().url()).min(1, 'At least one image required'),
})

export type CreateListingInput = z.infer<typeof createListingSchema>

export const listingSchema = createListingSchema.extend({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type Listing = z.infer<typeof listingSchema>

// Booking schemas
export const createBookingSchema = z.object({
  listingId: z.string().uuid(),
  checkIn: z.coerce.date(),
  checkOut: z.coerce.date(),
  guests: z.number().int().min(1, 'At least 1 guest'),
}).refine(data => data.checkOut > data.checkIn, {
  message: 'Check-out must be after check-in',
  path: ['checkOut'],
})

export type CreateBookingInput = z.infer<typeof createBookingSchema>

export const bookingSchema = createBookingSchema.extend({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  totalPrice: z.number().positive(),
  status: z.enum(['pending', 'confirmed', 'cancelled', 'completed']),
  createdAt: z.string().datetime(),
})

export type Booking = z.infer<typeof bookingSchema>

// Search schemas
export const searchSchema = z.object({
  location: z.string().optional(),
  checkIn: z.coerce.date().optional(),
  checkOut: z.coerce.date().optional(),
  guests: z.number().int().min(1).optional(),
  category: listingCategorySchema.optional(),
  minPrice: z.number().positive().optional(),
  maxPrice: z.number().positive().optional(),
})

export type SearchInput = z.infer<typeof searchSchema>

// Auth schemas
export const signUpSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(6, 'Name must be at least 6 characters'),
  acceptTerms: z.boolean().refine(val => val === true, {
    message: 'You must accept the terms and conditions to continue'
  }),
})

export type SignUpInput = z.infer<typeof signUpSchema>

export const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

export type SignInInput = z.infer<typeof signInSchema>

// Profile schema
export const profileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string(),
  avatarUrl: z.string().url().nullable(),
  bio: z.string().max(500).nullable(),
  isHost: z.boolean().default(false),
  createdAt: z.string().datetime(),
})

export type Profile = z.infer<typeof profileSchema>
