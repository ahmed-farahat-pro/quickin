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
 *
 * **String parsing rule:** every string field is read through [optStringOrNull] / [optStringOr],
 * never `JSONObject.optString`. Android's `optString` returns the literal string `"null"` for a
 * JSON `null`, which is exactly how a code-less booking used to render `/stay/null`. Do not
 * reintroduce a bare `optString` here.
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
        guests: Int,
        adults: Int = 1,
        children: Int = 0,
        infants: Int = 0,
        pets: Int = 0
    ): Booking = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("listing_id", listingId)
            put("check_in", checkIn)
            put("check_out", checkOut)
            put("guests", guests)
            put("adults", adults)
            put("children", children)
            put("infants", infants)
            put("pets", pets)
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

    // ---- Instapay bank transfer (manual proof-of-payment) ---------------------

    /**
     * A way to pay. Mirrors the server's `PAYMENT_METHODS`; [wire] is what goes back as `method`
     * on the payment proof, which is how the reviewer knows which account to check.
     */
    enum class PaymentMethod(val wire: String) {
        INSTAPAY("instapay"),
        BANK_TRANSFER("bank_transfer");

        companion object {
            /** null for a method this build has no UI for — see [PaymentConfig.availableMethods]. */
            fun fromWire(v: String): PaymentMethod? = entries.firstOrNull { it.wire == v }
        }
    }

    /**
     * The bank-account half of the destination — an ordinary transfer offered alongside Instapay.
     * All of it is admin-set in the web ops panel and any field may be blank.
     *
     * [accountNumber] and [iban] are carried and shown WHOLE, never masked: they exist to be typed
     * into a banking app. [ibanFormatted] is the same IBAN in groups of four, for display only —
     * copy [iban].
     */
    data class BankTransferConfig(
        val bankName: String = "",
        val accountName: String = "",
        val accountNumber: String = "",
        val iban: String = "",
        val ibanFormatted: String = "",
        val instructions: String = ""
    )

    /**
     * Every transfer destination shown to the guest at checkout (`GET /api/local/payment-config`,
     * Bearer): the [instapayHandle] the guest sends money to with free-text [instructions], the
     * admin-configured [instapayLink] (a deep link that opens Instapay) and [instapayQrImage] (an
     * uploaded QR as a base64 data URL), and the [bank] account.
     *
     * [qrPayload] is what a client encodes when drawing the QR itself — the link when there is
     * one, else the handle.
     *
     * [availableMethods] is **the server's decision**, already accounting for both the admin
     * toggles and whether each destination is complete. Render it as-is rather than re-deriving
     * it: that is what keeps a toggle meaningful on a build that shipped months ago.
     */
    data class PaymentConfig(
        val instapayHandle: String,
        val instructions: String,
        val instapayLink: String = "",
        val instapayQrImage: String = "",
        val qrPayload: String = "",
        val bank: BankTransferConfig = BankTransferConfig(),
        val availableMethods: List<PaymentMethod> = emptyList()
    ) {
        /** True once there is somewhere to send money by any method. */
        val isConfigured: Boolean
            get() = availableMethods.isNotEmpty()

        /** The deep link when it is a well-formed web link — http(s) only, as the server validates. */
        val linkOrNull: String?
            get() = instapayLink.trim().takeIf { it.startsWith("http://") || it.startsWith("https://") }
    }

    /**
     * Loads every transfer destination to show the guest (`GET /api/local/payment-config`,
     * Bearer). Throws [HttpError] (401 when not signed in).
     *
     * Every field is read with a default so a build running against an API that predates the
     * QR/link/bank keys still works; [PaymentConfig.qrPayload] and
     * [PaymentConfig.availableMethods] are derived the same way the server derives them when the
     * response omits them, which is what lets this app talk to an older deployment.
     */
    suspend fun getPaymentConfig(token: String): PaymentConfig = withContext(Dispatchers.IO) {
        val text = get(token, "/api/local/payment-config")
        val o = JSONObject(text)
        val handle = o.optStringOr("instapay_handle", "")
        val link = o.optStringOr("instapay_link", "")
        val payload = o.optStringOr("qr_payload", "")

        val b = o.optJSONObject("bank")
        val iban = b?.optStringOr("iban", "") ?: ""
        val bank = BankTransferConfig(
            bankName = b?.optStringOr("bank_name", "") ?: "",
            accountName = b?.optStringOr("account_name", "") ?: "",
            accountNumber = b?.optStringOr("account_number", "") ?: "",
            iban = iban,
            ibanFormatted = (b?.optStringOr("iban_formatted", "") ?: "").ifBlank { iban },
            instructions = b?.optStringOr("instructions", "") ?: ""
        )

        val rawMethods = o.optJSONArray("available_methods")
        val methods = if (rawMethods != null) {
            // An unknown method from a newer server is dropped rather than failing the parse:
            // this build can't render a destination it has no UI for, but it can still offer
            // the ones it knows.
            (0 until rawMethods.length()).mapNotNull { PaymentMethod.fromWire(rawMethods.optString(it)) }
        } else {
            // Pre-`available_methods` server: Instapay was the only method, offered whenever it
            // had a destination.
            val hasInstapay = handle.isNotBlank() || link.isNotBlank()
            if (hasInstapay && o.optBoolean("instapay_enabled", true)) listOf(PaymentMethod.INSTAPAY)
            else emptyList()
        }

        PaymentConfig(
            instapayHandle = handle,
            instructions = o.optStringOr("instructions", ""),
            instapayLink = link,
            instapayQrImage = o.optStringOr("instapay_qr_image", ""),
            qrPayload = payload.ifBlank { link.ifBlank { handle } },
            bank = bank,
            availableMethods = methods
        )
    }

    /**
     * Uploads the guest's transfer screenshot as proof of payment for [bookingId]
     * (`POST /api/local/bookings/:id/payment-proof { image, method }`, Bearer). [method] is the
     * destination the guest picked, so the reviewer knows which account to check.
     * [imageDataUrl] is a `data:image/jpeg;base64,…` data URL (a raw base64 string is normalized to
     * one defensively). The booking's `payment_status` flips to "submitted" (awaiting host approval);
     * re-uploading is allowed. Returns the updated [Booking]. Throws [HttpError] (401 not signed in,
     * 400 when the screenshot is missing, 403/404 when the booking isn't the caller's).
     */
    suspend fun submitPaymentProof(
        token: String,
        bookingId: String,
        imageDataUrl: String,
        method: PaymentMethod = PaymentMethod.INSTAPAY
    ): Booking = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("image", asJpegDataUrl(imageDataUrl))
            put("method", method.wire)
        }
        val text = send("POST", token, "/api/local/bookings/$bookingId/payment-proof", body)
        // The response may be the bare updated booking or wrapped under a "booking" key.
        val obj = JSONObject(text)
        parseBooking(obj.optJSONObject("booking") ?: obj)
    }

    /** Normalizes a raw base64 JPEG or an existing data URL to a `data:image/jpeg;base64,…` URL. */
    private fun asJpegDataUrl(image: String): String =
        if (image.startsWith("data:", ignoreCase = true)) image
        else "data:image/jpeg;base64,$image"

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

    /**
     * Whether this host may add a listing, and if not, why
     * (`GET /api/local/host/listing-gate`, Bearer). The create endpoint enforces the
     * same rule; this lets the wizard say so before the host fills it in.
     */
    suspend fun fetchListingGate(token: String): ListingGate =
        withContext(Dispatchers.IO) {
            val o = JSONObject(get(token, "/api/local/host/listing-gate"))
            // optStringOr / optStringOrNull, never bare optString — Android's
            // optString hands back the literal "null" for a JSON null, which is
            // exactly how a missing rejection reason would render as the word
            // "null" in the blocked panel. See the note at the top of this file.
            ListingGate(
                allowed = o.optBoolean("allowed", true),
                code = o.optStringOr("code", "ok"),
                message = o.optStringOr("message", ""),
                reason = o.optStringOrNull("reason"),
            )
        }

    /**
     * The platform commission (`GET /api/local/host/commission`, Bearer), so the
     * add/edit-listing screens can tell a host what guests will pay for the price
     * they are typing. Auth-gated server-side: guests see one inclusive price, and
     * the rate divides back out to the host's raw one.
     */
    suspend fun fetchCommission(token: String): Commission =
        withContext(Dispatchers.IO) {
            val o = JSONObject(get(token, "/api/local/host/commission"))
            val rate = o.optDouble("rate", 0.0)
            Commission(
                rate = if (rate.isNaN()) 0.0 else rate,
                percent = o.optDouble("percent", rate * 100).let { if (it.isNaN()) rate * 100 else it },
            )
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
        JSONObject(text).optStringOr("description", "")
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
                        month = m.optStringOr("month", ""),
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
                        title = t.optStringOr("title", "—"),
                        bookings = t.optInt("bookings", 0),
                        revenue = t.optDouble("revenue", 0.0).takeUnless { it.isNaN() } ?: 0.0
                    )
                )
            }
        }
        return HostAnalytics(
            currency = o.optStringOr("currency", "EGP"),
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
                        bookingId = e.optStringOr("booking_id", ""),
                        title = e.optStringOr("title", ""),
                        checkIn = e.optStringOr("check_in", ""),
                        checkOut = e.optStringOr("check_out", ""),
                        gross = e.optDouble("gross", 0.0).takeUnless { it.isNaN() } ?: 0.0,
                        net = e.optDouble("net", 0.0).takeUnless { it.isNaN() } ?: 0.0,
                        status = e.optStringOr("status", "upcoming"),
                        paidAt = e.optStringOrNull("paid_at"),
                        cancelled = e.optBoolean("cancelled", false),
                        refundPercent = e.optInt("refundPercent", 0)
                    )
                )
            }
        }
        return HostEarnings(
            currency = o.optStringOr("currency", "EGP"),
            totalEarned = o.optDouble("totalEarned", 0.0).takeUnless { it.isNaN() } ?: 0.0,
            paidOut = o.optDouble("paidOut", 0.0).takeUnless { it.isNaN() } ?: 0.0,
            pending = o.optDouble("pending", 0.0).takeUnless { it.isNaN() } ?: 0.0,
            bookingsCount = o.optInt("bookingsCount", 0),
            commissionRate = o.optDouble("commissionRate", 0.0).takeUnless { it.isNaN() } ?: 0.0,
            guestPaid = o.optDouble("guestPaid", 0.0).takeUnless { it.isNaN() } ?: 0.0,
            recent = items
        )
    }

    private fun parseReceipt(o: JSONObject): GuestReceipt = GuestReceipt(
        bookingId = o.optStringOr("booking_id", ""),
        // Null-safe: a receipt whose booking never got a code must NOT read back as "null".
        reservationCode = o.optStringOrNull("reservation_code"),
        title = o.optStringOr("title", ""),
        checkIn = o.optStringOr("check_in", ""),
        checkOut = o.optStringOr("check_out", ""),
        nights = o.optInt("nights", 0),
        subtotal = o.optDouble("subtotal", 0.0).takeUnless { it.isNaN() } ?: 0.0,
        serviceFee = o.optDouble("serviceFee", 0.0).takeUnless { it.isNaN() } ?: 0.0,
        method = o.optStringOr("method", "mock"),
        methodFee = o.optDouble("methodFee", 0.0).takeUnless { it.isNaN() } ?: 0.0,
        promoCode = o.optStringOrNull("promoCode"),
        promoDiscount = o.optDouble("promoDiscount", 0.0).takeUnless { it.isNaN() } ?: 0.0,
        total = o.optDouble("total", 0.0).takeUnless { it.isNaN() } ?: 0.0,
        paidAt = o.optStringOrNull("paidAt"),
        currency = o.optStringOr("currency", "EGP")
    )

    // ---- Host calendar (per-date pricing + day-level availability) -------------

    /**
     * A listing's day-by-day calendar (`GET /api/local/listings/:id/calendar?start=&end=`),
     * INCLUSIVE of both ends. [start]/[end] are yyyy-MM-dd.
     *
     * The bearer token decides the money: the listing's host gets their RAW nightly rates plus a
     * `guest_price` companion, everyone else only the commission-inclusive figure. Passing the
     * token is therefore not optional for a host — without it they would see, and then edit, the
     * marked-up price as if it were their own. Throws [HttpError] on a non-2xx.
     */
    suspend fun fetchCalendar(
        token: String,
        listingId: String,
        start: String,
        end: String
    ): ListingCalendar = withContext(Dispatchers.IO) {
        val text = get(token, "/api/local/listings/$listingId/calendar?start=$start&end=$end")
        SupabaseService.parseListingCalendar(JSONObject(text))
    }

    /**
     * Applies one edit to a set of days (`PUT /api/local/listings/:id/calendar`).
     *
     *  • [price] = [CalendarPriceChange.Set] pins that nightly rate on every selected day.
     *  • [price] = [CalendarPriceChange.Reset] DELETES those days' pinned rates so they fall back
     *    to the listing's weekend / month / base pricing. Not the same as writing the base price,
     *    which would stop tracking it the moment the host edited the listing.
     *  • [price] = [CalendarPriceChange.Unchanged] leaves prices alone (block/unblock only).
     *  • [blocked] closes or opens the days; null leaves availability alone.
     *
     * Days already held by a reservation come back in `skipped` rather than failing the request —
     * a host sweeping across a month will cross a booking routinely, and refusing the whole edit
     * would make the calendar unusable. Throws [HttpError] (401 not signed in, 403 not the host,
     * 400 on validation).
     */
    suspend fun updateCalendar(
        token: String,
        listingId: String,
        dates: List<String>,
        price: CalendarPriceChange = CalendarPriceChange.Unchanged,
        blocked: Boolean? = null,
        note: String? = null
    ): CalendarUpdateResult = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("dates", org.json.JSONArray(dates))
            // The API reads `price` with `in`, not truthiness: JSONObject.NULL is "reset" and an
            // absent key is "don't touch prices". Those are different edits.
            when (price) {
                is CalendarPriceChange.Unchanged -> Unit
                is CalendarPriceChange.Reset -> put("price", JSONObject.NULL)
                is CalendarPriceChange.Set -> put("price", price.amount)
            }
            if (blocked != null) put("blocked", blocked)
            if (!note.isNullOrBlank()) put("note", note)
        }
        val text = send("PUT", token, "/api/local/listings/$listingId/calendar", body)
        val o = JSONObject(text)
        val skippedArr = o.optJSONArray("skipped")
        val skipped = ArrayList<CalendarUpdateResult.SkippedDay>(skippedArr?.length() ?: 0)
        for (i in 0 until (skippedArr?.length() ?: 0)) {
            val sk = skippedArr?.optJSONObject(i) ?: continue
            val date = sk.optStringOrNull("date") ?: continue
            skipped += CalendarUpdateResult.SkippedDay(date, sk.optStringOr("reason", "booked"))
        }
        CalendarUpdateResult(
            updated = o.optInt("updated", 0),
            skipped = skipped,
            calendar = SupabaseService.parseListingCalendar(
                o.optJSONObject("calendar") ?: JSONObject()
            )
        )
    }

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
        images: List<String>,
        amenities: List<String> = emptyList(),
        lat: Double? = null,
        lng: Double? = null,
        region: String? = null,
        /** The compound: the catalog id, or the name the host typed. See [ResortChoice]. */
        resort: ResortChoice.Selection = ResortChoice.Selection.NONE,
        cancellationPolicy: String = "moderate",
        ownershipDoc: String? = null,
        weeklyDiscount: Int = 0,
        monthlyDiscount: Int = 0,
        weekendPrice: Double? = null,
        weekendDays: Collection<Int> = WeekendSchedule.defaultDays,
        monthlyPrices: Map<String, Double> = emptyMap()
    ): Listing = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("title", title)
            put("description", description)
            put("location", location)
            put("country", country)
            // Curated browse area picked on the Location step (e.g. "Ain Sokhna").
            if (!region.isNullOrBlank()) put("region", region)
            // The resort / compound: EITHER the catalog id or the host's own text, never both — a
            // CHECK constraint enforces the pair server-side, and `resolveResortSelection` reads an
            // id as the final answer. Neither is sent when the host said "not in a resort", which
            // is a real answer and not a missing one.
            val resortPayload = ResortChoice.payload(resort)
            if (!resortPayload.id.isNullOrBlank()) put("resort_id", resortPayload.id)
            else if (!resortPayload.name.isNullOrBlank()) put("resort_name", resortPayload.name)
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
            // Listing photos: an array of strings, each a data:image/jpeg;base64 data URL (from the
            // device picker) or an http(s) URL. The first is the cover. Blank entries are dropped.
            put("images", JSONArray().apply { images.forEach { if (it.isNotBlank()) put(it) } })
            // Selected amenity labels (e.g. "WiFi", "Pool"); always sent (possibly empty).
            val amenityArr = JSONArray()
            amenities.forEach { amenityArr.put(it) }
            put("amenities", amenityArr)
            // Host-set cancellation policy (flexible|moderate|strict); backend defaults to moderate.
            put("cancellation_policy", cancellationPolicy)
            // Length-of-stay discounts (% off): weekly (≥7 nights) + monthly (≥28 nights).
            put("weekly_discount", weeklyDiscount.coerceIn(0, 100))
            put("monthly_discount", monthlyDiscount.coerceIn(0, 100))
            // Seasonal pricing — weekend nightly rate (number|null) + the days it applies to +
            // per-month overrides object. Null is sent explicitly when the host left the weekend
            // field blank.
            putWeekend(weekendPrice, weekendDays)
            put("monthly_prices", monthlyPricesJson(monthlyPrices))
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
     * Writes the weekend rung of the ladder into a request body: the rate, and — only alongside a
     * real rate — the days it is charged on.
     *
     * The pair travels together because that is how the server judges it: clearing the rate clears
     * the days with it, and a rate with no day lit is refused rather than quietly stored where no
     * night could ever be charged at it. Sending the rate ALONE is what used to leave every listing
     * on Fri+Sat no matter what the host picked.
     */
    private fun JSONObject.putWeekend(weekendPrice: Double?, weekendDays: Collection<Int>) {
        if (weekendPrice != null && weekendPrice > 0.0) {
            put("weekend_price", weekendPrice)
            put("weekend_days", JSONArray().apply { WeekendSchedule.normalize(weekendDays).forEach { put(it) } })
        } else {
            put("weekend_price", JSONObject.NULL)
        }
    }

    /**
     * Builds the `monthly_prices` JSON object from a month→nightly map, keeping only positive
     * values keyed by month "1".."12". An empty map serializes to `{}` (clears all overrides).
     */
    private fun monthlyPricesJson(prices: Map<String, Double>): JSONObject {
        val obj = JSONObject()
        prices.forEach { (month, price) ->
            if (price > 0.0) obj.put(month, price)
        }
        return obj
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

    /**
     * Saves a host's full edit of their own listing in ONE request
     * (`PATCH /api/local/listings/:id`). The backend writes only the keys present in the body and
     * — for every field below — sends the listing back to the admin queue in the same statement
     * (`approval_status = 'pending'`, `is_published = false`), so the returned [Listing] already
     * carries the "under review" state and the caller never needs a refetch.
     *
     * [images] is the FULL replacement photo set in display order (index 0 = cover), which is how
     * the editor persists every photo change — add, delete, reorder and set-cover — atomically with
     * the rest of the edit. Pass null to leave the listing's photos untouched (nothing is
     * re-uploaded when the host only changed, say, the price). The per-photo endpoints
     * (`/images`, `/images/:imageId`) exist too, but each applies immediately — the editor stages
     * changes locally so the single Save is what puts the listing back in review.
     *
     * [ownershipDoc] (a `data:image/...;base64` URL) is only sent when the host attached a fresh
     * document; a blank value is omitted so the existing one is kept.
     *
     * Throws [HttpError] (401 not signed in, 403 when the caller doesn't host this listing,
     * 400 on validation).
     */
    suspend fun updateListing(
        token: String,
        listingId: String,
        title: String,
        description: String,
        location: String,
        country: String,
        region: String,
        /** The compound, or null to leave the two resort columns exactly as they are — an edit to
         *  the price must not quietly clear a compound the host chose on the web. */
        resort: ResortChoice.Selection?,
        pricePerNight: Double,
        maxGuests: Int,
        bedrooms: Int,
        beds: Int,
        bathrooms: Int,
        propertyType: String,
        amenities: List<String>,
        lat: Double?,
        lng: Double?,
        cancellationPolicy: String,
        weeklyDiscount: Int,
        monthlyDiscount: Int,
        weekendPrice: Double?,
        weekendDays: Collection<Int>,
        monthlyPrices: Map<String, Double>,
        images: List<String>?,
        ownershipDoc: String?
    ): Listing = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("title", title)
            put("description", description)
            put("location", location)
            put("country", country)
            put("region", region)
            // Sent only when the host actually changed the resort. An explicit null on BOTH keys is
            // how "take this listing out of its compound" is said; the server clears the pair and
            // keeps the region the host chose.
            if (resort != null) {
                val resortPayload = ResortChoice.payload(resort)
                put("resort_id", resortPayload.id ?: JSONObject.NULL)
                put("resort_name", if (resortPayload.id == null) resortPayload.name ?: JSONObject.NULL else JSONObject.NULL)
            }
            put("price_per_night", pricePerNight)
            put("max_guests", maxGuests)
            put("bedrooms", bedrooms)
            put("beds", beds)
            put("bathrooms", bathrooms)
            put("property_type", propertyType)
            val amenityArr = JSONArray()
            amenities.forEach { amenityArr.put(it) }
            put("amenities", amenityArr)
            // Coordinates from the map pin-picker; null clears the pin server-side.
            put("lat", lat ?: JSONObject.NULL)
            put("lng", lng ?: JSONObject.NULL)
            put("cancellation_policy", cancellationPolicy)
            put("weekly_discount", weeklyDiscount.coerceIn(0, 100))
            put("monthly_discount", monthlyDiscount.coerceIn(0, 100))
            putWeekend(weekendPrice, weekendDays)
            put("monthly_prices", monthlyPricesJson(monthlyPrices))
            // Only sent when the photo set actually changed — an omitted key keeps the photos as-is.
            if (images != null) {
                put("images", JSONArray().apply { images.forEach { if (it.isNotBlank()) put(it) } })
            }
            if (!ownershipDoc.isNullOrBlank()) put("ownership_doc", ownershipDoc)
        }
        val text = send("PATCH", token, "/api/local/listings/$listingId", body)
        SupabaseService.parseListing(JSONObject(text))
    }

    // ---- Listing visibility (host only) ---------------------------------------

    /**
     * What the backend did when the host flipped a listing's visibility
     * (`PATCH /api/local/host/listings/:id/visibility`).
     *
     * [isPublished] is what the row ACTUALLY ended up as, which is not always what was asked: a
     * reactivate comes back false when an account block, the identity gate or the review queue is
     * still holding the listing, and [blockedBy] names which ("verification" | "staff" |
     * "rejected" | "under_review"). [blockedMessage] is the server's own sentence for it, kept as
     * a fallback for a code this build has no string for.
     */
    data class ListingVisibilityResult(
        val isPublished: Boolean,
        /** Booking requests the deactivate declined. Zero on a reactivate. */
        val declinedRequests: Int,
        val blockedBy: String?,
        val blockedMessage: String?,
        /** The refreshed listing, so the row can update without a refetch. */
        val listing: Listing?
    )

    /**
     * The host takes their own listing off the market, or puts it back.
     *
     * This is QuickIn's "delete my listing", and it deletes nothing. Bookings, reviews, messages
     * and payment records all point at the listing id, so the row must survive; instead
     * `is_published` goes false — search drops the listing, its public page 404s and no new
     * booking can be made — while every existing reservation stays exactly as it was.
     *
     * **Deactivating declines every booking request still waiting on this host**
     * ([ListingVisibilityResult.declinedRequests] says how many). Warn first, with the count from
     * the listing's [Listing.pendingRequestCount], before calling this.
     *
     * Throws [HttpError] (401 not signed in, 403 when the caller doesn't host this listing).
     */
    suspend fun setListingPublished(
        token: String,
        listingId: String,
        isPublished: Boolean
    ): ListingVisibilityResult = withContext(Dispatchers.IO) {
        val body = JSONObject().apply { put("is_published", isPublished) }
        val text = send("PATCH", token, "/api/local/host/listings/$listingId/visibility", body)
        val o = JSONObject(text)
        ListingVisibilityResult(
            isPublished = o.optBoolean("is_published", false),
            declinedRequests = o.optInt("declined_requests", 0),
            blockedBy = o.optStringOrNull("blocked_by"),
            blockedMessage = o.optStringOrNull("blocked_message"),
            listing = o.optJSONObject("listing")?.let { SupabaseService.parseListing(it) }
        )
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
        policy = o.optStringOr("policy", "moderate"),
        daysUntilCheckIn = o.optInt("daysUntilCheckIn", 0),
        refundPercent = o.optInt("refundPercent", 0),
        refundAmount = o.optDouble("refundAmount", 0.0).takeUnless { it.isNaN() } ?: 0.0,
        total = o.optDouble("total", 0.0).takeUnless { it.isNaN() } ?: 0.0,
        currency = o.optStringOr("currency", "EGP")
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
            // 409 + { policyWarning } — a moderator's warning is waiting to be read.
            if (code == PolicyWarningApi.GATE_STATUS) {
                PolicyWarningApi.parse(text)?.let { (id, message) -> throw PolicyWarningRequired(id, message) }
            }
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
        // optStringOrNull, so an `{"error": null}` body can't surface "null" as the user-facing message.
        val parsed = runCatching { JSONObject(text).optStringOrNull("error") }.getOrNull()
        return parsed ?: "Request failed ($code)"
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
        id = o.optStringOr("id", ""),
        listingId = o.optStringOr("listing_id", ""),
        checkIn = o.optStringOr("check_in", ""),
        checkOut = o.optStringOr("check_out", ""),
        guests = o.optInt("guests", 1),
        totalPrice = o.optDouble("total_price", 0.0),
        status = o.optStringOrNull("status"),
        title = o.optStringOr("title", ""),
        location = o.optStringOrNull("location"),
        image = o.optStringOrNull("image"),
        paymentStatus = o.optStringOr("payment_status", "unpaid"),
        // The latest screenshot's verdict and, when it was turned down, WHY — the two fields the
        // backend has always returned and the app used to drop on the floor, which is what left a
        // guest looking at a bare "Pay now" after a rejection.
        paymentProofStatus = o.optStringOrNull("payment_proof_status"),
        paymentRejectReason = o.optStringOrNull("payment_reject_reason"),
        paidAt = o.optStringOrNull("paid_at"),
        region = o.optStringOrNull("region"),
        hostNotes = o.optStringOrNull("host_notes"),
        cancellationPolicy = o.optStringOr("cancellation_policy", "moderate"),
        cancelledAt = o.optStringOrNull("cancelled_at"),
        refundPercent = if (o.isNull("refund_percent") || !o.has("refund_percent")) null else o.optInt("refund_percent")
    )

    private fun parseReservation(o: JSONObject): Reservation = Reservation(
        id = o.optStringOr("id", ""),
        // THE fix for /stay/null: a pending booking has `"reservation_code": null`, and
        // JSONObject.optString would hand back the literal "null" here.
        reservationCode = o.optStringOrNull("reservation_code"),
        status = o.optStringOr("status", "pending"),
        title = o.optStringOr("title", ""),
        location = o.optStringOrNull("location"),
        checkIn = o.optStringOr("check_in", ""),
        checkOut = o.optStringOr("check_out", ""),
        guests = o.optInt("guests", 1),
        totalPrice = o.optDouble("total_price", 0.0),
        paymentStatus = o.optStringOr("payment_status", "unpaid"),
        // The latest screenshot's verdict and, when it was turned down, WHY — the two fields the
        // backend has always returned and the app used to drop on the floor, which is what left a
        // guest looking at a bare "Pay now" after a rejection.
        paymentProofStatus = o.optStringOrNull("payment_proof_status"),
        paymentRejectReason = o.optStringOrNull("payment_reject_reason"),
        paidAt = o.optStringOrNull("paid_at"),
        region = o.optStringOrNull("region"),
        hostNotes = o.optStringOrNull("host_notes"),
        cancellationPolicy = o.optStringOr("cancellation_policy", "moderate"),
        cancelledAt = o.optStringOrNull("cancelled_at"),
        refundPercent = if (o.isNull("refund_percent") || !o.has("refund_percent")) null else o.optInt("refund_percent")
    )

    private fun parsePaymentReceipt(o: JSONObject): PaymentReceipt = PaymentReceipt(
        currency = o.optStringOr("currency", "EGP"),
        nights = o.optInt("nights", 0),
        nightly = o.optInt("nightly", 0),
        subtotal = o.optInt("subtotal", 0),
        serviceFee = o.optInt("serviceFee", 0),
        total = o.optInt("total", 0),
        reference = o.optStringOr("reference", ""),
        paidAt = o.optStringOr("paidAt", ""),
        method = o.optStringOr("method", "mock"),
        methodFee = o.optInt("methodFee", 0),
        promoCode = o.optStringOrNull("promoCode"),
        promoDiscount = o.optInt("promoDiscount", 0)
    )

    private fun parsePromoQuote(o: JSONObject): PromoQuote = PromoQuote(
        valid = o.optBoolean("valid", false),
        code = o.optStringOr("code", ""),
        kind = o.optStringOrNull("kind"),
        value = o.optDouble("value", 0.0).takeUnless { it.isNaN() } ?: 0.0,
        discount = o.optInt("discount", 0),
        message = o.optStringOrNull("message")
    )

    private fun parseReferralSummary(o: JSONObject): ReferralSummary {
        val arr = o.optJSONArray("referred")
        val friends = ArrayList<ReferredFriend>(arr?.length() ?: 0)
        if (arr != null) {
            for (i in 0 until arr.length()) {
                val f = arr.optJSONObject(i) ?: continue
                friends.add(
                    ReferredFriend(
                        name = f.optStringOr("name", "Friend"),
                        createdAt = f.optStringOrNull("created_at"),
                        rewardAmount = f.optDouble("reward_amount", 0.0).takeUnless { it.isNaN() } ?: 0.0
                    )
                )
            }
        }
        return ReferralSummary(
            code = o.optStringOr("code", ""),
            count = o.optInt("count", 0),
            rewardTotal = o.optDouble("rewardTotal", 0.0).takeUnless { it.isNaN() } ?: 0.0,
            referred = friends
        )
    }

    private fun parseMessage(o: JSONObject): ChatMessage = ChatMessage(
        id = o.optStringOr("id", ""),
        senderId = o.optStringOr("sender_id", ""),
        senderName = o.optStringOr("sender_name", "Guest"),
        body = o.optStringOr("body", ""),
        createdAt = o.optStringOr("created_at", "")
    )

    private fun parseHostBooking(o: JSONObject): HostBooking = HostBooking(
        id = o.optStringOr("id", ""),
        // Null-safe: a pending request has no code yet — it must read back as null, not "null".
        reservationCode = o.optStringOrNull("reservation_code"),
        title = o.optStringOr("title", ""),
        location = o.optStringOrNull("location"),
        // Host-only, and null when the guest's account is gone. optStringOrNull, never bare
        // optString — that is how a deleted guest would be introduced to the host as "null".
        guestName = o.optStringOrNull("guest_name"),
        checkIn = o.optStringOr("check_in", ""),
        checkOut = o.optStringOr("check_out", ""),
        guests = o.optInt("guests", 1),
        totalPrice = o.optDouble("total_price", 0.0),
        status = o.optStringOr("status", "pending"),
        // The payment + refund columns behind the status filter's derived chips
        // (Awaiting payment / Refunded / Partially refunded). All optStringOrNull:
        // a JSON null must read back as null, never as the literal "null", or
        // PaymentFlowRules would treat "null" as a real paid_at timestamp.
        paymentState = o.optStringOrNull("payment_status"),
        paymentProofStatus = o.optStringOrNull("payment_proof_status"),
        paidAt = o.optStringOrNull("paid_at"),
        // `refund_percent` is an int column. optInt cannot express "absent", and
        // 0 is a REAL value here (a strict-policy cancellation refunds nothing),
        // so absence is read explicitly rather than defaulted.
        refundPercent = if (o.isNull("refund_percent")) null else o.optInt("refund_percent")
    )

    // ---- Stay guide (host-authored content on a confirmed booking) ------------

    /**
     * The stay guide for [bookingId] (`GET /api/local/bookings/:id/stay-guide`, Bearer) — the
     * host's info blocks, photos, place QRs and attachments, in the host's chosen order. Readable
     * by the booking's guest and by the listing's host. Items with an unrecognized `kind` are
     * dropped rather than rendered. Throws [HttpError] (401 not signed in, 403/404 when the
     * booking isn't the caller's).
     */
    suspend fun fetchStayGuide(token: String, bookingId: String): List<StayGuideItem> =
        withContext(Dispatchers.IO) {
            val text = get(token, "/api/local/bookings/$bookingId/stay-guide")
            parseStayGuide(text)
        }

    /**
     * Adds an item to [bookingId]'s stay guide
     * (`POST /api/local/bookings/:id/stay-guide {kind, title, body, url, order}`). **Host of the
     * listing only, and only on a CONFIRMED booking** — the backend enforces both. Returns the
     * created item. Throws [HttpError] (401 not signed in, 403 not this listing's host, 400 on
     * validation / an unconfirmed booking).
     */
    suspend fun addStayGuideItem(
        token: String,
        bookingId: String,
        kind: StayGuideKind,
        title: String?,
        body: String?,
        url: String?,
        order: Int = 0
    ): StayGuideItem = withContext(Dispatchers.IO) {
        val payload = stayGuidePayload(kind, title, body, url, order)
        val text = send("POST", token, "/api/local/bookings/$bookingId/stay-guide", payload)
        val obj = JSONObject(text)
        parseStayGuideItem(obj.optJSONObject("item") ?: obj)
            ?: throw HttpError(500, "Couldn't read the saved item")
    }

    /**
     * Edits / reorders one stay-guide item
     * (`PATCH /api/local/bookings/:id/stay-guide/:itemId`). Host-only. Only non-null arguments are
     * sent, so passing just [order] is a pure reorder. Returns the updated item. Throws [HttpError]
     * (401 / 403 / 404 / 400).
     */
    suspend fun updateStayGuideItem(
        token: String,
        bookingId: String,
        itemId: String,
        kind: StayGuideKind? = null,
        title: String? = null,
        body: String? = null,
        url: String? = null,
        order: Int? = null
    ): StayGuideItem = withContext(Dispatchers.IO) {
        val payload = JSONObject().apply {
            if (kind != null) put("kind", kind.apiValue)
            if (title != null) put("title", title.trim())
            if (body != null) put("body", body.trim())
            if (url != null) put("url", url.trim())
            if (order != null) put("order", order)
        }
        val text = send("PATCH", token, "/api/local/bookings/$bookingId/stay-guide/$itemId", payload)
        val obj = JSONObject(text)
        parseStayGuideItem(obj.optJSONObject("item") ?: obj)
            ?: throw HttpError(500, "Couldn't read the saved item")
    }

    /**
     * Removes one stay-guide item
     * (`DELETE /api/local/bookings/:id/stay-guide/:itemId`). Host-only. Throws [HttpError]
     * (401 not signed in, 403 not this listing's host, 404 unknown item).
     */
    suspend fun deleteStayGuideItem(
        token: String,
        bookingId: String,
        itemId: String
    ): Unit = withContext(Dispatchers.IO) {
        delete(token, "/api/local/bookings/$bookingId/stay-guide/$itemId")
    }

    /** Body for a stay-guide create: blank optional fields are omitted rather than sent empty. */
    private fun stayGuidePayload(
        kind: StayGuideKind,
        title: String?,
        body: String?,
        url: String?,
        order: Int
    ): JSONObject = JSONObject().apply {
        put("kind", kind.apiValue)
        if (!title.isNullOrBlank()) put("title", title.trim())
        if (!body.isNullOrBlank()) put("body", body.trim())
        if (!url.isNullOrBlank()) put("url", url.trim())
        put("order", order)
    }

    /** Parses the stay-guide array, dropping any entry whose `kind` isn't one of the four. */
    private fun parseStayGuide(json: String): List<StayGuideItem> {
        // The endpoint returns a bare array; tolerate a { items: [...] } envelope too.
        val arr = runCatching { JSONArray(json) }.getOrNull()
            ?: runCatching { JSONObject(json).optJSONArray("items") }.getOrNull()
            ?: return emptyList()
        val out = ArrayList<StayGuideItem>(arr.length())
        for (i in 0 until arr.length()) {
            val o = arr.optJSONObject(i) ?: continue
            parseStayGuideItem(o)?.let { out.add(it) }
        }
        return out.sortedBy { it.order }
    }

    /** One stay-guide item, or null when its `kind` is missing / unrecognized. */
    private fun parseStayGuideItem(o: JSONObject): StayGuideItem? {
        val kind = StayGuideKind.from(o.optStringOrNull("kind")) ?: return null
        return StayGuideItem(
            id = o.optStringOr("id", ""),
            kind = kind,
            title = o.optStringOrNull("title"),
            body = o.optStringOrNull("body"),
            url = o.optStringOrNull("url"),
            order = o.optInt("order", 0)
        )
    }
}
