package com.quickin.app

import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * Result of a successful auth call: the bearer token plus the user's profile.
 *
 * One account per person — there is no "sign in as host" / "sign in as guest". [isHost] is the
 * single source of truth for whether the account has host abilities (a host keeps every guest
 * ability too); [role] is the backend-derived "host"|"guest" string kept only for the display pill.
 */
data class AuthResult(
    val token: String,
    val userId: String,
    val userName: String,
    val email: String,
    val provider: String,
    val role: String,
    /** True once the account has become a host (parsed from the user JSON's `is_host`). */
    val isHost: Boolean,
    /**
     * The account's host-application state, derived server-side and parsed from `host_status`:
     * "none" (no application) | "pending" (awaiting an admin) | "rejected" | "approved".
     * `is_host = true` always means "approved" — see [parseUser].
     */
    val hostStatus: String = HOST_STATUS_NONE,
    /** The applicant's host type ("individual" | "company" | "brokerage"), or null when unset. */
    val hostType: String? = null,
    /** The admin's reason when [hostStatus] is "rejected"; null otherwise. */
    val hostReviewNote: String? = null,
    /**
     * The signup-identity state (`identity_required` / `identity_complete` / `verification_status` /
     * `verification_note`). Defaults to "not required, complete" so an older backend — or a biometric
     * session restored without these fields — never traps anyone on "Complete your account".
     */
    val identity: AccountIdentity = AccountIdentity()
)

/** No host application on file — the profile shows the "Become a host" CTA. */
const val HOST_STATUS_NONE = "none"
/** Application submitted, awaiting an admin — the profile shows a read-only "under review" card. */
const val HOST_STATUS_PENDING = "pending"
/** Application declined — the profile shows the reason plus an "Apply again" CTA. */
const val HOST_STATUS_REJECTED = "rejected"
/** `users.is_host = true` — the account has the full host surfaces. */
const val HOST_STATUS_APPROVED = "approved"

/**
 * Outcome of a sign-up or a login that requires email verification first.
 * Sign-up never returns a token: the backend emails a one-time code and we
 * must hand the user off to the OTP screen.
 */
sealed interface AuthOutcome {
    /** Auth completed: we have a token + profile (login / Google / verified OTP). */
    data class Success(val result: AuthResult) : AuthOutcome

    /** Email verification is pending: route the user to the OTP screen for [email]. */
    data class NeedsVerification(val email: String, val role: String?, val devCode: String? = null) : AuthOutcome
}

/**
 * Minimal HTTP client for the Next.js auth API.
 * No third-party HTTP/JSON libraries: HttpURLConnection + org.json, all on Dispatchers.IO.
 *
 *   POST {base}/api/auth/signup     {email,password,full_name,role} -> {pending:true,email,role} | {error}
 *   POST {base}/api/auth/verify-otp {email,code}                    -> {token,user} | {error}
 *   POST {base}/api/auth/resend-otp {email}                         -> {pending:true,email}
 *   POST {base}/api/auth/login      {email,password}                -> {token,user} | 403 {needsVerification:true,email} | {error}
 *   POST {base}/api/auth/google     {id_token}                      -> {token,user} | {error}
 *   GET  {base}/api/auth/me                                         -> {user} (authoritative host state)
 *   GET  {base}/api/local/host/application                          -> {host_status,application,profile,payout_method,terms_version}
 *   POST {base}/api/local/host/apply {address,host_type,terms_accepted,payout,…} -> {ok,host_status,application} | 400 {error,fields}
 */
object AuthService {

    private const val TAG = "AuthService"

    /** Thrown so callers can distinguish a dead session (401) from validation/conflict (400/409). */
    class HttpError(val code: Int, message: String) : RuntimeException(message)

    /**
     * A 400 `{error, fields}` — the server refused specific fields. [fields] is keyed like the
     * request body (`phone`, `doc_type`, `id_number`, `id_front`, `id_back`) so each message can be
     * shown under its own field.
     */
    class FieldErrors(val fields: Map<String, String>, message: String) : RuntimeException(message)

