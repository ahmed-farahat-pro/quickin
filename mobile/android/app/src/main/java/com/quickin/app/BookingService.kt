package com.quickin.app

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * Minimal HTTP client for the local Next.js bookings API.
 * No third-party HTTP/JSON libraries: HttpURLConnection + org.json, all on Dispatchers.IO.
 * The caller supplies the bearer token (read from SharedPreferences "qk_auth" / "token").
 *
 *   POST {base}/api/local/bookings  {listing_id, check_in, check_out, guests} -> 201 | {error}
 *   GET  {base}/api/local/bookings  -> [ {id, listing_id, check_in, check_out, guests,
 *                                         total_price, status, title, location, image} ]
 */
object BookingService {

    /** Thrown so callers can distinguish "sign in to reserve" (401) from validation (400). */
    class HttpError(val code: Int, message: String) : RuntimeException(message)

    /**
     * Reserves [listingId] for the given range. Dates must be yyyy-MM-dd.
     * Throws [HttpError] (401 not signed in, 400 e.g. "Those dates are not available").
     */
    suspend fun createBooking(
        token: String,
        listingId: String,
        checkIn: String,
        checkOut: String,
        guests: Int
    ): Booking = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("listing_id", listingId)
            put("check_in", checkIn)
            put("check_out", checkOut)
            put("guests", guests)
        }

        val conn = (URL("${Config.API_BASE_URL}/api/local/bookings").openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 15_000
            readTimeout = 15_000
            doOutput = true
            setRequestProperty("Content-Type", "application/json")
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Authorization", "Bearer $token")
        }

        try {
            conn.outputStream.use { out ->
                out.write(body.toString().toByteArray(Charsets.UTF_8))
            }
            val code = conn.responseCode
            val text = readBody(conn, code)
            if (code !in 200..299) {
                throw HttpError(code, extractError(text, code))
            }
            parseBooking(JSONObject(text))
        } finally {
            conn.disconnect()
        }
    }

    /** Lists the signed-in user's reservations. Throws [HttpError] (401 when not signed in). */
    suspend fun fetchBookings(token: String): List<Booking> = withContext(Dispatchers.IO) {
        val text = get(token, "/api/local/bookings")
        parseBookings(text)
    }

    /**
     * MOCK payment for a booking (`POST /api/local/bookings/:id/pay {method}`).
     * There is no real gateway yet — the backend always succeeds for the booking owner,
     * flipping it to payment_status="paid" / status="confirmed" and returning a [PaymentReceipt].
     *
     * [method] is the chosen payment method: `"card"` adds a +5% surcharge to the subtotal,
     * `"bank_transfer"` applies a −5% discount; the signed adjustment comes back as
     * [PaymentReceipt.methodFee]. An optional [promoCode] is sent through to apply a promo discount
     * — the returned receipt carries [PaymentReceipt.promoCode]/[PaymentReceipt.promoDiscount] and a
     * [PaymentReceipt.total] already net of it. Throws [HttpError] (401 not signed in, 403/404 when
     * the booking isn't the caller's).
     */
    suspend fun pay(
        token: String,
        bookingId: String,
        method: String,
        promoCode: String? = null
    ): PaymentReceipt =
        withContext(Dispatchers.IO) {
            val payload = JSONObject().apply {
                put("method", method)
                if (!promoCode.isNullOrBlank()) put("promo_code", promoCode.trim())
            }
            val text = send("POST", token, "/api/local/bookings/$bookingId/pay", payload)
            // The success envelope is { ok, booking, receipt } — read the receipt object.
            parsePaymentReceipt(JSONObject(text).getJSONObject("receipt"))
        }

    /**
     * Previews a promo [code] against a [subtotal] WITHOUT applying it
     * (`POST /api/local/promo/validate { code, subtotal }`). Returns a [PromoQuote] describing
     * whether the code is valid and what it's worth, so the pay sheet can show a preview before the
     * guest commits. Throws [HttpError] on a non-2xx (e.g. 400 malformed) — the caller treats that
     * as "couldn't validate"; an invalid-but-known code comes back 200 with `valid:false`.
     */
    suspend fun validatePromo(token: String, code: String, subtotal: Int): PromoQuote =
        withContext(Dispatchers.IO) {
            val payload = JSONObject().apply {
                put("code", code.trim())
                put("subtotal", subtotal)
            }
            val text = send("POST", token, "/api/local/promo/validate", payload)
            parsePromoQuote(JSONObject(text))
        }

    /**
     * The signed-in user's referral summary (`GET /api/local/referrals`, Bearer): their share code,
     * how many friends they've referred, the total reward earned, and the referred-friends list.
     * Throws [HttpError] (401 when not signed in).
     */
    suspend fun fetchReferrals(token: String): ReferralSummary =
        withContext(Dispatchers.IO) {
            val text = get(token, "/api/local/referrals")
            parseReferralSummary(JSONObject(text))
        }

    /**
     * Attaches/updates the host's notes on a booking (`PATCH /api/local/bookings/:id
     * {host_notes}`). Host-only — returns the updated [Booking]; throws [HttpError]
     * (401 not signed in, 403 when the caller doesn't host this listing).
     */
    suspend fun setHostNotes(token: String, bookingId: String, notes: String): Booking =
        withContext(Dispatchers.IO) {
            val payload = JSONObject().apply { put("host_notes", notes) }
            val text = send("PATCH", token, "/api/local/bookings/$bookingId", payload)
            parseBooking(JSONObject(text))
        }

    /**
     * Fetches a single reservation by [bookingId] (`GET /api/local/bookings/:id`).
     * Carries the reservation_code used for the in-app QR card. Throws [HttpError]
     * (401 not signed in, 404 not found / not yours).
     */
    suspend fun fetchReservation(token: String, bookingId: String): Reservation =
        withContext(Dispatchers.IO) {
            val text = get(token, "/api/local/bookings/$bookingId")
            parseReservation(JSONObject(text))
        }

    // ---- Chat (booking thread) ------------------------------------------------

    /**
     * Loads the per-booking message thread, oldest-first
     * (`GET /api/local/bookings/:id/messages`). Throws [HttpError]
     * (401 not signed in, 403 / 404 when the booking isn't the caller's).
     */
    suspend fun fetchMessages(token: String, bookingId: String): List<ChatMessage> =
        withContext(Dispatchers.IO) {
            val text = get(token, "/api/local/bookings/$bookingId/messages")
            val arr = JSONArray(text)
            val out = ArrayList<ChatMessage>(arr.length())
            for (i in 0 until arr.length()) out.add(parseMessage(arr.getJSONObject(i)))
            out
        }

    /**
     * Posts a message to the booking thread
     * (`POST /api/local/bookings/:id/messages {body}`). Returns the created
     * message (201). Throws [HttpError] (401 / 403 / 400 on empty body).
     */
    suspend fun sendMessage(token: String, bookingId: String, body: String): ChatMessage =
        withContext(Dispatchers.IO) {
            val payload = JSONObject().apply { put("body", body) }
            val text = send("POST", token, "/api/local/bookings/$bookingId/messages", payload)
            parseMessage(JSONObject(text))
        }

    // ---- Host -----------------------------------------------------------------

    /**
     * Reservation requests across the host's listings (`GET /api/local/host/bookings`).
     * Throws [HttpError] (401 not signed in, 403 when the account isn't a host).
     */
    suspend fun fetchHostBookings(token: String): List<HostBooking> =
        withContext(Dispatchers.IO) {
            val text = get(token, "/api/local/host/bookings")
            val arr = JSONArray(text)
            val out = ArrayList<HostBooking>(arr.length())
            for (i in 0 until arr.length()) out.add(parseHostBooking(arr.getJSONObject(i)))
            out
        }

    /**
     * The host's own listings (`GET /api/local/host/listings`). Reuses the [Listing]
     * shape from the explore feed. Throws [HttpError] (401 / 403 non-host).
     */
    suspend fun fetchHostListings(token: String): List<Listing> =
        withContext(Dispatchers.IO) {
            val text = get(token, "/api/local/host/listings")
            SupabaseService.parseListings(text)
        }

    // ---- Money views (Section 9 — all MOCK) -----------------------------------

    /**
     * The signed-in host's earnings + payouts summary (`GET /api/local/host/earnings`, Bearer):
     * totals (earned / paid out / pending), the commission rate, and a per-booking breakdown.
     * All amounts are EGP. Throws [HttpError] (401 not signed in, 403 when the account isn't a host).
     */
    suspend fun fetchHostEarnings(token: String): HostEarnings =
        withContext(Dispatchers.IO) {
            val text = get(token, "/api/local/host/earnings")
            parseHostEarnings(JSONObject(text))
        }

    /**
     * The signed-in guest's itemized receipts for paid stays (`GET /api/local/receipts`, Bearer).
     * Each carries the full breakdown (subtotal, service fee, method fee, promo discount, total) +
     * reservation code + paid date. All amounts are EGP. Throws [HttpError] (401 not signed in).
     */
    suspend fun fetchReceipts(token: String): List<GuestReceipt> =
        withContext(Dispatchers.IO) {
            val text = get(token, "/api/local/receipts")
            val arr = JSONArray(text)
            val out = ArrayList<GuestReceipt>(arr.length())
            for (i in 0 until arr.length()) out.add(parseReceipt(arr.getJSONObject(i)))
            out
        }

    // ---- Section 10 — AI writer + host analytics ------------------------------

    /**
     * Generates a listing description from its details via the AI writer
     * (`POST /api/local/ai/listing-description`, Bearer). The host supplies whatever fields they've
     * filled so far; the backend returns a ready-to-edit [String] description. Throws [HttpError]
     * (401 not signed in, 503 when the AI key isn't configured).
     */
    suspend fun generateListingDescription(
        token: String,
        title: String,
        location: String,
        region: String,
        propertyType: String,
        bedrooms: Int,
        maxGuests: Int,
        amenities: List<String>,
        notes: String
    ): String = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("title", title)
            put("location", location)
            put("region", region)
            put("propertyType", propertyType)
            put("bedrooms", bedrooms)
            put("maxGuests", maxGuests)
            val arr = JSONArray()
            amenities.forEach { arr.put(it) }
            put("amenities", arr)
            put("notes", notes)
        }
        val text = send("POST", token, "/api/local/ai/listing-description", body)
        JSONObject(text).optString("description")
    }

    /**
     * The signed-in host's performance dashboard (`GET /api/local/host/analytics`, Bearer):
     * bookings/revenue/rating/conversion totals, a monthly trend, and the top listings. All money is
     * EGP. Throws [HttpError] (401 not signed in, 403 when the account isn't a host).
     */
    suspend fun fetchHostAnalytics(token: String): HostAnalytics =
        withContext(Dispatchers.IO) {
            val text = get(token, "/api/local/host/analytics")
            parseHostAnalytics(JSONObject(text))
        }

    private fun parseHostAnalytics(o: JSONObject): HostAnalytics {
        val monthsArr = o.optJSONArray("byMonth")
        val months = ArrayList<AnalyticsMonth>(monthsArr?.length() ?: 0)
        if (monthsArr != null) {
            for (i in 0 until monthsArr.length()) {
                val m = monthsArr.optJSONObject(i) ?: continue
                months.add(
                    AnalyticsMonth(
                        month = m.optString("month"),
                        bookings = m.optInt("bookings", 0),
                        revenue = m.optDouble("revenue", 0.0).takeUnless { it.isNaN() } ?: 0.0
                    )
                )
            }
        }
        val topArr = o.optJSONArray("topListings")
        val top = ArrayList<TopListing>(topArr?.length() ?: 0)
        if (topArr != null) {
            for (i in 0 until topArr.length()) {
                val t = topArr.optJSONObject(i) ?: continue
                top.add(
                    TopListing(
                        title = t.optString("title").ifBlank { "—" },
                        bookings = t.optInt("bookings", 0),
                        revenue = t.optDouble("revenue", 0.0).takeUnless { it.isNaN() } ?: 0.0
                    )
                )
            }
        }
        return HostAnalytics(
            currency = o.optString("currency").ifBlank { "EGP" },
            listings = o.optInt("listings", 0),
            totalBookings = o.optInt("totalBookings", 0),
            paidBookings = o.optInt("paidBookings", 0),
            cancelledBookings = o.optInt("cancelledBookings", 0),
            revenue = o.optDouble("revenue", 0.0).takeUnless { it.isNaN() } ?: 0.0,
            avgRating = o.optDouble("avgRating", 0.0).takeUnless { it.isNaN() } ?: 0.0,
            reviewCount = o.optInt("reviewCount", 0),
            conversionRate = o.optDouble("conversionRate", 0.0).takeUnless { it.isNaN() } ?: 0.0,
            byMonth = months,
            topListings = top
        )
    }

    private fun parseHostEarnings(o: JSONObject): HostEarnings {
        val arr = o.optJSONArray("recent")
        val items = ArrayList<HostEarningItem>(arr?.length() ?: 0)
        if (arr != null) {
            for (i in 0 until arr.length()) {
                val e = arr.optJSONObject(i) ?: continue
                items.add(
                    HostEarningItem(
                        bookingId = e.optString("booking_id"),
                        title = e.optString("title"),
                        checkIn = e.optString("check_in"),
                        checkOut = e.optString("check_out"),
                        gross = e.optDouble("gross", 0.0).takeUnless { it.isNaN() } ?: 0.0,
                        net = e.optDouble("net", 0.0).takeUnless { it.isNaN() } ?: 0.0,
                        status = e.optString("status").ifBlank { "upcoming" },
                        paidAt = e.optString("paid_at").ifBlank { null }
                    )
                )
            }
        }
        return HostEarnings(
            currency = o.optString("currency").ifBlank { "EGP" },
            totalEarned = o.optDouble("totalEarned", 0.0).takeUnless { it.isNaN() } ?: 0.0,
            paidOut = o.optDouble("paidOut", 0.0).takeUnless { it.isNaN() } ?: 0.0,
            pending = o.optDouble("pending", 0.0).takeUnless { it.isNaN() } ?: 0.0,
            bookingsCount = o.optInt("bookingsCount", 0),
            commissionRate = o.optDouble("commissionRate", 0.0).takeUnless { it.isNaN() } ?: 0.0,
            recent = items
        )
    }

    private fun parseReceipt(o: JSONObject): GuestReceipt = GuestReceipt(
        bookingId = o.optString("booking_id"),
        reservationCode = o.optString("reservation_code"),
        title = o.optString("title"),
        checkIn = o.optString("check_in"),
        checkOut = o.optString("check_out"),
        nights = o.optInt("nights", 0),
        subtotal = o.optDouble("subtotal", 0.0).takeUnless { it.isNaN() } ?: 0.0,
        serviceFee = o.optDouble("serviceFee", 0.0).takeUnless { it.isNaN() } ?: 0.0,
        method = o.optString("method").ifBlank { "mock" },
        methodFee = o.optDouble("methodFee", 0.0).takeUnless { it.isNaN() } ?: 0.0,
        promoCode = o.optString("promoCode").ifBlank { null },
        promoDiscount = o.optDouble("promoDiscount", 0.0).takeUnless { it.isNaN() } ?: 0.0,
        total = o.optDouble("total", 0.0).takeUnless { it.isNaN() } ?: 0.0,
        paidAt = o.optString("paidAt").ifBlank { null },
        currency = o.optString("currency").ifBlank { "EGP" }
    )

    // ---- Availability (host-managed blocks) -----------------------------------

    /**
     * The listing's unavailable spans (`GET /api/local/listings/:id/availability`) — booked +
     * host-blocked ranges. Public on the backend, but the host manager already has a token, so
     * this authed variant reuses the same [get] helper. Throws [HttpError] on a non-2xx.
     */
    suspend fun fetchAvailability(token: String, listingId: String): List<AvailabilityRange> =
        withContext(Dispatchers.IO) {
            val text = get(token, "/api/local/listings/$listingId/availability")
            SupabaseService.parseAvailability(text)
        }

    /**
     * Blocks [start, end) on [listingId] as the host
     * (`POST /api/local/listings/:id/availability {start, end, note?}`). Dates are yyyy-MM-dd;
     * the span is half-open (a block ending [end] leaves that day free). Returns the created
     * [AvailabilityRange] (201). Throws [HttpError] (401 not signed in, 403 not this listing's
     * host, 400 on validation / overlap).
     */
    suspend fun addAvailabilityBlock(
        token: String,
        listingId: String,
        start: String,
        end: String,
        note: String?
    ): AvailabilityRange = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("start", start)
            put("end", end)
            if (!note.isNullOrBlank()) put("note", note)
        }
        val text = send("POST", token, "/api/local/listings/$listingId/availability", body)
        // The endpoint returns the created block (possibly wrapped, possibly bare).
        val obj = JSONObject(text)
        val inner = obj.optJSONObject("block") ?: obj
        SupabaseService.parseAvailability("[$inner]").firstOrNull()
            ?: AvailabilityRange(id = "", start = start, end = end, kind = "blocked", note = note)
    }

    /**
     * Removes a host block by id
     * (`DELETE /api/local/listings/:id/availability?blockId=ID`). Host-only. Throws [HttpError]
     * (401 not signed in, 403 not this listing's host, 404 unknown block).
     */
    suspend fun removeAvailabilityBlock(
        token: String,
        listingId: String,
        blockId: String
    ): Unit = withContext(Dispatchers.IO) {
        val path = "/api/local/listings/$listingId/availability?blockId=" +
            java.net.URLEncoder.encode(blockId, "UTF-8")
        delete(token, path)
    }

    /**
     * Creates a listing as the signed-in host (`POST /api/local/listings`).
     * Returns the created [Listing] (201). Throws [HttpError] (403 when role != host,
     * 400 on validation).
     *
     * [ownershipDoc] is an optional `data:image/...;base64` data URL of the host's ownership/proof
     * document. When sent, the listing is created pending review + unpublished (not publicly
     * visible until staff approve it).
     */
    suspend fun createListing(
        token: String,
        title: String,
        description: String,
        location: String,
        country: String,
        pricePerNight: Double,
        bedrooms: Int,
        beds: Int,
        bathrooms: Int,
        maxGuests: Int,
        propertyType: String,
        imageUrl: String?,
        amenities: List<String> = emptyList(),
        lat: Double? = null,
        lng: Double? = null,
        region: String? = null,
        cancellationPolicy: String = "moderate",
        ownershipDoc: String? = null,
        weeklyDiscount: Int = 0,
        monthlyDiscount: Int = 0
    ): Listing = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("title", title)
            put("description", description)
            put("location", location)
            put("country", country)
            // Curated browse area picked on the Location step (e.g. "Ain Sokhna").
            if (!region.isNullOrBlank()) put("region", region)
            put("price_per_night", pricePerNight)
            put("bedrooms", bedrooms)
            put("beds", beds)
            put("bathrooms", bathrooms)
            put("max_guests", maxGuests)
            put("property_type", propertyType)
            // Precise coordinates from the map pin-picker (backend accepts lat/lng numbers).
            // Omitted entirely when the host never tapped the map.
            if (lat != null && lng != null) {
                put("lat", lat)
                put("lng", lng)
            }
            val images = JSONArray()
            if (!imageUrl.isNullOrBlank()) images.put(imageUrl.trim())
            put("images", images)
            // Selected amenity labels (e.g. "WiFi", "Pool"); always sent (possibly empty).
            val amenityArr = JSONArray()
            amenities.forEach { amenityArr.put(it) }
            put("amenities", amenityArr)
            // Host-set cancellation policy (flexible|moderate|strict); backend defaults to moderate.
            put("cancellation_policy", cancellationPolicy)
            // Length-of-stay discounts (% off): weekly (≥7 nights) + monthly (≥28 nights).
            put("weekly_discount", weeklyDiscount.coerceIn(0, 100))
            put("monthly_discount", monthlyDiscount.coerceIn(0, 100))
            // Ownership/proof document (data:image/* URL). Sending it queues the listing for review.
            if (!ownershipDoc.isNullOrBlank()) put("ownership_doc", ownershipDoc)
        }
        val text = send("POST", token, "/api/local/listings", body)
        SupabaseService.parseListing(JSONObject(text))
    }

    /**
     * Updates a listing's cancellation policy as the host
     * (`PATCH /api/local/listings/:id {cancellation_policy}`). [policy] is one of
     * "flexible" | "moderate" | "strict". Returns the updated [Listing]. Throws [HttpError]
     * (401 not signed in, 403 when the caller doesn't host this listing, 400 on validation).
     */
    suspend fun updateCancellationPolicy(
        token: String,
        listingId: String,
        policy: String
    ): Listing = withContext(Dispatchers.IO) {
        val body = JSONObject().apply { put("cancellation_policy", policy) }
        val text = send("PATCH", token, "/api/local/listings/$listingId", body)
        SupabaseService.parseListing(JSONObject(text))
    }

    /**
     * Updates a listing's length-of-stay discounts as the host
     * (`PATCH /api/local/listings/:id {weekly_discount, monthly_discount}`). Both are whole percents
     * off (0–100); the backend applies them to booking totals (≥28 nights→monthly, ≥7→weekly).
     * Returns the updated [Listing]. Throws [HttpError] (401 not signed in, 403 when the caller
     * doesn't host this listing, 400 on validation).
     */
    suspend fun updateStayDiscounts(
        token: String,
        listingId: String,
        weeklyDiscount: Int,
        monthlyDiscount: Int
    ): Listing = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("weekly_discount", weeklyDiscount.coerceIn(0, 100))
            put("monthly_discount", monthlyDiscount.coerceIn(0, 100))
        }
        val text = send("PATCH", token, "/api/local/listings/$listingId", body)
        SupabaseService.parseListing(JSONObject(text))
    }

    /**
     * (Re)submits a listing's ownership/proof document as the host
     * (`PATCH /api/local/listings/:id {ownership_doc}`). [ownershipDoc] is a `data:image/...;base64`
     * data URL. Re-queues the listing to "pending" review. Returns the updated [Listing] (now
     * pending + unpublished). Throws [HttpError] (401 not signed in, 403 when the caller doesn't
     * host this listing, 400 on validation).
     */
    suspend fun updateOwnershipDoc(
        token: String,
        listingId: String,
        ownershipDoc: String
    ): Listing = withContext(Dispatchers.IO) {
        val body = JSONObject().apply { put("ownership_doc", ownershipDoc) }
        val text = send("PATCH", token, "/api/local/listings/$listingId", body)
        SupabaseService.parseListing(JSONObject(text))
    }

    // ---- Guest cancellation (quote + cancel) ----------------------------------

    /**
     * Fetches the refund quote for cancelling [bookingId] WITHOUT mutating it
     * (`GET /api/local/bookings/:id/cancel`). Shown to the guest before they confirm. Throws
     * [HttpError] (401 not signed in, 403/404 when the booking isn't the caller's, 400 when it
     * isn't cancellable).
     */
    suspend fun cancellationQuote(token: String, bookingId: String): CancellationQuote =
        withContext(Dispatchers.IO) {
            val text = get(token, "/api/local/bookings/$bookingId/cancel")
            parseCancellationQuote(JSONObject(text))
        }

    /**
     * Cancels [bookingId] as the guest (`POST /api/local/bookings/:id/cancel`). The booking's
     * status becomes "cancelled" and the response carries the updated booking + the applied refund.
     * Returns the updated [Booking] (with `cancelled_at` / `refund_percent` set). Throws [HttpError]
     * (401 not signed in, 403/404 when not the caller's, 400 when no longer cancellable).
     */
    suspend fun cancelBooking(token: String, bookingId: String): Booking =
        withContext(Dispatchers.IO) {
            val text = send("POST", token, "/api/local/bookings/$bookingId/cancel", JSONObject())
            // Success envelope is { booking, refund } — read the updated booking.
            val obj = JSONObject(text)
            val bookingObj = obj.optJSONObject("booking") ?: obj
            // The refund's percent isn't always echoed onto the booking object, so fold it in.
            val refund = obj.optJSONObject("refund")
            val booking = parseBooking(bookingObj)
            if (refund != null && booking.refundPercent == null && refund.has("refundPercent")) {
                booking.copy(refundPercent = refund.optInt("refundPercent"))
            } else {
                booking
            }
        }

    private fun parseCancellationQuote(o: JSONObject): CancellationQuote = CancellationQuote(
        policy = o.optString("policy").ifBlank { "moderate" },
        daysUntilCheckIn = o.optInt("daysUntilCheckIn", 0),
        refundPercent = o.optInt("refundPercent", 0),
        refundAmount = o.optDouble("refundAmount", 0.0).takeUnless { it.isNaN() } ?: 0.0,
        total = o.optDouble("total", 0.0).takeUnless { it.isNaN() } ?: 0.0,
        currency = o.optString("currency").ifBlank { "EGP" }
    )

    /**
     * Confirms or rejects a pending reservation as the host
     * (`PATCH /api/local/bookings/:id {status:"confirm"|"reject"}`).
     * Returns the updated [HostBooking]. Throws [HttpError] (401 / 403 / 400).
     */
    suspend fun updateBookingStatus(
        token: String,
        bookingId: String,
        action: String
    ): HostBooking = withContext(Dispatchers.IO) {
        val body = JSONObject().apply { put("status", action) }
        val text = send("PATCH", token, "/api/local/bookings/$bookingId", body)
        parseHostBooking(JSONObject(text))
    }

    /** Authenticated GET; returns the body text or throws [HttpError] on a non-2xx. */
    private fun get(token: String, path: String): String {
        val conn = (URL("${Config.API_BASE_URL}$path").openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 15_000
            readTimeout = 15_000
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Authorization", "Bearer $token")
        }
        try {
            val code = conn.responseCode
            val text = readBody(conn, code)
            if (code !in 200..299) throw HttpError(code, extractError(text, code))
            return text
        } finally {
            conn.disconnect()
        }
    }

    /** Authenticated [method] (POST/PATCH) with a JSON body; returns the body or throws [HttpError]. */
    private fun send(method: String, token: String, path: String, body: JSONObject): String {
        val conn = (URL("${Config.API_BASE_URL}$path").openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 15_000
            readTimeout = 15_000
            doOutput = true
            setRequestProperty("Content-Type", "application/json")
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Authorization", "Bearer $token")
        }
        try {
            conn.outputStream.use { out -> out.write(body.toString().toByteArray(Charsets.UTF_8)) }
            val code = conn.responseCode
            val text = readBody(conn, code)
            if (code !in 200..299) throw HttpError(code, extractError(text, code))
            return text
        } finally {
            conn.disconnect()
        }
    }

    /** Authenticated DELETE (no request body); returns the body or throws [HttpError] on a non-2xx. */
    private fun delete(token: String, path: String): String {
        val conn = (URL("${Config.API_BASE_URL}$path").openConnection() as HttpURLConnection).apply {
            requestMethod = "DELETE"
            connectTimeout = 15_000
            readTimeout = 15_000
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Authorization", "Bearer $token")
        }
        try {
            val code = conn.responseCode
            val text = readBody(conn, code)
            if (code !in 200..299) throw HttpError(code, extractError(text, code))
            return text
        } finally {
            conn.disconnect()
        }
    }

    private fun readBody(conn: HttpURLConnection, code: Int): String {
        val stream = if (code in 200..299) conn.inputStream else conn.errorStream
        return stream?.bufferedReader()?.use { it.readText() }.orEmpty()
    }

    private fun extractError(text: String, code: Int): String {
        val parsed = runCatching { JSONObject(text).optString("error") }.getOrNull()
        return if (!parsed.isNullOrBlank()) parsed else "Request failed ($code)"
    }

    private fun parseBookings(json: String): List<Booking> {
        val arr = JSONArray(json)
        val result = ArrayList<Booking>(arr.length())
        for (i in 0 until arr.length()) {
            result.add(parseBooking(arr.getJSONObject(i)))
        }
        return result
    }

    private fun parseBooking(o: JSONObject): Booking = Booking(
        id = o.optString("id"),
        listingId = o.optString("listing_id"),
        checkIn = o.optString("check_in"),
        checkOut = o.optString("check_out"),
        guests = o.optInt("guests", 1),
        totalPrice = o.optDouble("total_price", 0.0),
        status = o.optString("status").ifBlank { null },
        title = o.optString("title"),
        location = o.optString("location").ifBlank { null },
        image = o.optString("image").ifBlank { null },
        paymentStatus = o.optString("payment_status").ifBlank { "unpaid" },
        paidAt = o.optString("paid_at").ifBlank { null },
        region = o.optString("region").ifBlank { null },
        hostNotes = o.optString("host_notes").ifBlank { null },
        cancellationPolicy = o.optString("cancellation_policy").ifBlank { "moderate" },
        cancelledAt = o.optString("cancelled_at").ifBlank { null },
        refundPercent = if (o.isNull("refund_percent") || !o.has("refund_percent")) null else o.optInt("refund_percent")
    )

    private fun parseReservation(o: JSONObject): Reservation = Reservation(
        id = o.optString("id"),
        reservationCode = o.optString("reservation_code"),
        status = o.optString("status").ifBlank { "pending" },
        title = o.optString("title"),
        location = o.optString("location").ifBlank { null },
        checkIn = o.optString("check_in"),
        checkOut = o.optString("check_out"),
        guests = o.optInt("guests", 1),
        totalPrice = o.optDouble("total_price", 0.0),
        paymentStatus = o.optString("payment_status").ifBlank { "unpaid" },
        paidAt = o.optString("paid_at").ifBlank { null },
        region = o.optString("region").ifBlank { null },
        hostNotes = o.optString("host_notes").ifBlank { null },
        cancellationPolicy = o.optString("cancellation_policy").ifBlank { "moderate" },
        cancelledAt = o.optString("cancelled_at").ifBlank { null },
        refundPercent = if (o.isNull("refund_percent") || !o.has("refund_percent")) null else o.optInt("refund_percent")
    )

    private fun parsePaymentReceipt(o: JSONObject): PaymentReceipt = PaymentReceipt(
        currency = o.optString("currency").ifBlank { "EGP" },
        nights = o.optInt("nights", 0),
        nightly = o.optInt("nightly", 0),
        subtotal = o.optInt("subtotal", 0),
        serviceFee = o.optInt("serviceFee", 0),
        total = o.optInt("total", 0),
        reference = o.optString("reference"),
        paidAt = o.optString("paidAt"),
        method = o.optString("method").ifBlank { "mock" },
        methodFee = o.optInt("methodFee", 0),
        promoCode = o.optString("promoCode").ifBlank { null },
        promoDiscount = o.optInt("promoDiscount", 0)
    )

    private fun parsePromoQuote(o: JSONObject): PromoQuote = PromoQuote(
        valid = o.optBoolean("valid", false),
        code = o.optString("code"),
        kind = o.optString("kind").ifBlank { null },
        value = o.optDouble("value", 0.0).takeUnless { it.isNaN() } ?: 0.0,
        discount = o.optInt("discount", 0),
        message = o.optString("message").ifBlank { null }
    )

    private fun parseReferralSummary(o: JSONObject): ReferralSummary {
        val arr = o.optJSONArray("referred")
        val friends = ArrayList<ReferredFriend>(arr?.length() ?: 0)
        if (arr != null) {
            for (i in 0 until arr.length()) {
                val f = arr.optJSONObject(i) ?: continue
                friends.add(
                    ReferredFriend(
                        name = f.optString("name").ifBlank { "Friend" },
                        createdAt = f.optString("created_at").ifBlank { null },
                        rewardAmount = f.optDouble("reward_amount", 0.0).takeUnless { it.isNaN() } ?: 0.0
                    )
                )
            }
        }
        return ReferralSummary(
            code = o.optString("code"),
            count = o.optInt("count", 0),
            rewardTotal = o.optDouble("rewardTotal", 0.0).takeUnless { it.isNaN() } ?: 0.0,
            referred = friends
        )
    }

    private fun parseMessage(o: JSONObject): ChatMessage = ChatMessage(
        id = o.optString("id"),
        senderId = o.optString("sender_id"),
        senderName = o.optString("sender_name").ifBlank { "Guest" },
        body = o.optString("body"),
        createdAt = o.optString("created_at")
    )

    private fun parseHostBooking(o: JSONObject): HostBooking = HostBooking(
        id = o.optString("id"),
        reservationCode = o.optString("reservation_code"),
        title = o.optString("title"),
        location = o.optString("location").ifBlank { null },
        checkIn = o.optString("check_in"),
        checkOut = o.optString("check_out"),
        guests = o.optInt("guests", 1),
        totalPrice = o.optDouble("total_price", 0.0),
        status = o.optString("status").ifBlank { "pending" }
    )
}
