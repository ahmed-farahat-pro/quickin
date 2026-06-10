package com.quickin.app

/** A photo attached to a listing (from the `listing_images` table). */
data class ListingImage(
    val url: String,
    val order: Int = 0
)

/** A QuickIn listing (subset of columns needed for browse + detail). */
data class Listing(
    val id: String,
    val title: String,
    val description: String?,
    val location: String?,
    val pricePerNight: Double,
    val currency: String?,
    val bedrooms: Int?,
    val beds: Int?,
    val bathrooms: Int?,
    val maxGuests: Int?,
    val isGuestFavorite: Boolean,
    val listingCode: String?,
    val lat: Double? = null,
    val lng: Double? = null,
    val images: List<ListingImage>
) {
    /** Photo URLs sorted by their order, falling back to a stock image. */
    val sortedImageUrls: List<String>
        get() {
            val urls = images.sortedBy { it.order }.map { it.url }
            return urls.ifEmpty { listOf(PLACEHOLDER) }
        }

    val currencySymbol: String
        get() = when ((currency ?: "USD").uppercase()) {
            "USD" -> "$"
            "EUR" -> "€"
            "GBP" -> "£"
            "EGP" -> "E£"
            else -> (currency ?: "$") + " "
        }

    val priceText: String
        get() = "$currencySymbol${pricePerNight.toInt()}"

    companion object {
        const val PLACEHOLDER =
            "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&q=80"
    }
}

/** A reservation (from `GET /api/local/bookings`), with a joined listing summary. */
data class Booking(
    val id: String,
    val listingId: String,
    val checkIn: String,
    val checkOut: String,
    val guests: Int,
    val totalPrice: Double,
    val status: String?,
    val title: String,
    val location: String?,
    val image: String?
) {
    /** Image URL falling back to the shared stock photo. */
    val imageUrl: String
        get() = image?.takeUnless { it.isBlank() } ?: Listing.PLACEHOLDER

    val totalText: String
        get() = "$" + totalPrice.toInt()

    /** "2027-03-10 → 2027-03-14" */
    val dateRangeText: String
        get() = "$checkIn → $checkOut"
}
