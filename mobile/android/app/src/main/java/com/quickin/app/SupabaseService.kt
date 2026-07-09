package com.quickin.app

import androidx.annotation.StringRes
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/**
 * Sort orders accepted by the listings endpoint (`sort=`). [labelRes] is the translated chip
 * label resolved at render time via stringResource (see ui/ListingsScreen SortRow).
 */
enum class ListingSort(val apiValue: String, @StringRes val labelRes: Int) {
    Recommended("recommended", R.string.sort_recommended),
    PriceAsc("price_asc", R.string.sort_price_low),
    PriceDesc("price_desc", R.string.sort_price_high),
    Newest("newest", R.string.sort_newest)
}

/** Search filters for the listings endpoint. Blank/null fields are omitted from the query. */
data class ListingQuery(
    val location: String? = null,
    val guests: Int? = null,
    val checkIn: String? = null,  // yyyy-MM-dd
    val checkOut: String? = null, // yyyy-MM-dd
    /** Exact curated region (e.g. "Ain Sokhna"); null = all regions. */
    val region: String? = null,
    /** Free-text query (`q=`); null/blank when unused. */
    val q: String? = null,
    val minPrice: Int? = null,
    val maxPrice: Int? = null,
    /**
     * Property type (`propertyType=`), one of the canonical API values
     * (Apartment, Chalet, House, Villa); null = any type.
     */
    val propertyType: String? = null,
    /**
     * Required amenities (`amenities=`), sent comma-joined; the listing must have ALL of them.
     * Canonical English values (e.g. "WiFi", "Pool"); empty = no amenity filter.
     */
    val amenities: Set<String> = emptySet(),
    /**
     * Map viewport box for "Search this area" (`bbox=`), formatted
     * `minLng,minLat,maxLng,maxLat` (GeoJSON west,south,east,north); null when unused.
     */
    val bbox: String? = null,
    /** Result ordering; defaults to Recommended (omitted from the query when Recommended). */
    val sort: ListingSort = ListingSort.Recommended
) {
    val isActive: Boolean
        get() = !location.isNullOrBlank() || (guests != null && guests > 0) ||
            !checkIn.isNullOrBlank() || !checkOut.isNullOrBlank() ||
            !region.isNullOrBlank() || !q.isNullOrBlank() ||
            minPrice != null || maxPrice != null ||
            !propertyType.isNullOrBlank() || amenities.isNotEmpty() ||
            !bbox.isNullOrBlank() || sort != ListingSort.Recommended

    /** Count of active discovery filters (property type + each amenity) for the Filters badge. */
    val discoveryFilterCount: Int
        get() = (if (!propertyType.isNullOrBlank()) 1 else 0) + amenities.size
}

/**
 * Minimal HTTP client for the local Next.js API — just enough to browse + search listings.
 * No third-party HTTP/JSON libraries: HttpURLConnection + org.json.
 */
object SupabaseService {

    suspend fun fetchListings(query: ListingQuery = ListingQuery()): List<Listing> = withContext(Dispatchers.IO) {
        val urlStr = "${Config.API_BASE_URL}/api/local/listings" + buildQueryString(query)

        val conn = (URL(urlStr).openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 15_000
            readTimeout = 15_000
            setRequestProperty("Accept", "application/json")
        }

        try {
            val code = conn.responseCode
            val stream = if (code in 200..299) conn.inputStream else conn.errorStream
            val body = stream?.bufferedReader()?.use { it.readText() } ?: ""
            if (code !in 200..299) {
                throw RuntimeException("Server error $code: $body")
            }
            parseListings(body)
        } finally {
            conn.disconnect()
        }
    }

    /**
     * Curated browse regions with live listing counts (`GET /api/local/regions`),
     * e.g. [ {"region":"North Coast","count":3}, ... ]. Returns an empty list on any
     * failure so the explore screen can simply fall back to "All".
     */
    suspend fun fetchRegions(): List<Region> = withContext(Dispatchers.IO) {
        runCatching {
            val conn = (URL("${Config.API_BASE_URL}/api/local/regions").openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 15_000
                readTimeout = 15_000
                setRequestProperty("Accept", "application/json")
            }
            try {
                val code = conn.responseCode
                if (code !in 200..299) return@runCatching emptyList<Region>()
                val body = conn.inputStream.bufferedReader().use { it.readText() }
                val arr = JSONArray(body)
                val out = ArrayList<Region>(arr.length())
                for (i in 0 until arr.length()) {
                    val o = arr.getJSONObject(i)
                    val name = o.optString("region")
                    if (name.isNotBlank()) out.add(Region(region = name, count = o.optInt("count", 0)))
                }
                out
            } finally {
                conn.disconnect()
            }
        }.getOrElse { emptyList() }
    }

