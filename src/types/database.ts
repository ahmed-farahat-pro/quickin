// Database types matching Supabase schema
// These types match the tables in supabase/migrations/001_initial_schema.sql

export type Profile = {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  bio: string | null
  phone: string | null
  is_host: boolean
  created_at: string
  updated_at: string
}

export type PropertyType = {
  id: string
  name: string
  slug: string
  type: 'home' | 'service'
  description: string | null
  icon: string | null
  created_at: string
}

export type LifestyleCategory = {
  id: string
  name: string
  slug: string
  icon: string | null
  is_special: boolean
  display_order: number
  created_at: string
}

// Legacy alias - but prefer LifestyleCategory
export type Category = LifestyleCategory

export type Listing = {
  id: string
  user_id: string
  title: string
  description: string | null
  price_per_night: number
  location: string
  city: string | null
  state: string | null
  country: string
  location_geo: string | null
  lat?: number | null
  lng?: number | null
  max_guests: number
  bedrooms: number
  beds: number
  bathrooms: number
  property_type_id: string | null

  is_guest_favorite: boolean
  is_published: boolean
  cleaning_fee: number
  currency: string
  cancellation_policy: string | null
  created_at: string
  updated_at: string
}

export type ListingWithHost = Listing & {
  host: Profile
  is_staff_hosted?: boolean
  property_type: PropertyType | null
  listing_lifestyles: {
    lifestyle_category: LifestyleCategory
    is_primary: boolean
  }[]
  rating: number
  review_count: number
  listing_images: ListingImage[]
  images: string[]           // Flattened URLs for backward compatibility
  best_offer_price?: number | null
  display_price?: number       // Today's price or avg nightly price over selected dates
  total_price?: number | null  // Total stay cost (only when dates are selected)
  num_nights?: number | null   // Number of nights (only when dates are selected)
  _total_count: number         // Used for tracking pagination limits correctly
}

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed'

export interface ImageCategory {
  slug: string
  label: string
  icon: string | null
  is_active: boolean
}

export interface ListingImage {
  id: string
  listing_id: string
  url: string
  category: string // Foreign key to image_categories.slug
  category_details?: ImageCategory // Joined data
  caption: string | null
  order: number
  created_at: string
}

export interface Booking {
  id: string
  listing_id: string
  user_id: string
  check_in: string
  check_out: string
  guests: number
  subtotal: number
  best_offer_subtotal: number
  commission_rate_id: string | null
  status: BookingStatus
  created_at: string
  updated_at: string
}

export type BookingWithDetails = Booking & {
  listing: Listing
  user: Profile
}

export type Favorite = {
  id: string
  user_id: string
  listing_id: string
  created_at: string
}

export type Review = {
  id: string
  listing_id: string
  user_id: string
  booking_id: string | null
  rating: number
  rating_accuracy: number
  rating_cleanliness: number
  rating_communication: number
  rating_location: number
  rating_check_in: number
  rating_value: number
  is_hidden: boolean
  comment: string | null
  private_feedback: PrivateMessage[] | null
  created_at: string
  updated_at: string
}

export interface PrivateMessage {
  role: 'guest' | 'host' | 'admin'
  message: string
  created_at: string
  sender_id?: string
}

export interface FilterableAttribute {
  id: string
  code: string
  label: string
  icon_class: string | null
}

export type ReviewWithUser = Review & {
  user: Profile
}

export type ListingComment = {
  id: string
  listing_id: string
  user_id: string
  parent_id: string | null
  content: string
  is_hidden: boolean
  is_host_reported: boolean
  created_at: string
  updated_at: string
}

export type ListingCommentVote = {
  id: string
  comment_id: string
  user_id: string
  vote_type: 1 | -1
  created_at: string
}

export type ListingCommentWithDetails = ListingComment & {
  user: Profile
  replies?: ListingCommentWithDetails[]
  upvotes: number
  downvotes: number
  user_vote?: 1 | -1 | null
}

// Database insert types (without auto-generated fields)
export type ProfileInsert = Omit<Profile, 'created_at' | 'updated_at'>
export type ListingInsert = Omit<Listing, 'id' | 'created_at' | 'updated_at'>
export type BookingInsert = Omit<Booking, 'id' | 'created_at' | 'updated_at'>
export type ReviewInsert = Omit<Review, 'id' | 'created_at' | 'updated_at'>
export type FavoriteInsert = Omit<Favorite, 'id' | 'created_at'>
export type ListingCommentInsert = Omit<ListingComment, 'id' | 'created_at' | 'updated_at' | 'is_hidden' | 'is_host_reported'>
export type ListingCommentVoteInsert = Omit<ListingCommentVote, 'id' | 'created_at'>

// Database update types (partial)
export type ProfileUpdate = Partial<Omit<Profile, 'id' | 'email' | 'created_at' | 'updated_at'>>
export type ListingUpdate = Partial<Omit<Listing, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
export type BookingUpdate = Partial<Pick<Booking, 'status'>>
export type ReviewUpdate = Partial<Pick<Review, 'rating' | 'rating_accuracy' | 'rating_cleanliness' | 'rating_communication' | 'rating_location' | 'rating_check_in' | 'rating_value' | 'comment'>>
export type ListingCommentUpdate = Partial<Pick<ListingComment, 'content' | 'is_hidden' | 'is_host_reported'>>

export type DestinationType = 'city' | 'area' | 'curated'

export type SearchDestination = {
  id: string
  label: string
  en_label?: string // Contains actual english db column text, whereas label gets translated
  description: string | null
  image_url: string | null
  location: string | null
  radius_km: number
  type: DestinationType
  country: string
  include_surrounding: boolean
  listing_ids: string[]
  is_active: boolean
  display_order: number
  created_at: string
  updated_at?: string
  translations?: Record<string, any> | null
  // Resolved from PostGIS — populated by get_active_destinations_with_coords() RPC
  lat?: number | null
  lng?: number | null
}

export type SearchDestinationInsert = Omit<SearchDestination, 'id' | 'created_at' | 'updated_at'>
export type SearchDestinationUpdate = Partial<Omit<SearchDestination, 'id' | 'created_at' | 'updated_at'>>
