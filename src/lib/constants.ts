/** Maximum number of days a best offer can span */
export const MAX_OFFER_DAYS = 30

/** Maximum rating a listing can receive */
export const MAX_RATING = 5

/** Threshold of reviews required to show the overall rating instead of "New" */
export const MIN_REVIEWS_THRESHOLD = 5

/** Default number of listings to fetch per page */
export const LISTINGS_PER_PAGE = 12

/** Shared rating categories with dual-perspective descriptions */
export const RATING_CATEGORIES = [
  { 
    id: 'rating_cleanliness', 
    label: 'Cleanliness', 
    guest_form_desc: 'Was the place as clean as you expected it to be? This covers all rooms and surfaces.',
    listing_stat_desc: 'How clean guests found this home to be, covering all rooms and surfaces.'
  },
  { 
    id: 'rating_accuracy', 
    label: 'Accuracy', 
    guest_form_desc: 'How accurately did the listing photos and description represent the actual place?',
    listing_stat_desc: 'How accurately guests felt the photos and description represented the actual place.'
  },
  { 
    id: 'rating_communication', 
    label: 'Communication', 
    guest_form_desc: 'How responsive and helpful was the host before and during your stay?',
    listing_stat_desc: 'How responsive and helpful guests found the host to be before and during their stay.'
  },
  { 
    id: 'rating_location', 
    label: 'Location', 
    guest_form_desc: 'Did the area meet your expectations and was the listed location accurate?',
    listing_stat_desc: 'How guests rated the accuracy of the location and whether the area met their expectations.'
  },
  { 
    id: 'rating_check_in', 
    label: 'Check-in', 
    guest_form_desc: 'How easy was the check-in process? Did the host provide clear instructions?',
    listing_stat_desc: 'How easy guests found the check-in process and the clarity of instructions provided.'
  },
  { 
    id: 'rating_value', 
    label: 'Value', 
    guest_form_desc: 'Was the stay worth the price paid compared to the experience provided?',
    listing_stat_desc: 'Whether guests felt the stay was a good value relative to the price and experience.'
  },
] as const

export type RatingCategoryId = (typeof RATING_CATEGORIES)[number]['id']

/** Default number of days before auto-completing a confirmed booking after check_out */
export const DEFAULT_AUTO_COMPLETE_DAYS = 3

/** Default number of days before auto-canceling a pending booking waiting for payment */
export const DEFAULT_AUTO_CANCEL_DAYS = 2
/** Egyptian Mobile Pattern: +20 followed by 10, 11, 12, or 15, then 8 digits */
export const EG_MOBILE_REGEX = /^\+201[0125][0-9]{8}$/

/** Egyptian Landline Pattern (approximate region codes + 7-8 digits) */
export const EG_LANDLINE_REGEX = /^\+20[2-9][0-9]{7,8}$/

/** The number of downvotes needed before a comment is automatically greyed out/collapsed */
export const MIN_DOWNVOTES_TO_HIDE_COMMENT = 3

/** The time window in minutes allowed for a user to edit or delete their own comment */
export const COMMENT_EDIT_WINDOW_MINUTES = 15

/** Maximum number of photos allowed for a listing */
export const MAX_LISTING_PHOTOS = 15