    /**
     * The listings published by a single host (`GET /api/local/listings?host=<host_id>`),
     * used by the listing detail's "More from this host" rail. Returns an empty list on any
     * failure (or a blank [hostId]) so the section can simply hide itself.
     */
    suspend fun fetchHostListings(hostId: String): List<Listing> = withContext(Dispatchers.IO) {
        if (hostId.isBlank()) return@withContext emptyList()
        runCatching {
            val urlStr = "${Config.API_BASE_URL}/api/local/listings?host=${URLEncoder.encode(hostId, "UTF-8")}"
            val conn = (URL(urlStr).openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 15_000
                readTimeout = 15_000
                setRequestProperty("Accept", "application/json")
            }
            try {
                val code = conn.responseCode
                if (code !in 200..299) return@runCatching emptyList<Listing>()
                val body = conn.inputStream.bufferedReader().use { it.readText() }
                parseListings(body)
            } finally {
                conn.disconnect()
            }
        }.getOrElse { emptyList() }
    }

    /**
     * Fetches a single listing by [listingId] (`GET /api/local/listings/:id`), used to open a
     * shared deep link straight into its detail. Returns null on any failure (or a blank id) so
     * the caller can fall back to opening the app normally rather than crashing.
     */
    suspend fun fetchListing(listingId: String): Listing? = withContext(Dispatchers.IO) {
        if (listingId.isBlank()) return@withContext null
        runCatching {
            val urlStr = "${Config.API_BASE_URL}/api/local/listings/${URLEncoder.encode(listingId, "UTF-8")}"
            val conn = (URL(urlStr).openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 15_000
                readTimeout = 15_000
                setRequestProperty("Accept", "application/json")
            }
            try {
                val code = conn.responseCode
                if (code !in 200..299) return@runCatching null
                val body = conn.inputStream.bufferedReader().use { it.readText() }
                parseListing(org.json.JSONObject(body))
            } finally {
                conn.disconnect()
            }
        }.getOrNull()
    }

    /**
     * The listing's unavailable spans (`GET /api/local/listings/:id/availability`) — booked +
     * host-blocked ranges, each half-open `[start, end)`. Public (no auth). Used to grey out
     * days in the guest date picker and to show the host's current blocks. Returns an empty list
     * on any failure (or a blank id) so the picker simply allows every day.
     */
    suspend fun fetchAvailability(listingId: String): List<AvailabilityRange> = withContext(Dispatchers.IO) {
        if (listingId.isBlank()) return@withContext emptyList()
        runCatching {
            val urlStr = "${Config.API_BASE_URL}/api/local/listings/${URLEncoder.encode(listingId, "UTF-8")}/availability"
            val conn = (URL(urlStr).openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 15_000
                readTimeout = 15_000
                setRequestProperty("Accept", "application/json")
            }
            try {
                val code = conn.responseCode
                if (code !in 200..299) return@runCatching emptyList<AvailabilityRange>()
                val body = conn.inputStream.bufferedReader().use { it.readText() }
                parseAvailability(body)
            } finally {
                conn.disconnect()
            }
        }.getOrElse { emptyList() }
    }