    /**
     * The identity half of a signup (and of the "Complete your account" step): the phone, which
     * document, its number, and both photos as `data:image/jpeg;base64,…` data URLs.
     */
    data class IdentityPayload(
        val phone: String,
        val docType: String,
        val idNumber: String,
        val idFront: String,
        val idBack: String
    ) {
        fun writeTo(body: JSONObject) {
            body.put("phone", phone.trim())
            body.put("doc_type", docType)
            body.put("id_number", idNumber.trim())
            body.put("id_front", idFront)
            body.put("id_back", idBack)
        }
    }

    /**
     * Logs in with email + password. One account per person — there is no role selection: the user
     * simply signs in and the backend returns their `is_host` flag (a host keeps all guest
     * abilities). Returns [AuthOutcome.NeedsVerification] when the backend answers 403 with
     * `needsVerification:true` (unverified email); the caller should then send a fresh code via
     * [resendOtp] and show the OTP screen.
     */
    suspend fun login(email: String, password: String): AuthOutcome = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("email", email)
            put("password", password)
        }
        val (code, text) = request("/api/auth/login", body)
        when {
            code in 200..299 -> AuthOutcome.Success(parseAuth(text))
            code == 403 && needsVerification(text) ->
                AuthOutcome.NeedsVerification(
                    email = optEmail(text) ?: email,
                    role = null
                )
            else -> throw RuntimeException(extractError(text, code))
        }
    }

    /**
     * Registers a new account. One account per person — there is NO host registration; a new user
     * always signs up as a normal account and can later become a host in-app.
     * On success the backend emails an OTP and returns `{pending:true}` with NO token,
     * so this always yields [AuthOutcome.NeedsVerification].
     */
    suspend fun signup(
        name: String,
        email: String,
        password: String,
        identity: IdentityPayload
    ): AuthOutcome = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("email", email)
            put("password", password)
            put("full_name", name)
        }
        // Every new account gives its phone + identity document at signup (signup-identity-core).
        identity.writeTo(body)
        val (code, text) = request("/api/auth/signup", body)
        if (code !in 200..299) {
            fieldErrors(text)?.let { throw FieldErrors(it, extractError(text, code)) }
            throw RuntimeException(extractError(text, code))
        }
        val devCode = runCatching { JSONObject(text).optString("devCode") }.getOrNull()
            ?.takeUnless { it.isBlank() }
        AuthOutcome.NeedsVerification(
            email = optEmail(text) ?: email,
            role = null,
            devCode = devCode
        )
    }

    /** Verifies the emailed 6-digit [code]; returns the session on success. */
    suspend fun verifyOtp(email: String, code: String): AuthResult = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("email", email)
            put("code", code)
        }
        val (status, text) = request("/api/auth/verify-otp", body)
        if (status !in 200..299) {
            throw RuntimeException(extractError(text, status))
        }
        parseAuth(text)
    }

    /** Asks the backend to email a fresh OTP for [email]. */
    suspend fun resendOtp(email: String): Unit = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("email", email)
        }
        val (status, text) = request("/api/auth/resend-otp", body)
        if (status !in 200..299) {
            throw RuntimeException(extractError(text, status))
        }
    }

    /**
     * Step 1 of the password reset: asks the backend to email a 6-digit code to [email].
     * Always 200 `{sent:true}` (the backend doesn't reveal whether the email exists), so
     * the caller can move to the code-entry step regardless. Throws on a non-2xx error.
     */
    suspend fun forgotPassword(email: String): Unit = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("email", email)
        }
        val (status, text) = request("/api/auth/forgot-password", body)
        if (status !in 200..299) {
            throw RuntimeException(extractError(text, status))
        }
    }

    /**
     * Step 2 of the password reset: submits the emailed [code] and the [password] for [email].
     * On success the backend returns `{token,user}` (a fresh session) which we parse the same way
     * as a login, so the caller can persist it and the user ends up signed in. A 400 `{error}`
     * (bad/expired code) surfaces as a [RuntimeException] with the server message.
     */
    suspend fun resetPassword(email: String, code: String, password: String): AuthResult =
        withContext(Dispatchers.IO) {
            val body = JSONObject().apply {
                put("email", email)
                put("code", code)
                put("password", password)
            }
            val (status, text) = request("/api/auth/reset-password", body)
            if (status !in 200..299) {
                throw RuntimeException(extractError(text, status))
            }
            parseAuth(text)
        }

    /**
     * Real Google sign-in: posts the Google-issued ID token to the backend, which
     * verifies it against Google's JWKS and creates/logs in the user.
     * The backend returns 501 if GOOGLE_CLIENT_ID is unset server-side.
     */
    suspend fun googleSignIn(idToken: String): AuthResult = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("id_token", idToken)
        }
        val (code, text) = request("/api/auth/google", body)
        if (code !in 200..299) {
            // The banner can only show `error` ("Google sign-in failed"), but the route also
            // returns a `detail` naming the actual cause — "Audience mismatch", "Invalid token
            // signature", "Token expired". Dropping it left a backend rejection indistinguishable
            // from a Play-services one AND invisible in logcat, so log the raw body here:
            //   adb logcat -s AuthService
            Log.w(TAG, "Google sign-in rejected by the backend: HTTP $code $text")
            throw RuntimeException(extractError(text, code))
        }
        parseAuth(text)
    }

    /** POSTs a JSON body and returns the raw (statusCode, responseText) without throwing on 4xx/5xx. */
    private fun request(path: String, body: JSONObject): Pair<Int, String> {
        val conn = (URL(Config.API_BASE_URL + path).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 15_000
            readTimeout = 15_000
            doOutput = true
            setRequestProperty("Content-Type", "application/json")
            setRequestProperty("Accept", "application/json")
        }

        return try {
            conn.outputStream.use { out ->
                out.write(body.toString().toByteArray(Charsets.UTF_8))
            }
            val code = conn.responseCode
            val stream = if (code in 200..299) conn.inputStream else conn.errorStream
            val text = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
            code to text
        } finally {
            conn.disconnect()
        }
    }

    /**
     * `POST /api/local/account/identity` — the blocking "Complete your account" step for an account
     * that arrived (first Google sign-in) without its phone + ID. Returns the account's new identity
     * state. Throws [FieldErrors] on a 400 with a `fields` map, [HttpError] otherwise (401 signed
     * out, 409 when nothing is owed any more — the caller re-reads `/me`).
     */
    suspend fun completeIdentity(token: String, identity: IdentityPayload): AccountIdentity =
        withContext(Dispatchers.IO) {
            val body = JSONObject().also { identity.writeTo(it) }
            val (status, text) = authedSend("POST", "/api/local/account/identity", token, body)
            if (status !in 200..299) {
                fieldErrors(text)?.let { throw FieldErrors(it, extractError(text, status)) }
                throw HttpError(status, extractError(text, status))
            }
            parseIdentity(JSONObject(text))
        }

    /** The `fields` map of a 400 `{error, fields}` response, or null when there is none. */
    private fun fieldErrors(text: String): Map<String, String>? = runCatching {
        val obj = JSONObject(text).optJSONObject("fields") ?: return null
        val out = LinkedHashMap<String, String>()
        obj.keys().forEach { key -> obj.optStringOrNull(key)?.let { out[key] = it } }
        out.takeUnless { it.isEmpty() }
    }.getOrNull()

    /**
     * Reads the identity fields off a user object (or the identity endpoint's bare body). Absent
     * keys fall back through [AccountIdentity.from]: absent `identity_complete` reads as complete.
     */
    private fun parseIdentity(o: JSONObject): AccountIdentity = AccountIdentity.from(
        required = if (o.has("identity_required") && !o.isNull("identity_required")) {
            o.optBoolean("identity_required", false)
        } else null,
        complete = if (o.has("identity_complete") && !o.isNull("identity_complete")) {
            o.optBoolean("identity_complete", true)
        } else null,
        status = o.optStringOrNull("verification_status"),
        note = o.optStringOrNull("verification_note")
    )

    /** Pulls the human-readable message out of an {error} response, with a sensible fallback. */
    private fun extractError(text: String, code: Int): String {
        val parsed = runCatching { JSONObject(text).optString("error") }.getOrNull()
        return if (!parsed.isNullOrBlank()) parsed else "Request failed ($code)"
    }

    private fun needsVerification(text: String): Boolean =
        runCatching { JSONObject(text).optBoolean("needsVerification", false) }.getOrDefault(false)

    private fun optEmail(text: String): String? =
        runCatching { JSONObject(text).optString("email") }.getOrNull()?.takeUnless { it.isBlank() }

    private fun parseAuth(text: String): AuthResult {
        val obj = JSONObject(text)
        val token = obj.optString("token")
        if (token.isBlank()) {
            throw RuntimeException("Malformed response: missing token")
        }
        // A malformed/absent user object keeps the historical fallbacks below (name "Guest", etc.).
        return parseUser(obj.optJSONObject("user") ?: JSONObject(), token)
    }

    /**
     * Parses a `user` object (from login / verify-otp / social / `me`) into an [AuthResult], paired
     * with the [token] the caller already holds — `/api/auth/me` returns no token of its own.
     *
     * `is_host` is the single source of truth for host abilities; `host_status` is the derived
     * application state and is forced to "approved" whenever `is_host` is true, so pre-existing
     * hosts (no application row) and older backends that don't send the field yet keep working.
     */
    private fun parseUser(user: JSONObject, token: String): AuthResult {
        val id = user.optString("id").takeUnless { it.isBlank() }.orEmpty()
        val email = user.optString("email").takeUnless { it.isBlank() }.orEmpty()
        val name = user.optString("full_name").takeUnless { it.isBlank() }
            ?: email.takeUnless { it.isBlank() }
            ?: "Guest"
        val provider = user.optString("provider").takeUnless { it.isBlank() } ?: "email"
        // [isHost] is the source of truth; [role] is "host"|"guest" (derived from is_host
        // server-side) and falls back to that derivation when the field is absent. A backend that
        // doesn't send `is_host` at all yet is read from its `role` instead — still SERVER truth,
        // never a local flag — so a host isn't demoted mid-rollout.
        val isHost = if (user.has("is_host") && !user.isNull("is_host")) {
            user.optBoolean("is_host", false)
        } else {
            user.optString("role").equals("host", ignoreCase = true)
        }
        val role = user.optString("role").takeUnless { it.isBlank() }
            ?: if (isHost) "host" else "guest"
        val hostStatus = when {
            isHost -> HOST_STATUS_APPROVED
            else -> user.optStringOrNull("host_status") ?: HOST_STATUS_NONE
        }
        return AuthResult(
            token = token,
            userId = id,
            userName = name,
            email = email,
            provider = provider,
            role = role,
            isHost = isHost,
            hostStatus = hostStatus,
            hostType = user.optStringOrNull("host_type"),
            // Only a rejection carries a reviewer note; ignore anything else so a stale note can't
            // linger on a re-submitted application.
            hostReviewNote = if (hostStatus == HOST_STATUS_REJECTED) {
                user.optStringOrNull("host_review_note")
            } else null,
            identity = parseIdentity(user)
        )
    }

    /**
     * Reads a nullable string field. `optString` renders an explicit JSON null as the literal
     * "null", so guard with `isNull` first; blanks collapse to null too.
     */
    private fun JSONObject.optStringOrNull(name: String): String? =
        if (isNull(name)) null else optString(name).trim()
            .takeUnless { it.isBlank() || it.equals("null", ignoreCase = true) }

    /**
     * Re-reads the signed-in account from `GET /api/auth/me` with the bearer [token] — the
     * authoritative `is_host` / `host_status` / `host_type` / `host_review_note` the clients must
     * trust on every launch. The response carries no fresh token, so the caller keeps [token].
     * Throws [HttpError] (401 when the session is gone server-side).
     */
    suspend fun fetchMe(token: String): AuthResult = withContext(Dispatchers.IO) {
        val (status, text) = authedSend("GET", "/api/auth/me", token)
        if (status !in 200..299) {
            throw HttpError(status, extractError(text, status))
        }
        // A missing user object must NOT be read as "signed out with no host abilities" — the
        // caller would then persist an empty profile over a perfectly good cached one.
        val body = JSONObject(text)
        val user = body.optJSONObject("user")
        if (user == null) {
            // This backend answers a dead/expired token with 200 {"user":null} — NOT a 401 — so
            // that case has to be mapped here or the session would never be cleared and a cached
            // `is_host = true` would outlive the account's host access. A 200 that also carries
            // {"error":…} is a server-side lookup failure: keep the cached session (the caller
            // treats a plain exception as "offline, try again next launch").
            if (body.isNull("error")) throw HttpError(401, "Session expired")
            throw RuntimeException("Could not read account: ${body.optString("error")}")
        }
        parseUser(user, token)
    }

    /**
     * What the become-a-host form needs to know before it renders: `GET /api/local/host/application`.
     * [profile] is null on an older server that does not send it (the form then asks for all three
     * profile fields, as before); [payoutMethod] is null when none is on file.
     */
    data class HostApplicationInfo(
        val hostStatus: String?,
        val profile: HostApplicationRules.ApplicantProfile?,
        val payoutMethod: HostPayoutMethod?,
        val termsVersion: String?
    )

    suspend fun fetchHostApplication(token: String): HostApplicationInfo = withContext(Dispatchers.IO) {
        val (status, text) = authedSend("GET", "/api/local/host/application", token)
        if (status !in 200..299) throw HttpError(status, extractError(text, status))
        parseHostApplication(JSONObject(text))
    }

    /** Tolerant parse: every newer field is optional, and JSON null never becomes the word "null". */
    internal fun parseHostApplication(body: JSONObject): HostApplicationInfo {
        val profile = body.optJSONObject("profile")?.let { p ->
            val missing = p.optJSONArray("missing")?.let { arr ->
                (0 until arr.length()).map { i -> if (arr.isNull(i)) null else arr.optString(i) }
            }.orEmpty()
            HostApplicationRules.ApplicantProfile(
                fullName = p.optStringOrNull("full_name"),
                phone = p.optStringOrNull("phone"),
                nationalId = p.optStringOrNull("national_id"),
                docType = p.optStringOrNull("doc_type"),
                verificationStatus = p.optStringOrNull("verification_status"),
                missing = HostApplicationRules.normalizeMissing(missing)
            )
        }
        val payout = if (body.isNull("payout_method")) null
        else body.optJSONObject("payout_method")?.let { PayoutService.parseMethod(it) }
        return HostApplicationInfo(
            hostStatus = body.optStringOrNull("host_status"),
            profile = profile,
            payoutMethod = payout,
            termsVersion = body.optStringOrNull("terms_version")
        )
    }

    /**
     * Submits — or, after a rejection, re-submits — the signed-in account's host application:
     * `POST /api/local/host/apply` with the bearer [token]. This NEVER grants hosting; the
     * application lands in the admin queue and only an approval flips `is_host`.
     *
     * Same account, no re-typing: the server takes full_name / phone / national_id from the
     * PROFILE and ignores submitted ones, so [profileValues] carries only the fields
     * `profile.missing` asked for (an older account, or an older server). [payout] is the same body
     * as `PUT /api/local/host/payout-method`, sent when none is on file or the applicant replaces
     * it; [termsAccepted] must be true. [company] and [notes] are optional and omitted when blank;
     * [hostType] is one of "individual" | "company" | "brokerage".
     *
     * The ID documents travel WITH the application ([docType], [idFront] / [idBack] as
     * `data:image/jpeg;base64,…`), omitted for an applicant whose identity is already verified or in
     * the queue ([IdentityRules.needsIdentityDocuments]).
     *
     * Throws [FieldErrors] on a 400 that names fields (`terms`, `payout`, `address`, …), otherwise
     * [HttpError] — 401 (signed out), 400, 409 (already a host / already under review).
     */
    suspend fun applyToHost(
        token: String,
        profileValues: Map<String, String>,
        address: String,
        company: String?,
        hostType: String,
        notes: String?,
        termsAccepted: Boolean,
        payout: PayoutDraft? = null,
        docType: String? = null,
        idFront: String? = null,
        idBack: String? = null
    ): String = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            profileValues.forEach { (k, v) -> if (v.isNotBlank()) put(k, v.trim()) }
            put("address", address.trim())
            if (!company.isNullOrBlank()) put("company", company.trim())
            put("host_type", hostType)
            if (!notes.isNullOrBlank()) put("notes", notes.trim())
            put("terms_accepted", termsAccepted)
            if (payout != null) put("payout", PayoutService.toJson(payout))
            if (!docType.isNullOrBlank()) put("doc_type", docType)
            if (!idFront.isNullOrBlank()) put("id_front", idFront)
            if (!idBack.isNullOrBlank()) put("id_back", idBack)
        }
        val (status, text) = authedSend("POST", "/api/local/host/apply", token, body)
        if (status !in 200..299) {
            if (status == 400) fieldErrors(text)?.let { throw FieldErrors(it, extractError(text, status)) }
            throw HttpError(status, extractError(text, status))
        }
        // 200 { ok, host_status, application } — the status is always "pending" on success.
        runCatching { JSONObject(text).optStringOrNull("host_status") }.getOrNull() ?: HOST_STATUS_PENDING
    }

    /**
     * Permanently deletes the signed-in account and all of its data (listings, bookings, reviews)
     * via `POST /api/local/account` with the bearer [token]; the backend also clears the session
     * server-side. The endpoint accepts both POST and DELETE — we use POST because Android's
     * HttpURLConnection throws a ProtocolException when a DELETE carries a request body (and
     * [authedSend] writes a `{}` body on every non-GET request), whereas POST is reliable on
     * every platform.
     * Returns Unit on the 200 `{ok:true, deleted:true}`. A non-2xx (e.g. 401 when not signed in)
     * surfaces as a [RuntimeException] carrying the server's `{error}` message — the caller is
     * responsible for clearing the local session on success.
     */
    suspend fun deleteAccount(token: String): Unit = withContext(Dispatchers.IO) {
        val (status, text) = authedSend("POST", "/api/local/account", token)
        if (status !in 200..299) {
            throw RuntimeException(extractError(text, status))
        }
    }

    /**
     * Sends an authed request with the given [method] ("GET", "POST", "DELETE") and a Bearer
     * [token], returning the raw (statusCode, responseText) without throwing on 4xx/5xx. Writing
     * bodies are sent [body] (an empty `{}` by default); a "GET" carries no body at all.
     */
    private fun authedSend(
        method: String,
        path: String,
        token: String,
        body: JSONObject = JSONObject()
    ): Pair<Int, String> {
        val writesBody = method != "GET"
        val conn = (URL(Config.API_BASE_URL + path).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 15_000
            readTimeout = 15_000
            doOutput = writesBody
            if (writesBody) setRequestProperty("Content-Type", "application/json")
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Authorization", "Bearer $token")
        }
        return try {
            if (writesBody) {
                conn.outputStream.use { out -> out.write(body.toString().toByteArray(Charsets.UTF_8)) }
            }
            val code = conn.responseCode
            val stream = if (code in 200..299) conn.inputStream else conn.errorStream
            val text = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
            code to text
        } finally {
            conn.disconnect()
        }
    }
}
