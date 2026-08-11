package com.quickin.app

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
    val hostReviewNote: String? = null
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
 *   POST {base}/api/local/host/apply {full_name,national_id,…}      -> {ok,host_status,application} | {error}
 */
object AuthService {

    /** Thrown so callers can distinguish a dead session (401) from validation/conflict (400/409). */
    class HttpError(val code: Int, message: String) : RuntimeException(message)

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
        password: String
    ): AuthOutcome = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("email", email)
            put("password", password)
            put("full_name", name)
        }
        val (code, text) = request("/api/auth/signup", body)
        if (code !in 200..299) {
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

    /**
     * Verifies the emailed 6-digit [code]; returns the session on success. An optional
     * [referralCode] (entered on the sign-up form) is forwarded so the backend can credit the
     * referrer — it's only honoured on a first verification and ignored when blank.
     */
    suspend fun verifyOtp(
        email: String,
        code: String,
        referralCode: String? = null
    ): AuthResult = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("email", email)
            put("code", code)
            if (!referralCode.isNullOrBlank()) put("referral_code", referralCode.trim())
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
            } else null
        )
    }

    /**
     * Reads a nullable string field. `optString` renders an explicit JSON null as the literal
     * "null", so guard with `isNull` first; blanks collapse to null too.
     */
    private fun JSONObject.optStringOrNull(name: String): String? =
        if (isNull(name)) null else optString(name).takeUnless { it.isBlank() }

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
     * Submits — or, after a rejection, re-submits — the signed-in account's host application:
     * `POST /api/local/host/apply` with the bearer [token]. This NEVER grants hosting; the
     * application lands in the admin queue and only an approval flips `is_host`. [company] and
     * [notes] are optional and omitted when blank; [hostType] is one of
     * "individual" | "company" | "brokerage". Returns the resulting host_status ("pending").
     * Throws [HttpError] — 401 (signed out), 400 (validation), 409 (already a host / already
     * under review) — carrying the server's `{error}` message.
     */
    suspend fun applyToHost(
        token: String,
        fullName: String,
        nationalId: String,
        phone: String,
        address: String,
        company: String?,
        hostType: String,
        notes: String?
    ): String = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("full_name", fullName.trim())
            put("national_id", nationalId.trim())
            put("phone", phone.trim())
            put("address", address.trim())
            if (!company.isNullOrBlank()) put("company", company.trim())
            put("host_type", hostType)
            if (!notes.isNullOrBlank()) put("notes", notes.trim())
        }
        val (status, text) = authedSend("POST", "/api/local/host/apply", token, body)
        if (status !in 200..299) {
            throw HttpError(status, extractError(text, status))
        }
        // 200 { ok, host_status, application } — the status is always "pending" on success.
        runCatching { JSONObject(text).optString("host_status") }.getOrNull()
            ?.takeUnless { it.isBlank() } ?: HOST_STATUS_PENDING
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