    /**
     * The authoritative stay quote for a chosen range
     * (`POST /api/local/listings/:id/quote { checkIn, checkOut }`, public — no auth). The backend
     * honors the weekend rate, per-month overrides, and the length-of-stay discount, returning the
     * exact subtotal/total. Dates are yyyy-MM-dd. Returns null on any failure (or blank id/dates) so
     * the reserve panel can fall back to its base estimate and never block the UI.
     */
    suspend fun fetchStayQuote(listingId: String, checkIn: String, checkOut: String): StayQuote? =
        withContext(Dispatchers.IO) {
            if (listingId.isBlank() || checkIn.isBlank() || checkOut.isBlank()) return@withContext null
            runCatching {
                val payload = org.json.JSONObject().apply {
                    put("checkIn", checkIn)
                    put("checkOut", checkOut)
                }
                val urlStr = "${Config.API_BASE_URL}/api/local/listings/${URLEncoder.encode(listingId, "UTF-8")}/quote"
                val conn = (URL(urlStr).openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    connectTimeout = 15_000
                    readTimeout = 15_000
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                    setRequestProperty("Accept", "application/json")
                }
                try {
                    conn.outputStream.use { out -> out.write(payload.toString().toByteArray(Charsets.UTF_8)) }
                    val code = conn.responseCode
                    if (code !in 200..299) return@runCatching null
                    val body = conn.inputStream.bufferedReader().use { it.readText() }
                    parseStayQuote(org.json.JSONObject(body))
                } finally {
                    conn.disconnect()
                }
            }.getOrNull()
        }

    /** Parses the `{ nights, subtotal, discountPercent, total, nightlyAvg, currency, hasSeasonalPricing }` quote. */
    private fun parseStayQuote(o: org.json.JSONObject): StayQuote = StayQuote(
        nights = o.optInt("nights", 0),
        subtotal = o.optDouble("subtotal", 0.0).takeUnless { it.isNaN() } ?: 0.0,
        discountPercent = o.optInt("discountPercent", 0),
        total = o.optDouble("total", 0.0).takeUnless { it.isNaN() } ?: 0.0,
        nightlyAvg = o.optDouble("nightlyAvg", 0.0).takeUnless { it.isNaN() } ?: 0.0,
        currency = o.optString("currency").ifBlank { "EGP" },
        hasSeasonalPricing = o.optBoolean("hasSeasonalPricing", false)
    )

    /**
     * Static FX rates for multi-currency display (`GET /api/local/currencies`), e.g.
     * { base:"EGP", rates:{ EGP:1, USD:0.0203, … } }. Public (no auth). Returns null on any failure
     * so [com.quickin.app.CurrencyManager] can fall back to its baked-in static rates and the app
     * still works fully offline / without the local stack.
     */
    suspend fun fetchCurrencies(): CurrencyRates? = withContext(Dispatchers.IO) {
        runCatching {
            val conn = (URL("${Config.API_BASE_URL}/api/local/currencies").openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 15_000
                readTimeout = 15_000
                setRequestProperty("Accept", "application/json")
            }
            try {
                val code = conn.responseCode
                if (code !in 200..299) return@runCatching null
                val body = conn.inputStream.bufferedReader().use { it.readText() }
                val o = org.json.JSONObject(body)
                val ratesObj = o.optJSONObject("rates") ?: return@runCatching null
                val rates = LinkedHashMap<String, Double>(ratesObj.length())
                val keys = ratesObj.keys()
                while (keys.hasNext()) {
                    val key = keys.next()
                    val v = ratesObj.optDouble(key, Double.NaN)
                    if (!v.isNaN()) rates[key.uppercase()] = v
                }
                if (rates.isEmpty()) null
                else CurrencyRates(base = o.optString("base").ifBlank { "EGP" }.uppercase(), rates = rates)
            } finally {
                conn.disconnect()
            }
        }.getOrNull()
    }

    /**
     * Natural-language search (`POST /api/local/ai/search { query }`, public — no auth). The AI parses
     * the guest's prose into structured [AiSearchFilters] and returns the matching [listings] (same
     * shape as the explore feed). Reuses [parseListing] for the listing array. Throws on a non-2xx so
     * the caller can surface a friendly note ("AI search isn't available right now").
     */
    suspend fun aiSearch(query: String): AiSearchResult = withContext(Dispatchers.IO) {
        val payload = org.json.JSONObject().apply { put("query", query.trim()) }
        val conn = (URL("${Config.API_BASE_URL}/api/local/ai/search").openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 15_000
            // The AI parse can take a moment; keep the read timeout generous.
            readTimeout = 60_000
            doOutput = true
            setRequestProperty("Content-Type", "application/json")
            setRequestProperty("Accept", "application/json")
        }
        try {
            conn.outputStream.use { out -> out.write(payload.toString().toByteArray(Charsets.UTF_8)) }
            val code = conn.responseCode
            val stream = if (code in 200..299) conn.inputStream else conn.errorStream
            val body = stream?.bufferedReader()?.use { it.readText() } ?: ""
            if (code !in 200..299) {
                val msg = runCatching { org.json.JSONObject(body).optString("error") }.getOrNull()
                throw RuntimeException(msg?.takeUnless { it.isBlank() } ?: "AI search failed ($code)")
            }
            parseAiSearch(org.json.JSONObject(body))
        } finally {
            conn.disconnect()
        }
    }

