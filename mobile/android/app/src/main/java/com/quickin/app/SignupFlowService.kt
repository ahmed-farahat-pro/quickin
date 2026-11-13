package com.quickin.app

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * HTTP for the role-aware first-time signup (see [SignupRoleRules]). Kept apart from
 * [AuthService] so the request building for the new steps lives in one place:
 *
 *   POST   {base}/api/auth/signup              {account + identity + role fields} -> {pending:true,email,…} | 400 {error,fields}
 *   POST   {base}/api/local/account/identity   {identity + role fields}            -> {identity state…, is_host, host_status, …}
 *   GET    {base}/api/local/account/refund-method                                  -> {refund_method, refund_ready}
 *   PUT    {base}/api/local/account/refund-method  {method, account_name, …}       -> {refund_method, refund_ready}
 *   DELETE {base}/api/local/account/refund-method
 *
 * Errors reuse [AuthService.FieldErrors] / [AuthService.HttpError] so the view model handles them
 * like every other auth call.
 */
object SignupFlowService {

    /** What `POST /api/local/account/identity` answers: the identity state plus the host state. */
    data class CompleteAccountResult(
        val identity: AccountIdentity,
        val isHost: Boolean,
        val hostStatus: String,
        val hostType: String?,
        val hostReviewNote: String?
    )

    /** `{refund_method, refund_ready}` — the destination is the same shape as a payout method. */
    data class RefundMethodState(val method: HostPayoutMethod?, val ready: Boolean)

