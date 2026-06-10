package com.quickin.app

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/** Result of a successful auth call: the bearer token plus the user's profile. */
data class AuthResult(
    val token: String,
    val userName: String,
    val email: String,
    val provider: String
)

/**
 * Minimal HTTP client for the local Next.js auth API.
 * No third-party HTTP/JSON libraries: HttpURLConnection + org.json, all on Dispatchers.IO.
 *
 *   POST {base}/api/auth/signup  {email,password,full_name} -> {token, user} | {error}
 *   POST {base}/api/auth/login   {email,password}           -> {token, user} | {error}
 *   POST {base}/api/auth/google  {id_token}                 -> {token, user} | {error}
 */
object AuthService {

    suspend fun login(email: String, password: String): AuthResult {
        val body = JSONObject().apply {
            put("email", email)
            put("password", password)
        }
        return post("/api/auth/login", body)
    }

    suspend fun signup(name: String, email: String, password: String): AuthResult {
        val body = JSONObject().apply {
            put("email", email)
            put("password", password)
            put("full_name", name)
        }
        return post("/api/auth/signup", body)
    }

    /**
     * Real Google sign-in: posts the Google-issued ID token to the backend, which
     * verifies it against Google's JWKS and creates/logs in the user.
     * The backend returns 501 if GOOGLE_CLIENT_ID is unset server-side.
     */
    suspend fun googleSignIn(idToken: String): AuthResult {
        val body = JSONObject().apply {
            put("id_token", idToken)
        }
        return post("/api/auth/google", body)
    }

    /** POSTs a JSON body, parses {token, user} on success, or throws with the {error} message. */
    private suspend fun post(path: String, body: JSONObject): AuthResult = withContext(Dispatchers.IO) {
        val conn = (URL(Config.API_BASE_URL + path).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 15_000
            readTimeout = 15_000
            doOutput = true
            setRequestProperty("Content-Type", "application/json")
            setRequestProperty("Accept", "application/json")
        }

        try {
            conn.outputStream.use { out ->
                out.write(body.toString().toByteArray(Charsets.UTF_8))
            }

            val code = conn.responseCode
            val stream = if (code in 200..299) conn.inputStream else conn.errorStream
            val text = stream?.bufferedReader()?.use { it.readText() }.orEmpty()

            if (code !in 200..299) {
                throw RuntimeException(extractError(text, code))
            }

            parseAuth(text)
        } finally {
            conn.disconnect()
        }
    }

    /** Pulls the human-readable message out of an {error} response, with a sensible fallback. */
    private fun extractError(text: String, code: Int): String {
        val parsed = runCatching { JSONObject(text).optString("error") }.getOrNull()
        return if (!parsed.isNullOrBlank()) parsed else "Request failed ($code)"
    }

    private fun parseAuth(text: String): AuthResult {
        val obj = JSONObject(text)
        val token = obj.optString("token")
        if (token.isBlank()) {
            throw RuntimeException("Malformed response: missing token")
        }
        val user = obj.optJSONObject("user")
        val email = user?.optString("email").takeUnless { it.isNullOrBlank() }.orEmpty()
        val name = user?.optString("full_name").takeUnless { it.isNullOrBlank() }
            ?: email.takeUnless { it.isBlank() }
            ?: "Guest"
        val provider = user?.optString("provider").takeUnless { it.isNullOrBlank() } ?: "email"
        return AuthResult(token = token, userName = name, email = email, provider = provider)
    }
}