    /** Parses the `{ filters, listings, ai }` envelope from `POST /api/local/ai/search`. */
    private fun parseAiSearch(o: org.json.JSONObject): AiSearchResult {
        val f = o.optJSONObject("filters")
        val filters = if (f == null) AiSearchFilters() else {
            val amenitiesArr = f.optJSONArray("amenities")
            val amenities = ArrayList<String>()
            if (amenitiesArr != null) {
                for (i in 0 until amenitiesArr.length()) {
                    amenitiesArr.optString(i).takeUnless { it.isBlank() }?.let { amenities.add(it) }
                }
            }
            AiSearchFilters(
                q = f.optStringOrNull("q"),
                region = f.optStringOrNull("region"),
                guests = f.optIntOrNull("guests")?.takeIf { it > 0 },
                minPrice = f.optIntOrNull("minPrice"),
                maxPrice = f.optIntOrNull("maxPrice"),
                propertyType = f.optStringOrNull("propertyType"),
                amenities = amenities
            )
        }
        val listingsArr = o.optJSONArray("listings")
        val listings = if (listingsArr == null) emptyList() else {
            val out = ArrayList<Listing>(listingsArr.length())
            for (i in 0 until listingsArr.length()) out.add(parseListing(listingsArr.getJSONObject(i)))
            out
        }
        return AiSearchResult(filters = filters, listings = listings)
    }

    /** Parses a JSON array of availability spans (shared by the reserve picker + host manager). */
    fun parseAvailability(json: String): List<AvailabilityRange> {
        val arr = JSONArray(json)
        val out = ArrayList<AvailabilityRange>(arr.length())
        for (i in 0 until arr.length()) {
            val o = arr.getJSONObject(i)
            val start = o.optString("start")
            val end = o.optString("end")
            if (start.isBlank() || end.isBlank()) continue
            out.add(
                AvailabilityRange(
                    id = o.optString("id"),
                    start = start,
                    end = end,
                    kind = o.optString("kind").ifBlank { "blocked" },
                    note = o.optString("note").ifBlank { null }
                )
            )
        }
        return out
    }

    /** Parses a JSON array of listings. Also reused by [BookingService] for the host feed. */
    fun parseListings(json: String): List<Listing> {
        val arr = JSONArray(json)
        val result = ArrayList<Listing>(arr.length())
        for (i in 0 until arr.length()) {
            result.add(parseListing(arr.getJSONObject(i)))
        }
        return result
    }