    /**
     * Creates the account in ONE request: account, identity and the role's steps together. Always
     * ends in [AuthOutcome.NeedsVerification] (the email OTP), like [AuthService.signup].
     *
     * A refusal without `fields` (email / password / name are checked first and answered alone)
     * is turned into a one-field [AuthService.FieldErrors] keyed on the Account step's field, so
     * the flow can jump back to it and show the message under that field.
     */
    suspend fun signup(
        name: String,
        email: String,
        password: String,
        identity: AuthService.IdentityPayload,
        roleBody: Map<String, Any>
    ): AuthOutcome = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("email", email)
            put("password", password)
            put("full_name", name)
        }
        identity.writeTo(body)
        putAll(body, roleBody)
        val (code, text) = send("POST", "/api/auth/signup", null, body)
        if (code !in 200..299) {
            val message = extractError(text, code)
            fieldErrors(text)?.let { throw AuthService.FieldErrors(it, message) }
            val hint = runCatching {
                val o = JSONObject(text)
                listOf("emailProblem", "passwordProblem", "nameProblem").firstOrNull { o.has(it) }
            }.getOrNull()
            SignupRoleRules.accountFieldFor(code, hint)?.let {
                throw AuthService.FieldErrors(mapOf(it to message), message)
            }
            throw RuntimeException(message)
        }
        val obj = runCatching { JSONObject(text) }.getOrNull()
        AuthOutcome.NeedsVerification(
            email = obj?.optString("email")?.takeUnless { it.isBlank() } ?: email,
            role = obj?.optString("role")?.takeUnless { it.isBlank() },
            devCode = obj?.optString("devCode")?.takeUnless { it.isBlank() }
        )
    }

    /**
     * The Google "Complete your account" submit: identity + role fields. Throws
     * [AuthService.FieldErrors] on a 400 with `fields`, [AuthService.HttpError] otherwise (401
     * signed out, 409 nothing owed any more).
     */
    suspend fun completeAccount(
        token: String,
        identity: AuthService.IdentityPayload,
        roleBody: Map<String, Any>
    ): CompleteAccountResult = withContext(Dispatchers.IO) {
        val body = JSONObject().also { identity.writeTo(it) }
        putAll(body, roleBody)
        val (code, text) = send("POST", "/api/local/account/identity", token, body)
        if (code !in 200..299) {
            val message = extractError(text, code)
            fieldErrors(text)?.let { throw AuthService.FieldErrors(it, message) }
            throw AuthService.HttpError(code, message)
        }
        parseCompleteAccount(JSONObject(text))
    }

    suspend fun fetchRefundMethod(token: String): RefundMethodState = withContext(Dispatchers.IO) {
        refundCall("GET", token, null)
    }

    suspend fun saveRefundMethod(token: String, draft: PayoutDraft): RefundMethodState =
        withContext(Dispatchers.IO) {
            val body = JSONObject().also { putAll(it, SignupRoleRules.destinationBody(draft)) }
            refundCall("PUT", token, body)
        }

    suspend fun removeRefundMethod(token: String): Unit = withContext(Dispatchers.IO) {
        refundCall("DELETE", token, null)
        Unit
    }

    // ---- internals --------------------------------------------------------------------------

    private const val REFUND_PATH = "/api/local/account/refund-method"

    private fun refundCall(method: String, token: String, body: JSONObject?): RefundMethodState {
        val (code, text) = send(method, REFUND_PATH, token, body)
        if (code !in 200..299) throw AuthService.HttpError(code, extractError(text, code))
        val o = runCatching { JSONObject(text) }.getOrNull() ?: return RefundMethodState(null, false)
        val m = if (o.isNull("refund_method")) null else o.optJSONObject("refund_method")?.let {
            PayoutService.parseMethod(it)
        }
        return RefundMethodState(m, o.optBoolean("refund_ready", m != null))
    }

    private fun parseCompleteAccount(o: JSONObject): CompleteAccountResult {
        val identity = AccountIdentity.from(
            required = if (o.has("identity_required") && !o.isNull("identity_required")) {
                o.optBoolean("identity_required", false)
            } else null,
            complete = if (o.has("identity_complete") && !o.isNull("identity_complete")) {
                o.optBoolean("identity_complete", true)
            } else null,
            status = o.optStringOrNull("verification_status"),
            note = o.optStringOrNull("verification_note")
        )
        val isHost = o.optBoolean("is_host", false)
        val hostStatus = if (isHost) HOST_STATUS_APPROVED else o.optStringOrNull("host_status") ?: HOST_STATUS_NONE
        return CompleteAccountResult(
            identity = identity,
            isHost = isHost,
            hostStatus = hostStatus,
            hostType = o.optStringOrNull("host_type"),
            hostReviewNote = if (hostStatus == HOST_STATUS_REJECTED) o.optStringOrNull("host_review_note") else null
        )
    }

    /** Copies a [SignupRoleRules] body (strings, booleans, nested maps) into [target]. */
    private fun putAll(target: JSONObject, values: Map<String, Any>) {
        values.forEach { (k, v) -> target.put(k, toJson(v)) }
    }

    private fun toJson(v: Any?): Any = when (v) {
        null -> JSONObject.NULL
        is Map<*, *> -> JSONObject().also { o -> v.forEach { (k, x) -> o.put(k.toString(), toJson(x)) } }
        is List<*> -> JSONArray().also { a -> v.forEach { a.put(toJson(it)) } }
        else -> v
    }

    private fun send(method: String, path: String, token: String?, body: JSONObject?): Pair<Int, String> {
        val writesBody = method != "GET" && method != "DELETE" || body != null
        val conn = (URL(Config.API_BASE_URL + path).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 15_000
            readTimeout = 30_000
            doOutput = writesBody
            if (writesBody) setRequestProperty("Content-Type", "application/json")
            setRequestProperty("Accept", "application/json")
            if (token != null) setRequestProperty("Authorization", "Bearer $token")
        }
        return try {
            if (writesBody) {
                conn.outputStream.use { it.write((body ?: JSONObject()).toString().toByteArray(Charsets.UTF_8)) }
            }
            val code = conn.responseCode
            val stream = if (code in 200..299) conn.inputStream else conn.errorStream
            code to (stream?.bufferedReader()?.use { it.readText() }.orEmpty())
        } finally {
            conn.disconnect()
        }
    }

    private fun fieldErrors(text: String): Map<String, String>? = runCatching {
        val obj = JSONObject(text).optJSONObject("fields") ?: return null
        val out = LinkedHashMap<String, String>()
        obj.keys().forEach { key -> obj.optStringOrNull(key)?.let { out[key] = it } }
        out.takeUnless { it.isEmpty() }
    }.getOrNull()

    private fun extractError(text: String, code: Int): String {
        val parsed = runCatching { JSONObject(text).optString("error") }.getOrNull()
        return if (!parsed.isNullOrBlank()) parsed else "Request failed ($code)"
    }

    private fun JSONObject.optStringOrNull(name: String): String? =
        if (!has(name) || isNull(name)) null else optString(name).trim()
            .takeUnless { it.isBlank() || it.equals("null", ignoreCase = true) }
}
