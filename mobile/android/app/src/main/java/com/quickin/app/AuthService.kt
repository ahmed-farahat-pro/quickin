package com.quickin.app

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/** Result of a successful auth call: the bearer token plus the user's profile. */
data class AuthResult(
    val token: String,
    val userId: String,
    val userName: String,
    val email: String,
    val provider: String,
    val role: String
)

/**
 * Outcome of a sign-up or a login that requires email verification first.
 * Sign-up never returns a token: the backend emails a one-time code and we
 * must hand the user off to the OTP screen.
 */
sealed interface AuthOutcome {
    /** Auth completed: we have a token + profile (login / Google / verified OTP). */
    data class Success(val result: AuthResult) : AuthOutcome

    /** Email verification is pending: route the user to the OTP screen for [email]. */
    data class NeedsVerification(val email: String, val role: String?) : AuthOutcome
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
 */
object AuthService {

    /**
     * Logs in with email + password. The optional [role] ("user" or "host") is forwarded to
     * the backend: "host" makes the account a host (granting the role) and signs in as host;
     * "user" signs in as a guest. Returns [AuthOutcome.NeedsVerification] when the backend
     * answers 403 with `needsVerification:true` (unverified email); the caller should then
     * send a fresh code via [resendOtp] and show the OTP screen.
     */
    suspend fun login(email: String, password: String, role: String): AuthOutcome = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("email", email)
            put("password", password)
            put("role", role)
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
     * Registers a new account with the chosen [role] ("user" or "host").
     * On success the backend emails an OTP and returns `{pending:true}` with NO token,
     * so this always yields [AuthOutcome.NeedsVerification].
     */
    suspend fun signup(
        name: String,
        email: String,
        password: String,
        role: String
    ): AuthOutcome = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("email", email)
            put("password", password)
            put("full_name", name)
            put("role", role)
        }
        val (code, text) = request("/api/auth/signup", body)
        if (code !in 200..299) {
            throw RuntimeException(extractError(text, code))
        }
        AuthOutcome.NeedsVerification(
            email = optEmail(text) ?: email,
            role = JSONObject(text).optString("role").takeUnless { it.isBlank() } ?: role
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
        val user = obj.optJSONObject("user")
        val id = user?.optString("id").takeUnless { it.isNullOrBlank() }.orEmpty()
        val email = user?.optString("email").takeUnless { it.isNullOrBlank() }.orEmpty()
        val name = user?.optString("full_name").takeUnless { it.isNullOrBlank() }
            ?: email.takeUnless { it.isBlank() }
            ?: "Guest"
        val provider = user?.optString("provider").takeUnless { it.isNullOrBlank() } ?: "email"
        val role = user?.optString("role").takeUnless { it.isNullOrBlank() } ?: "user"
        return AuthResult(
            token = token,
            userId = id,
            userName = name,
            email = email,
            provider = provider,
            role = role
        )
    }
}