    /** Parses one listing object (shared by the explore feed and `POST /api/local/listings`). */
    fun parseListing(o: org.json.JSONObject): Listing {
        val imagesArr = o.optJSONArray("listing_images")
        val images = ArrayList<ListingImage>()
        if (imagesArr != null) {
            for (j in 0 until imagesArr.length()) {
                val img = imagesArr.getJSONObject(j)
                images.add(
                    ListingImage(
                        url = img.optString("url"),
                        order = img.optInt("order", 0)
                    )
                )
            }
        }
        // Amenity labels (e.g. "WiFi", "Pool") — a JSON array of strings, or absent.
        val amenitiesArr = o.optJSONArray("amenities")
        val amenities = ArrayList<String>()
        if (amenitiesArr != null) {
            for (j in 0 until amenitiesArr.length()) {
                amenitiesArr.optString(j).takeUnless { it.isBlank() }?.let { amenities.add(it) }
            }
        }
        // Per-month nightly overrides — a JSON object { "7": 8500, ... } keyed by month "1".."12".
        // Absent / null → empty. Only positive numeric values are kept.
        val monthlyPricesObj = if (o.isNull("monthly_prices")) null else o.optJSONObject("monthly_prices")
        val monthlyPrices = LinkedHashMap<String, Double>()
        if (monthlyPricesObj != null) {
            val keys = monthlyPricesObj.keys()
            while (keys.hasNext()) {
                val key = keys.next()
                val v = monthlyPricesObj.optDouble(key, Double.NaN)
                if (!v.isNaN() && v > 0.0) monthlyPrices[key] = v
            }
        }
        return Listing(
            id = o.optString("id"),
            title = o.optString("title"),
            description = o.optStringOrNull("description"),
            location = o.optStringOrNull("location"),
            hostId = o.optStringOrNull("host_id"),
            hostName = o.optStringOrNull("host_name"),
            region = o.optStringOrNull("region"),
            propertyType = o.optStringOrNull("property_type"),
            pricePerNight = o.optDouble("price_per_night", 0.0),
            currency = o.optStringOrNull("currency"),
            bedrooms = o.optIntOrNull("bedrooms"),
            beds = o.optIntOrNull("beds"),
            bathrooms = o.optIntOrNull("bathrooms"),
            maxGuests = o.optIntOrNull("max_guests"),
            isGuestFavorite = o.optBoolean("is_guest_favorite", false),
            listingCode = o.optStringOrNull("listing_code"),
            lat = o.optDoubleOrNull("lat"),
            lng = o.optDoubleOrNull("lng"),
            images = images,
            amenities = amenities,
            rating = o.optDouble("rating", 0.0).takeUnless { it.isNaN() } ?: 0.0,
            reviewCount = o.optInt("review_count", 0),
            cancellationPolicy = o.optString("cancellation_policy").ifBlank { "moderate" },
            hostVerified = o.optBoolean("host_verified", false),
            // Moderation state for the host's own listings; absent on public feeds → "approved".
            approvalStatus = o.optString("approval_status").ifBlank { "approved" },
            // Length-of-stay discounts (% off); absent → 0 = none.
            weeklyDiscount = o.optInt("weekly_discount", 0),
            monthlyDiscount = o.optInt("monthly_discount", 0),
            // Seasonal/variable pricing: weekend nightly rate (null when unset) + per-month overrides.
            weekendPrice = o.optDoubleOrNull("weekend_price"),
            monthlyPrices = monthlyPrices
        )
    }
}

/** Builds "?location=...&guests=...&region=...&q=...&sort=..." from the active filters. */
private fun buildQueryString(query: ListingQuery): String {
    val params = ArrayList<String>(11)
    fun add(key: String, value: String?) {
        if (!value.isNullOrBlank()) {
            params.add("$key=${URLEncoder.encode(value, "UTF-8")}")
        }
    }
    add("location", query.location?.trim())
    if (query.guests != null && query.guests > 0) add("guests", query.guests.toString())
    add("checkIn", query.checkIn)
    add("checkOut", query.checkOut)
    add("region", query.region?.trim())
    add("q", query.q?.trim())
    if (query.minPrice != null) add("minPrice", query.minPrice.toString())
    if (query.maxPrice != null) add("maxPrice", query.maxPrice.toString())
    add("propertyType", query.propertyType?.trim())
    // Amenities: comma-joined canonical values; the listing must have ALL of them.
    if (query.amenities.isNotEmpty()) add("amenities", query.amenities.joinToString(","))
    // Map viewport for "Search this area": minLng,minLat,maxLng,maxLat (encoded as a whole).
    add("bbox", query.bbox?.trim())
    // Recommended is the server default; only send an explicit sort otherwise.
    if (query.sort != ListingSort.Recommended) add("sort", query.sort.apiValue)
    return if (params.isEmpty()) "" else "?" + params.joinToString("&")
}

private fun org.json.JSONObject.optStringOrNull(key: String): String? =
    if (isNull(key)) null else optString(key).ifEmpty { null }

private fun org.json.JSONObject.optIntOrNull(key: String): Int? =
    if (isNull(key) || !has(key)) null else optInt(key)

private fun org.json.JSONObject.optDoubleOrNull(key: String): Double? =
    if (isNull(key) || !has(key)) null else optDouble(key).takeUnless { it.isNaN() }
